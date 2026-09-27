-- Per-exam program rules and per-learner program settings; exams are locked after onboarding.

alter table public.exams
  add column program_config jsonb not null default '{"kind":"average","scale":20,"passMark":10,"mentions":[]}'::jsonb;

alter table public.profiles add column program_settings jsonb;

-- Defence in depth for the API rule: once a student finished onboarding, their exam and track
-- can only change through admin_reassign_program (which sets the override for its transaction).
create or replace function public.guard_program_change() returns trigger
language plpgsql as $$
begin
  if old.onboarding_completed
     and old.role = 'student'
     and (new.target_exam_id is distinct from old.target_exam_id
          or new.target_track_id is distinct from old.target_track_id
          or not new.onboarding_completed)
     and coalesce(current_setting('eduprep.allow_program_change', true), '') <> 'on' then
    raise exception 'program_locked: the exam can only be changed by an administrator' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_program_change
  before update of target_exam_id, target_track_id, onboarding_completed on public.profiles
  for each row execute function public.guard_program_change();

create or replace function public.admin_reassign_program(p_user uuid, p_exam uuid, p_track uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.exam_tracks where id = p_track and exam_id = p_exam) then
    raise exception 'invalid_track: track does not belong to exam' using errcode = 'P0001';
  end if;
  perform set_config('eduprep.allow_program_change', 'on', true);
  update public.profiles
     set target_exam_id = p_exam, target_track_id = p_track, program_settings = null
   where id = p_user;
end;
$$;
revoke all on function public.admin_reassign_program(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_reassign_program(uuid, uuid, uuid) to service_role;
