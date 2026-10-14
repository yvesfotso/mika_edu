-- Phase 1 learning loop: skills, lesson checkpoints and resume points, hints and misconceptions,
-- question versions on answers, the mistake notebook, content issue reports and study preferences.
-- Additive only: existing rows keep working (questions without a skill count as their chapter).
-- Rollback: supabase/rollbacks/20261014000001_learning_loop.down.sql (enum values cannot be dropped).

-- New ways of answering. The values are only used by later statements and the API, never in this file,
-- because Postgres can't use an enum value in the transaction that adds it.
alter type public.attempt_mode add value if not exists 'diagnostic';
alter type public.attempt_mode add value if not exists 'checkpoint';
alter type public.attempt_mode add value if not exists 'recovery';

-- ---------------------------------------------------------------------------
-- Content: skills, question purpose/version, hints, misconceptions, checkpoints
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  slug text not null,
  name jsonb not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (chapter_id, slug)
);
create index skills_chapter_idx on public.skills (chapter_id, order_index);

alter table public.questions
  add column skill_id uuid references public.skills(id) on delete set null,
  -- 'checkpoint' questions appear inside lessons and are kept out of the practice pool.
  add column purpose text not null default 'practice' check (purpose in ('practice', 'checkpoint')),
  -- Bumped whenever the question's content or answer key changes; answers record the version seen.
  add column version int not null default 1 check (version > 0);
create index questions_skill_status_idx on public.questions (skill_id, status);

-- The misconception a wrong option reveals, e.g. {"fr": "Oubli que i² = −1"}. Authored, never inferred.
alter table public.question_options add column misconception jsonb;
alter table public.solutions add column hint jsonb;

create table public.lesson_checkpoints (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  -- Shown after this block (blocks are the lesson's `## ` sections, starting at 0).
  after_block int not null default 0 check (after_block >= 0),
  order_index int not null default 0,
  primary key (lesson_id, question_id)
);
create index lesson_checkpoints_question_idx on public.lesson_checkpoints (question_id);

-- ---------------------------------------------------------------------------
-- Learner records
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- Study days, 0 = Sunday … 6 = Saturday.
  add column study_days smallint[] not null default '{0,1,2,3,4,5,6}',
  add column diagnostic_status text not null default 'pending' check (diagnostic_status in ('pending', 'completed', 'skipped'));
-- Learners who onboarded before the diagnostic existed aren't sent through it; they can take it from Today.
update public.profiles set diagnostic_status = 'skipped' where onboarding_completed;

-- Reading position, separate from completion (lesson_completions) and from assessment (answers).
create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  last_block int not null default 0 check (last_block >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.quiz_attempts
  add column lesson_id uuid references public.lessons(id) on delete set null,
  add column skill_id uuid references public.skills(id) on delete set null,
  -- Answered offline from a study pack and synced later.
  add column offline boolean not null default false;

alter table public.question_attempts
  add column question_version int not null default 1,
  -- False when the learner answered an older version of the question (e.g. an outdated offline pack):
  -- the answer is kept, but it doesn't count towards mastery.
  add column counts_as_evidence boolean not null default true,
  -- When the learner answered on the device; saved_at is when the server received it.
  add column answered_at timestamptz;
create index question_attempts_user_graded_idx on public.question_attempts (user_id, saved_at) where correct is not null;

-- One entry per wrong answer. History is kept after recovery.
create table public.mistake_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_attempt_id uuid not null unique references public.question_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_version int not null,
  chapter_id uuid references public.chapters(id) on delete set null,
  skill_id uuid references public.skills(id) on delete set null,
  response jsonb not null,
  misconception jsonb,
  created_at timestamptz not null,
  -- The learner read the correction.
  reviewed_at timestamptz,
  -- The same question answered correctly later (practice, not proof of the skill).
  retried_correct_at timestamptz,
  -- A different question on the same skill answered correctly without a hint.
  recovered_at timestamptz,
  recovered_by uuid references public.question_attempts(id) on delete set null
);
create index mistake_entries_user_created_idx on public.mistake_entries (user_id, created_at desc);
create index mistake_entries_open_idx on public.mistake_entries (user_id, chapter_id) where recovered_at is null;

-- Learners flag questions or lessons that look wrong; reviewers resolve them in the CMS.
create table public.content_issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  question_version int,
  reason text not null check (reason in ('wrong_answer', 'unclear', 'typo', 'other')),
  message text check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  check (question_id is not null or lesson_id is not null)
);
-- One open report per learner and item, so repeated taps don't flood the queue.
create unique index content_issue_reports_open_once
  on public.content_issue_reports (reporter_id, coalesce(question_id, lesson_id)) where status = 'open';
create index content_issue_reports_status_idx on public.content_issue_reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security: same model as before (API writes with the service role).
-- ---------------------------------------------------------------------------

alter table public.skills enable row level security;
alter table public.lesson_checkpoints enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.mistake_entries enable row level security;
alter table public.content_issue_reports enable row level security;

create policy "skills of published chapters are readable" on public.skills
  for select using (exists (select 1 from public.chapters c where c.id = chapter_id and c.status = 'published'));
-- lesson_checkpoints links lessons to answer-keyed questions: no client policy, served by the API.
create policy "read own lesson progress" on public.lesson_progress
  for select using (auth.uid() = user_id);
create policy "read own mistakes" on public.mistake_entries
  for select using (auth.uid() = user_id);
create policy "read own content reports" on public.content_issue_reports
  for select using (auth.uid() = reporter_id);
