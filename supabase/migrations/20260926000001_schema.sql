-- EduPrep Africa: core MVP schema (identity, curriculum, questions, attempts, progress, audit).
-- Localized text columns are jsonb objects keyed by locale: {"en": "...", "fr": "..."}.

create type public.user_role as enum ('student', 'teacher', 'reviewer', 'admin');
create type public.content_status as enum ('draft', 'review', 'approved', 'published', 'archived');
create type public.question_type as enum ('single_choice', 'multiple_choice', 'true_false', 'numeric');
create type public.question_source as enum ('official_past_paper', 'teacher_created', 'ai_generated', 'original');
create type public.attempt_mode as enum ('practice', 'past_paper', 'mock');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  slug text not null unique,
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  level text not null,
  primary_language text not null default 'en' check (primary_language in ('en', 'fr')),
  -- Official facts: only set from a verified source, with the verification date.
  exam_date date,
  registration_deadline date,
  source_url text,
  verified_at timestamptz,
  verified_by uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exam_tracks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  slug text not null,
  name jsonb not null,
  order_index int not null default 0,
  unique (exam_id, slug)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name jsonb not null,
  icon text
);

create table public.track_subjects (
  track_id uuid not null references public.exam_tracks(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  coefficient numeric(4,1) not null default 1 check (coefficient > 0),
  order_index int not null default 0,
  primary key (track_id, subject_id)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.exam_tracks(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title jsonb not null,
  order_index int not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chapters_track_subject_idx on public.chapters (track_id, subject_id, order_index);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title jsonb not null,
  -- Markdown per locale.
  body jsonb not null default '{}'::jsonb,
  estimated_minutes int not null default 10 check (estimated_minutes > 0),
  order_index int not null default 0,
  status public.content_status not null default 'draft',
  version int not null default 1,
  publish_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_chapter_idx on public.lessons (chapter_id, order_index);

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  type public.question_type not null default 'single_choice',
  prompt jsonb not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  source_type public.question_source not null default 'original',
  source_year int,
  official_source_url text,
  numeric_answer double precision,
  numeric_tolerance double precision,
  status public.content_status not null default 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Past-paper provenance is mandatory; AI-generated questions can never claim to be official.
  constraint past_paper_has_year check (source_type <> 'official_past_paper' or source_year is not null),
  constraint numeric_has_answer check (type <> 'numeric' or numeric_answer is not null)
);
create index questions_chapter_status_idx on public.questions (chapter_id, status);
create index questions_subject_status_idx on public.questions (subject_id, status);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text jsonb not null,
  is_correct boolean not null default false,
  order_index int not null default 0
);
create index question_options_question_idx on public.question_options (question_id, order_index);

create table public.solutions (
  question_id uuid primary key references public.questions(id) on delete cascade,
  explanation jsonb not null default '{}'::jsonb,
  marking_scheme jsonb
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  country_code char(2) not null default 'CM',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'fr')),
  role public.user_role not null default 'student',
  education_level text,
  school_name text,
  timezone text not null default 'Africa/Douala',
  target_exam_id uuid references public.exams(id) on delete set null,
  target_track_id uuid references public.exam_tracks(id) on delete set null,
  daily_goal_minutes int not null default 30 check (daily_goal_minutes between 5 and 480),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, phone, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.phone,
    case when new.raw_user_meta_data ->> 'preferred_language' = 'fr' then 'fr' else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Attempts and progress (written only by the backend with the service role)
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_attempt_id uuid not null,
  mode public.attempt_mode not null,
  track_id uuid references public.exam_tracks(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  question_ids uuid[] not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  score int,
  max_score int,
  percentage numeric(5,1),
  duration_seconds int,
  unique (user_id, client_attempt_id)
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb not null,
  correct boolean,
  response_ms int,
  hints_used int not null default 0,
  saved_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index question_attempts_user_question_idx on public.question_attempts (user_id, question_id);

create table public.mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  score numeric(4,3) not null default 0 check (score between 0 and 1),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  attempts_count int not null default 0,
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_days int not null default 0,
  best_days int not null default 0,
  last_activity_date date
);

create table public.lesson_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  lesson_version int not null default 1,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  seconds int not null default 0,
  questions_answered int not null default 0,
  lessons_completed int not null default 0,
  primary key (user_id, activity_date)
);

create or replace function public.record_daily_activity(
  p_user uuid, p_date date, p_seconds int, p_questions int, p_lessons int
) returns void
language sql security definer set search_path = public as $$
  insert into public.daily_activity (user_id, activity_date, seconds, questions_answered, lessons_completed)
  values (p_user, p_date, greatest(p_seconds, 0), greatest(p_questions, 0), greatest(p_lessons, 0))
  on conflict (user_id, activity_date) do update set
    seconds = public.daily_activity.seconds + excluded.seconds,
    questions_answered = public.daily_activity.questions_answered + excluded.questions_answered,
    lessons_completed = public.daily_activity.lessons_completed + excluded.lessons_completed;
$$;
revoke all on function public.record_daily_activity(uuid, date, int, int, int) from public, anon, authenticated;
grant execute on function public.record_daily_activity(uuid, date, int, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Admin audit trail
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);

-- updated_at maintenance
create trigger exams_updated_at before update on public.exams for each row execute function public.set_updated_at();
create trigger chapters_updated_at before update on public.chapters for each row execute function public.set_updated_at();
create trigger lessons_updated_at before update on public.lessons for each row execute function public.set_updated_at();
create trigger questions_updated_at before update on public.questions for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
