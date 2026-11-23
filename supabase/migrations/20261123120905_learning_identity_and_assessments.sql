-- Identity, learning records, and teacher feedback for Free University of Theology.
-- Roles are stored server-side. Browser-controlled user metadata is never used for authorization.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('student', 'teacher', 'editor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 160),
  course_id text not null check (char_length(course_id) between 1 and 160),
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.lesson_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.teacher_course_assignments (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (char_length(course_id) between 1 and 160),
  assigned_at timestamptz not null default now(),
  primary key (teacher_id, course_id)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  course_id text not null check (char_length(course_id) between 1 and 160),
  score smallint not null check (score between 0 and 100),
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  teacher_feedback text check (char_length(teacher_feedback) <= 10000),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index learning_progress_user_course_idx
  on public.learning_progress (user_id, course_id);
create index assessment_attempts_course_submitted_idx
  on public.assessment_attempts (course_id, submitted_at desc);
create index assessment_attempts_student_submitted_idx
  on public.assessment_attempts (student_id, submitted_at desc);
create index assessment_attempts_reviewer_idx
  on public.assessment_attempts (reviewer_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger learning_progress_set_updated_at
before update on public.learning_progress
for each row execute function private.set_updated_at();

create trigger lesson_notes_set_updated_at
before update on public.lesson_notes
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Estudante'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.set_attempt_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.student_id = auth.uid();
  select full_name into new.student_name
  from public.profiles
  where id = auth.uid();

  if new.student_name is null then
    raise exception 'Profile unavailable for this user';
  end if;

  return new;
end;
$$;

create trigger assessment_attempts_set_identity
before insert on public.assessment_attempts
for each row execute function private.set_attempt_identity();

create function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = required_role
  );
$$;

create function private.can_review_course(target_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_role('admin')
    or exists (
      select 1
      from public.teacher_course_assignments
      where teacher_id = auth.uid()
        and course_id = target_course_id
    );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.set_attempt_identity() from public;
revoke all on function private.has_role(public.app_role) from public;
revoke all on function private.can_review_course(text) from public;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.can_review_course(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.learning_progress enable row level security;
alter table public.lesson_notes enable row level security;
alter table public.teacher_course_assignments enable row level security;
alter table public.assessment_attempts enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

revoke all on table public.learning_progress from anon, authenticated;
grant select, insert, update, delete on table public.learning_progress to authenticated;

revoke all on table public.lesson_notes from anon, authenticated;
grant select, insert, update, delete on table public.lesson_notes to authenticated;

revoke all on table public.teacher_course_assignments from anon, authenticated;
grant select on table public.teacher_course_assignments to authenticated;

revoke all on table public.assessment_attempts from anon, authenticated;
grant select, insert on table public.assessment_attempts to authenticated;
grant update (teacher_feedback, reviewer_id, reviewed_at) on table public.assessment_attempts to authenticated;

create policy "profiles: users or admins can read profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.has_role('admin'));

create policy "profiles: users update their own name"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "progress: users manage their own records"
on public.learning_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "notes: users manage their own notes"
on public.lesson_notes for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "teacher assignments: teachers read their own courses"
on public.teacher_course_assignments for select to authenticated
using ((select auth.uid()) = teacher_id or private.has_role('admin'));

create policy "attempts: students or assigned teachers can read submissions"
on public.assessment_attempts for select to authenticated
using (
  (select auth.uid()) = student_id
  or private.can_review_course(course_id)
);

create policy "attempts: students submit their own work"
on public.assessment_attempts for insert to authenticated
with check ((select auth.uid()) = student_id);

create policy "attempts: assigned teachers can publish feedback"
on public.assessment_attempts for update to authenticated
using (private.can_review_course(course_id))
with check (
  private.can_review_course(course_id)
  and reviewer_id = (select auth.uid())
  and reviewed_at is not null
);
