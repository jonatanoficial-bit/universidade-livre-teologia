create index assessment_attempts_reviewer_idx
  on public.assessment_attempts (reviewer_id);

drop policy "profiles: users read their own profile" on public.profiles;
drop policy "profiles: admins can read profiles" on public.profiles;
create policy "profiles: users or admins can read profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.has_role('admin'));

drop policy "attempts: students read their own attempts" on public.assessment_attempts;
drop policy "attempts: assigned teachers can read submissions" on public.assessment_attempts;
create policy "attempts: students or assigned teachers can read submissions"
on public.assessment_attempts for select to authenticated
using (
  (select auth.uid()) = student_id
  or private.can_review_course(course_id)
);
