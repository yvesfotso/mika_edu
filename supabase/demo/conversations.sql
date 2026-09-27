-- Local demo only: a few support conversations between demo learners and the EduPrep team.
-- Runs after learners.sql. Safe to re-run (fixed ids, on conflict do nothing).
begin;

create temp table demo_chat (learner int, minutes_ago int, from_staff boolean, body text) on commit drop;
insert into demo_chat values
  (1, 2900, false, 'Hello! I chose BAC Série D by mistake, I am actually in Série C. Can you change it please?'),
  (1, 2870, true,  'Hi Amina, no problem. I have moved you to Série C. Your progress on shared subjects is kept.'),
  (1, 2860, false, 'Thank you so much 🙏'),
  (2, 400,  false, 'Bonjour, la leçon sur les nombres complexes ne s''affiche pas hors ligne.'),
  (2, 390,  false, 'Je l''ai ouverte hier avec la connexion.'),
  (4, 180,  false, 'Is there a mock exam for GCE A Level Physics this month?'),
  (4, 150,  true,  'Yes! A new Physics mock goes live on Friday. You will get a notification.'),
  (4, 25,   false, 'Great, can I do it twice?'),
  (7, 12,   false, 'Hi, my streak reset even though I practised yesterday evening.'),
  (11, 4300, false, 'How do I add a friend to study with?'),
  (11, 4200, true,  'Go to Messages → Add a friend and enter their 6-character friend code.');

with learners as (
  select n, demo.uuid('eduprep-demo-learner-' || n) as id from generate_series(1, 36) n
)
insert into public.conversations (id, kind, student_id, created_at)
select demo.uuid('demo-support-' || l.n), 'support', l.id, now() - interval '4 days'
from learners l
where l.n in (select learner from demo_chat)
on conflict do nothing;

insert into public.conversation_members (conversation_id, user_id)
select c.id, c.student_id from public.conversations c
where c.id in (select demo.uuid('demo-support-' || learner) from demo_chat)
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, client_message_id, body, created_at)
select demo.uuid('demo-msg-' || d.learner || '-' || d.minutes_ago),
       demo.uuid('demo-support-' || d.learner),
       case when d.from_staff then '00000000-0000-4000-8000-00000000a001'::uuid else demo.uuid('eduprep-demo-learner-' || d.learner) end,
       demo.uuid('demo-client-' || d.learner || '-' || d.minutes_ago),
       d.body,
       now() - make_interval(mins => d.minutes_ago)
from demo_chat d
on conflict do nothing;

-- Staff have read everything up to their own last reply.
update public.conversations c
set last_message_at = m.last_at,
    staff_last_read_at = m.last_staff_at
from (
  select conversation_id, max(created_at) as last_at,
         max(created_at) filter (where sender_id = '00000000-0000-4000-8000-00000000a001'::uuid) as last_staff_at
  from public.messages
  group by conversation_id
) m
where c.id = m.conversation_id and c.id in (select demo.uuid('demo-support-' || learner) from demo_chat);

commit;
