-- Shared editorial content. Teachers can publish material only in their assigned courses.
-- Public readers can only see published lessons and modules that contain published lessons.

create table public.editorial_modules (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,159}$'),
  course_id text not null check (char_length(course_id) between 1 and 160),
  title text not null check (char_length(trim(title)) between 2 and 180),
  summary text not null default '' check (char_length(summary) <= 1000),
  position integer not null default 1000 check (position between 1 and 100000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.editorial_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (char_length(course_id) between 1 and 160),
  module_id text not null check (char_length(module_id) between 1 and 160),
  position integer not null default 1000 check (position between 1 and 100000),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,159}$'),
  title text not null check (char_length(trim(title)) between 2 and 180),
  intro text not null default '' check (char_length(intro) <= 1200),
  objectives text[] not null default '{}'::text[] check (cardinality(objectives) <= 12),
  content_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(content_blocks) = 'array'),
  source_references text[] not null default '{}'::text[] check (cardinality(source_references) <= 40),
  estimated_minutes smallint not null default 10 check (estimated_minutes between 1 and 600),
  youtube_url text check (youtube_url is null or youtube_url ~ '^https://(www\\.)?(youtube\\.com|youtu\\.be)/'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  check (status <> 'published' or content_blocks <> '[]'::jsonb)
);

create index editorial_modules_course_position_idx
  on public.editorial_modules (course_id, position);
create index editorial_lessons_course_status_position_idx
  on public.editorial_lessons (course_id, status, module_id, position, created_at);
create index editorial_lessons_author_updated_idx
  on public.editorial_lessons (author_id, updated_at desc);

create trigger editorial_modules_set_updated_at
before update on public.editorial_modules
for each row execute function private.set_updated_at();

create trigger editorial_lessons_set_updated_at
before update on public.editorial_lessons
for each row execute function private.set_updated_at();

create function private.can_manage_course_content(target_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_role('admin')
    or private.has_role('editor')
    or (
      private.has_role('teacher')
      and exists (
        select 1
        from public.teacher_course_assignments
        where teacher_id = auth.uid()
          and course_id = target_course_id
      )
    );
$$;

revoke all on function private.can_manage_course_content(text) from public;
grant execute on function private.can_manage_course_content(text) to authenticated;

alter table public.editorial_modules enable row level security;
alter table public.editorial_lessons enable row level security;

revoke all on table public.editorial_modules from anon, authenticated;
revoke all on table public.editorial_lessons from anon, authenticated;
grant select on table public.editorial_modules to anon, authenticated;
grant select on table public.editorial_lessons to anon, authenticated;
grant insert, update, delete on table public.editorial_modules to authenticated;
grant insert, update, delete on table public.editorial_lessons to authenticated;

create policy "editorial modules: public reads modules with published material"
on public.editorial_modules for select to anon, authenticated
using (
  exists (
    select 1
    from public.editorial_lessons
    where editorial_lessons.module_id = editorial_modules.id
      and editorial_lessons.status = 'published'
  )
);

create policy "editorial modules: authors manage assigned course modules"
on public.editorial_modules for all to authenticated
using (
  created_by = (select auth.uid())
  and private.can_manage_course_content(course_id)
)
with check (
  created_by = (select auth.uid())
  and private.can_manage_course_content(course_id)
);

create policy "editorial lessons: public reads published lessons"
on public.editorial_lessons for select to anon, authenticated
using (status = 'published');

create policy "editorial lessons: authors manage assigned course lessons"
on public.editorial_lessons for all to authenticated
using (
  author_id = (select auth.uid())
  and private.can_manage_course_content(course_id)
)
with check (
  author_id = (select auth.uid())
  and private.can_manage_course_content(course_id)
);
