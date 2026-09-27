# EduPrep Africa

A mobile-first exam-preparation platform. The pilot covers Cameroon's **GCE O Level**, **GCE A Level**, **Probatoire** and **Baccalauréat**, with a bilingual (English/French) interface and content.

The learning loop this MVP implements:

**open app → see today's task → learn → practise → get feedback → see progress → know what to do next**

| Part | Stack | Path |
|---|---|---|
| Learner app (Android/iOS/web) | React Native · Expo · Expo Router · TypeScript | [apps/mobile](apps/mobile) |
| Admin CMS + backend API | Next.js 16 (App Router, Route Handlers, Server Actions) · Tailwind | [apps/admin](apps/admin) |
| Shared domain logic | TypeScript · Zod · Vitest | [packages/core](packages/core) |
| Database, auth, storage | Supabase (PostgreSQL + RLS) | [supabase](supabase) |

Monorepo tooling: **pnpm workspaces + Turborepo**.

---

## Architecture

```
Expo app ──(Supabase Auth: sign-in only)──► Supabase Auth
   │
   └──(Bearer JWT)──► Next.js /api/v1/*  ──(service role)──► PostgreSQL
                          ▲
Admin browser ──(cookie session, Server Actions)──┘
```

- **Clients are untrusted.** The mobile app uses Supabase only to sign in. Everything else goes through `/api/v1`, which checks the token, works out what the learner may see, scores attempts and updates mastery on the server.
- **Answer keys never reach a device before submission.** RLS gives clients no access to `questions`, `question_options` or `solutions`. The API strips correctness data from attempt payloads.
- **One modular monolith.** The API lives in the admin Next.js app (`src/server/learner/*` services + thin route handlers). Splitting services out can wait until real load requires it.
- **Offline-tolerant.** The app caches API responses, so lessons already opened can be read offline. Lesson completions and practice submissions go into an on-device sync queue with idempotency keys and replay when the connection returns.

### Core domain logic ([packages/core](packages/core/src))

Pure, tested functions shared by the API and the app:

- `scoring.ts`: all-or-nothing scoring for single, multiple, true/false and numeric questions (numeric answers have a tolerance). Also handles the mock-exam deadline and its 30 s grace period.
- `mastery.ts`: per-chapter mastery as a moving average weighted by difficulty and exam mode. Hints and slow answers earn less credit, and mastery decays with time since the last practice (the forgetting curve).
- `recommend.ts`: picks the next chapters to study. Weak or fading chapters in high-coefficient subjects come first, then unstarted chapters.
- `streak.ts`, `dates.ts`: streaks computed in the learner's timezone. They are safe against events that sync late or out of order.
- `workflow.ts`: the Draft → Review → Approved → Published workflow and which roles may move content between states.
- `importer.ts`: CSV/JSON question import that validates every row and reports errors per row.
- `schemas.ts`: Zod schemas for every API payload and CMS form.

---

## Getting started

### 1. Prerequisites

- Node.js ≥ 20 (tested on 24) and pnpm (`corepack enable pnpm`)
- A Supabase project (free tier is fine)
- For the mobile app: the Expo Go app on a phone, or an Android emulator / iOS simulator

### 2. Install

```bash
pnpm install
```

### 3. Create the database

In the Supabase dashboard **SQL editor**, run these in order:

1. [supabase/migrations/20260926000001_schema.sql](supabase/migrations/20260926000001_schema.sql)
2. [supabase/migrations/20260926000002_rls.sql](supabase/migrations/20260926000002_rls.sql)
3. [supabase/migrations/20260926000003_messaging.sql](supabase/migrations/20260926000003_messaging.sql)
4. [supabase/migrations/20260926000004_programs.sql](supabase/migrations/20260926000004_programs.sql)
5. [supabase/seed.sql](supabase/seed.sql) (pilot content; safe to re-run)

Or, with the Supabase CLI: `supabase link` then `supabase db push`, and run the seed file.

The seed is generated from [supabase/seed/content.ts](supabase/seed/content.ts). After editing content there, run `pnpm db:seed:generate`.

### 4. Configure environment variables

```bash
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the Supabase URL, anon key and (admin only) service-role key.

For `EXPO_PUBLIC_API_URL`, use your computer's LAN IP (e.g. `http://192.168.1.20:3000`) so a physical phone can reach the API.

### 5. Create your first admin

Sign up once, either in the mobile app or under **Authentication → Users** in the Supabase dashboard. Then promote the account:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Roles: `student`, `teacher` (writes drafts), `reviewer` (approves), `admin` (publishes, manages exams, sees the audit log).

### 6. Run

```bash
pnpm dev:admin    # http://localhost:3000 (CMS + /api/v1)
pnpm dev:mobile   # Expo dev server; press a / i / w, or scan the QR code with Expo Go
```

### Demo mode (no Supabase needed)

To try the learner app without any backend:

```bash
pnpm --filter @eduprep/mobile demo   # then press w for the browser, or scan the QR code with Expo Go
```

Demo mode runs a simulated `/api/v1` on the device ([apps/mobile/src/demo](apps/mobile/src/demo)). It uses the same pilot content (`content.json`, exported by `pnpm db:seed:generate`) and the same scoring, mastery and streak logic from `@eduprep/core`.

- Demo account: **demo@eduprep.africa / Demo1234!**. It's enrolled in BAC Série D and already has some progress. You can also create new local accounts.
- Data is saved only on that device or browser, and the admin CMS still needs Supabase.

