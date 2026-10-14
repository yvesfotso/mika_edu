-- Past exam papers uploaded as PDFs by staff (the paper itself, or its marking scheme).
-- Files live in the private "past-papers" storage bucket; this table holds what each file is.
-- They go through the same review workflow as other content (draft → review → approved → published).

create table public.past_papers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  track_id uuid references public.exam_tracks(id) on delete set null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  year int not null check (year between 1960 and 2100),
  session text,
  kind text not null default 'paper' check (kind in ('paper', 'marking_scheme')),
  language text not null default 'fr' check (language in ('en', 'fr')),
  notes text,
  file_path text not null unique,
  file_name text not null,
  file_size int not null check (file_size > 0),
  status public.content_status not null default 'draft',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index past_papers_lookup_idx on public.past_papers (exam_id, subject_id, year desc);

create trigger past_papers_updated_at before update on public.past_papers
  for each row execute function public.set_updated_at();

-- No client policies: only the backend (service role) reads or writes past papers for now.
alter table public.past_papers enable row level security;

insert into storage.buckets (id, name, public)
values ('past-papers', 'past-papers', false)
on conflict (id) do nothing;
