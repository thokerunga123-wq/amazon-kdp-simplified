-- =====================================================================
-- Amazon KDP Simplified — Multiple admins (maximum 4)
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → Run
-- Safe to run again (it replaces the functions/trigger).
-- =====================================================================

-- 1. Helper: is the logged-in user an admin?
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 2. Guard on the profiles table:
--    * only an existing admin (or the Supabase dashboard / service role) can change is_admin
--    * never more than 4 admins
--    * never remove the last admin
create or replace function public.guard_admin_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  if tg_op = 'UPDATE' and new.is_admin is not distinct from old.is_admin then
    return new;
  end if;
  if tg_op = 'INSERT' and coalesce(new.is_admin, false) = false then
    return new;
  end if;

  -- Requests from the SQL editor / service role have no auth.uid(); allow those.
  if auth.uid() is not null and not public.is_current_user_admin() then
    raise exception 'Only an admin can change admin access.';
  end if;

  if coalesce(new.is_admin, false) = true then
    select count(*) into admin_count from public.profiles where is_admin = true and id <> new.id;
    if admin_count >= 4 then
      raise exception 'This course already has 4 admins. Remove one before adding another.';
    end if;
  else
    select count(*) into admin_count from public.profiles where is_admin = true and id <> new.id;
    if admin_count = 0 then
      raise exception 'You cannot remove the last admin.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_admin_changes on public.profiles;
create trigger trg_guard_admin_changes
  before insert or update of is_admin on public.profiles
  for each row execute function public.guard_admin_changes();

-- 3. List admins (admins only)
create or replace function public.list_admins()
returns table (id uuid, full_name text, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Only admins can view the admin list.';
  end if;
  return query
    select p.id, p.full_name::text, p.email::text, p.created_at::timestamptz
    from public.profiles p
    where p.is_admin = true
    order by p.created_at;
end;
$$;

-- 4. Make an existing account an admin, by email
create or replace function public.add_admin(target_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles%rowtype;
  admin_count int;
begin
  if not public.is_current_user_admin() then
    raise exception 'Only admins can add admins.';
  end if;

  select * into target from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if not found then
    raise exception 'No account found for %. Add them as a student first, then make them an admin.', target_email;
  end if;

  if target.is_admin then
    raise exception '% is already an admin.', target.email;
  end if;

  select count(*) into admin_count from public.profiles where is_admin = true;
  if admin_count >= 4 then
    raise exception 'This course already has 4 admins. Remove one before adding another.';
  end if;

  update public.profiles set is_admin = true where id = target.id;

  return json_build_object('id', target.id, 'email', target.email, 'full_name', target.full_name);
end;
$$;

-- 5. Remove admin access (you cannot remove yourself or the last admin)
create or replace function public.remove_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  if not public.is_current_user_admin() then
    raise exception 'Only admins can remove admins.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot remove your own admin access. Ask another admin to do it.';
  end if;

  select count(*) into admin_count from public.profiles where is_admin = true;
  if admin_count <= 1 then
    raise exception 'You cannot remove the last admin.';
  end if;

  update public.profiles set is_admin = false where id = target_user_id and is_admin = true;
end;
$$;

-- 6. Only logged-in users may call these (each one re-checks admin status itself)
revoke all on function public.list_admins() from public, anon;
revoke all on function public.add_admin(text) from public, anon;
revoke all on function public.remove_admin(uuid) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;
grant execute on function public.is_current_user_admin() to authenticated;