### Local backend demo (admin CMS + chat, no Supabase project)

On macOS with PostgreSQL installed (the EDB installer at `/Library/PostgreSQL/18`, or set `PG_BIN`), [supabase/demo](supabase/demo) runs a local stand-in for Supabase: Postgres with the real migrations and seed, PostgREST, and a small gateway that fakes Supabase Auth for demo accounts. It also adds fictional learners with a few weeks of activity and some support conversations.

```bash
pnpm demo:admin           # starts the backend, writes apps/admin/.env.local, runs the CMS on http://localhost:3001
pnpm demo:backend:stop    # stop it (data is kept in .demo/, gitignored)
bash supabase/demo/start.sh --reset   # wipe and re-seed
```

- Admin: **admin@eduprep.africa / Demo1234!** (also `reviewer@` and `teacher@`).
- Learner: **student@eduprep.africa / Demo1234!**. To chat with the admin Inbox from the learner app, point `apps/mobile/.env` at the local backend (`EXPO_PUBLIC_API_URL=http://localhost:3001`, `EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321`, and the anon key from `apps/admin/.env.local`), then run `pnpm dev:mobile`.
- Demo only: the gateway accepts a fixed password and signs tokens with a hardcoded secret.

### Checks

```bash
pnpm test        # core logic unit tests
pnpm typecheck   # all packages
pnpm lint
```

---

## API (v1)

All learner endpoints expect `Authorization: Bearer <supabase access token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/exams` | Active exams with tracks (public; used in onboarding) |
| GET / PATCH | `/api/v1/me` | Profile; set language, exam, track, daily goal |
| GET | `/api/v1/me/dashboard` | Countdown, streak, today's minutes, next lesson, recommendations, mastery |
| GET | `/api/v1/me/attempts` | Recent submitted attempts |
| GET | `/api/v1/tracks/:trackId/subjects` | Subjects with coefficient and mastery |
| GET | `/api/v1/tracks/:trackId/subjects/:subjectId/chapters` | Chapters, lessons, completion, mastery |
| GET | `/api/v1/lessons/:id` | Lesson content |
| POST | `/api/v1/lessons/:id/complete` | Idempotent completion (`secondsSpent`, optional `completedAt`) |
| POST | `/api/v1/quiz-attempts` | Start `practice` / `past_paper` / `mock` (idempotent via `clientAttemptId`) |
| GET | `/api/v1/quiz-attempts/:id` | Attempt (no answer keys) and result once submitted |
| POST | `/api/v1/quiz-attempts/:id/answers` | Autosave (rejected after the mock deadline) |
| POST | `/api/v1/quiz-attempts/:id/submit` | Score on the server, update mastery and streak, return the result (idempotent) |
| GET | `/api/v1/conversations` | Your chats (EduPrep Team support + study friends) with unread counts |
| POST | `/api/v1/conversations/support` | Open your support chat with the EduPrep team |
| POST | `/api/v1/conversations/direct` | Start a study chat from a friend code (`{ friendCode }`) |
| GET / POST | `/api/v1/conversations/:id/messages` | Read history (`?before=` pages back) / send (idempotent via `clientMessageId`, max 20 per minute) |
| POST | `/api/v1/conversations/:id/read` | Mark as read |
| POST | `/api/v1/users/:id/block` · `/unblock` | Block or unblock a learner (staff can't be blocked) |
| POST | `/api/v1/messages/:id/report` | Report a message to moderators |

Errors have the shape `{ "error": { "code", "message", "details?" } }`.

---

## Content and trust rules

- Exam dates and deadlines are shown to learners **only after an admin verifies them against an official source URL**. Changing a date clears the verification.
- Seed content is original placeholder material. **Subject coefficients in the seed are placeholders**: check them against the official regulations before launch.
- Every question records its provenance (`original`, `teacher_created`, `official_past_paper`, `ai_generated`). The database requires a year for past-paper questions, and only reviewers and admins can label a question as official.
- Every CMS change is written to `audit_logs`.
- **Exam lock:** a student chooses an exam and track during onboarding, and after that it can't be changed from the app. Both the API and a database trigger enforce this. Admins can move a learner to another exam from **Learners** in the admin CMS, which uses the `admin_reassign_program` function.
- **Program settings depend on how the exam is graded** (`exams.program_config`):
  - GCE O/A Level (`grades`): the learner picks the subjects they sit (O Level 4–11, A Level 2–5) and a target grade per subject. Only those subjects are shown and recommended.
  - Probatoire and BAC (`average`): every subject of the série is compulsory, and the learner picks a target average /20, shown with its mention.
  - The seeded grade scales and subject limits are placeholders to check against official regulations.
- **Messaging:** learners can message the EduPrep team or study friends who shared their 6-character friend code. The team answers from the admin **Inbox**, and staff messages show a *Verified* badge. There is no public student directory. Learners can block other learners and report messages, and reviewers and admins resolve reports in the Inbox.

---

## Roadmap (next milestones)

Following the blueprint's backlog, these are not built yet:

- **P1:** push notifications (Expo Notifications + a server job), full mock-exam builder (sections, per-exam duration), past-paper PDF library, study planner, payments (Mobile Money through an aggregator), and a RAG AI tutor (pgvector, grounded in approved lessons).
- **P2:** photo correction (SnapCorrect-style), human review, video, community, parent view, voice tutor.
- **Scale:** move analytics to SQL views or materialized views, add rate limiting (Redis), and add background workers for AI and OCR.
