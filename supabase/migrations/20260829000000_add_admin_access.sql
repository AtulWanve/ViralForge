-- Promote the seed admin account so it has admin role enforced server-side.
update public.users
set role = 'admin'
where email = 'admin@viralforge.test';

-- Non-recursive admin check. A SECURITY DEFINER function runs as its owner
-- (the migration executor), bypassing RLS on public.users, so reading role
-- here cannot recurse into any "Admins can read all users" policy.
create or replace function public.is_admin()
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
end;
$$;

-- Admin read-only policies (SELECT only) across the user-facing tables.
-- Least-privilege: admins may inspect every user and their projects/assets,
-- but may not mutate rows belonging to others through RLS.
create policy "Admins can read all users" on public.users
  for select
  using (public.is_admin());

create policy "Admins can read all projects" on public.projects
  for select
  using (public.is_admin());

create policy "Admins can read all generated assets" on public.generated_assets
  for select
  using (public.is_admin());