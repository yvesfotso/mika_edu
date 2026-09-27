-- Row-level security.
-- Clients (mobile/admin browsers) are untrusted: they may read published curriculum and their own
-- records, and nothing else. All writes, scoring and answer keys go through the backend API,
-- which uses the service role (bypasses RLS) after its own authorization checks.

alter table public.exams enable row level security;
alter table public.exam_tracks enable row level security;
alter table public.subjects enable row level security;
alter table public.track_subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.solutions enable row level security;
alter table public.profiles enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.question_attempts enable row level security;
alter table public.mastery enable row level security;
alter table public.streaks enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.daily_activity enable row level security;
alter table public.audit_logs enable row level security;

-- Published curriculum is public reading material.
create policy "active exams are readable" on public.exams
  for select using (active);
create policy "tracks of active exams are readable" on public.exam_tracks
  for select using (exists (select 1 from public.exams e where e.id = exam_id and e.active));
create policy "subjects are readable" on public.subjects
  for select using (true);
create policy "track subjects are readable" on public.track_subjects
  for select using (true);
create policy "published chapters are readable" on public.chapters
  for select using (status = 'published');
create policy "published lessons are readable" on public.lessons
  for select using (status = 'published' and (publish_at is null or publish_at <= now()));

-- questions, question_options and solutions intentionally have no client policies:
-- answer keys must never reach a device before the attempt is submitted.

-- Own records only.
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "read own attempts" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "read own question attempts" on public.question_attempts
  for select using (auth.uid() = user_id);
create policy "read own mastery" on public.mastery
  for select using (auth.uid() = user_id);
create policy "read own streak" on public.streaks
  for select using (auth.uid() = user_id);
create policy "read own lesson completions" on public.lesson_completions
  for select using (auth.uid() = user_id);
create policy "read own daily activity" on public.daily_activity
  for select using (auth.uid() = user_id);

-- Private storage bucket for future uploads (SnapCorrect copies, PDFs); accessed via signed URLs.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;
