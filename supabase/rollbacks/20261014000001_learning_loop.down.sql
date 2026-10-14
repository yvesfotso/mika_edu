-- Reverses supabase/migrations/20261014000001_learning_loop.sql. Run manually in the SQL editor.
-- This deletes learner data created by the learning loop (mistakes, reading positions, reports,
-- question versions on answers). Take a backup first.
-- Postgres cannot drop enum values: attempts recorded as 'diagnostic', 'checkpoint' or 'recovery'
-- are re-labelled 'practice' so the old API can still read them, and the values stay in the type.

begin;

drop table if exists public.content_issue_reports;
drop table if exists public.mistake_entries;
drop table if exists public.lesson_progress;
drop table if exists public.lesson_checkpoints;

update public.quiz_attempts set mode = 'practice' where mode::text in ('diagnostic', 'checkpoint', 'recovery');

alter table public.question_attempts
  drop column if exists answered_at,
  drop column if exists counts_as_evidence,
  drop column if exists question_version;
drop index if exists public.question_attempts_user_graded_idx;

alter table public.quiz_attempts
  drop column if exists offline,
  drop column if exists skill_id,
  drop column if exists lesson_id;

alter table public.profiles
  drop column if exists diagnostic_status,
  drop column if exists study_days;

alter table public.solutions drop column if exists hint;
alter table public.question_options drop column if exists misconception;

alter table public.questions
  drop column if exists version,
  drop column if exists purpose,
  drop column if exists skill_id;

drop table if exists public.skills;

commit;
