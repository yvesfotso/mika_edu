-- Local demo only: fictional learners with a few weeks of study history, so the admin dashboard
-- has something to show. Deterministic per learner, relative to today. Safe to re-run.
begin;

create temp table demo_names (n int, name text, lang text) on commit drop;
insert into demo_names (n, name, lang)
select row_number() over (), name, case when row_number() over () % 3 = 0 then 'fr' else 'en' end
from unnest(array[
  'Amina Njoya', 'Brice Tchoumi', 'Clarisse Mbarga', 'Daniel Fon', 'Estelle Ngo Bassa', 'Fabrice Eto''o',
  'Grace Ayuk', 'Hervé Kamga', 'Inès Mballa', 'Junior Nkeng', 'Kelly Tabi', 'Landry Fouda',
  'Maeva Ndongo', 'Nathan Achu', 'Océane Biya', 'Patrick Nana', 'Rachel Ekane', 'Samuel Tanyi',
  'Tatiana Owona', 'Ulrich Mbappe', 'Vanessa Ngassa', 'William Ateba', 'Yvette Abena', 'Zacharie Moukoko',
  'Aïcha Bello', 'Boris Essomba', 'Carine Tchatchoua', 'Didier Mokake', 'Emmanuella Fru', 'Franck Nyobe',
  'Gisèle Ondoa', 'Hugo Ekwalla', 'Irène Mfou', 'Joël Manga', 'Karelle Djomo', 'Loïc Nguema'
]) as name;

create temp table demo_learners on commit drop as
select
  n,
  demo.uuid('eduprep-demo-learner-' || n) as id,
  name,
  lang,
  lower(regexp_replace(unaccent_name, '[^a-zA-Z]+', '.', 'g')) || '@learners.demo' as email,
  now() - make_interval(days => 3 + (n * 7) % 55) as joined_at,
  -- how engaged this learner is, 0.15 .. 0.9
  0.15 + ((n * 37) % 76) / 100.0 as engagement,
  -- how strong this learner is, 0.35 .. 0.95
  0.35 + ((n * 53) % 61) / 100.0 as skill
from (select n, name, lang, translate(name, 'àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ''', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC') as unaccent_name from demo_names) s;

insert into auth.users (id, email, raw_user_meta_data, created_at)
select id, email, jsonb_build_object('display_name', name, 'preferred_language', lang), joined_at
from demo_learners
on conflict (id) do nothing;

-- Spread learners across the pilot tracks.
with tracks as (
  select t.id as track_id, t.exam_id, row_number() over (order by t.exam_id, t.order_index) as k, count(*) over () as total
  from public.exam_tracks t
)
update public.profiles p
set target_exam_id = tr.exam_id,
    target_track_id = tr.track_id,
    onboarding_completed = (l.n % 9 <> 0),
    school_name = (array['Lycée Général Leclerc', 'GBHS Bamenda', 'Collège Libermann', 'Lycée de Bonabéri', 'CCAS Kumba'])[1 + l.n % 5],
    created_at = l.joined_at
from demo_learners l
join tracks tr on tr.k = 1 + (l.n % tr.total)
where p.id = l.id;

-- Daily study time over the last 28 days.
insert into public.daily_activity (user_id, activity_date, seconds, questions_answered, lessons_completed)
select l.id, d::date,
       (600 + (abs(hashtext(l.id::text || d::text)) % 3000))::int,
       (3 + abs(hashtext('q' || l.id::text || d::text)) % 25)::int,
       (abs(hashtext('l' || l.id::text || d::text)) % 3)::int
from demo_learners l
cross join generate_series(current_date - 27, current_date, interval '1 day') d
where d >= l.joined_at::date
  and (abs(hashtext(l.id::text || d::text)) % 100) < l.engagement * 100
on conflict (user_id, activity_date) do nothing;

-- Practice quizzes on published chapters of each learner's track.
insert into public.quiz_attempts (user_id, client_attempt_id, mode, track_id, subject_id, chapter_id, question_ids,
                                  started_at, submitted_at, score, max_score, percentage, duration_seconds)
select a.user_id, demo.uuid(a.user_id::text || a.activity_date || c.id), 'practice', c.track_id, c.subject_id, c.id, '{}',
       a.activity_date + time '17:00', a.activity_date + time '17:12',
       round(10 * sc), 10, round(100 * sc, 1), 720
from public.daily_activity a
join demo_learners l on l.id = a.user_id
join public.profiles p on p.id = a.user_id
join lateral (
  select ch.id, ch.track_id, ch.subject_id
  from public.chapters ch
  where ch.track_id = p.target_track_id and ch.status = 'published'
  order by md5(ch.id::text || a.activity_date)
  limit 1
) c on true
cross join lateral (select least(1, greatest(0.1, l.skill + ((abs(hashtext(a.user_id::text || a.activity_date)) % 41) - 20) / 100.0)) as sc) s
where a.questions_answered > 8
on conflict (user_id, client_attempt_id) do nothing;

-- Mastery per practised chapter.
insert into public.mastery (user_id, chapter_id, score, confidence, attempts_count, last_practiced_at)
select user_id, chapter_id, round(avg(percentage) / 100, 3), least(1, count(*) / 5.0), count(*), max(submitted_at)
from public.quiz_attempts
where user_id in (select id from demo_learners)
group by user_id, chapter_id
on conflict (user_id, chapter_id) do update
  set score = excluded.score, confidence = excluded.confidence,
      attempts_count = excluded.attempts_count, last_practiced_at = excluded.last_practiced_at;

insert into public.streaks (user_id, current_days, best_days, last_activity_date)
select user_id, count(*) filter (where activity_date >= current_date - 6), count(*), max(activity_date)
from public.daily_activity
where user_id in (select id from demo_learners)
group by user_id
on conflict (user_id) do update
  set current_days = excluded.current_days, best_days = excluded.best_days, last_activity_date = excluded.last_activity_date;

-- Put a little content back into the review workflow so the review queue isn't empty.
with ranked as (select id, row_number() over (order by md5(id::text)) as k from public.questions)
update public.questions q
set status = case when r.k <= 4 then 'review' when r.k <= 7 then 'draft' else 'approved' end::public.content_status
from ranked r
where q.id = r.id and r.k <= 9 and q.status = 'published';

with ranked as (select id, row_number() over (order by md5(id::text)) as k from public.lessons where status = 'published')
update public.lessons l set status = 'review'
from ranked r
where l.id = r.id and r.k <= 2;

commit;
