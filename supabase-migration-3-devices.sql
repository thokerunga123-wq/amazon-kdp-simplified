-- =============================================================================
-- Allow each student to use up to 3 devices (replaces the 1-device lock)
-- Safe to run more than once.
-- =============================================================================

-- 1. List of devices per student (existing single device is kept as device #1)
alter table public.profiles add column if not exists device_ids text[] not null default '{}';

update public.profiles
   set device_ids = array[device_id]
 where device_id is not null
   and coalesce(array_length(device_ids, 1), 0) = 0;

-- 2. Login check: allow known devices, add new ones until the limit is reached
create or replace function public.bind_device(p_device_id text)
returns text as $$
declare
  v_profile public.profiles%rowtype;
  v_max int := 3;   -- maximum devices per student
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'Invalid device id';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.is_admin then
    return 'admin';
  end if;

  if p_device_id = any(v_profile.device_ids) then
    return 'ok';
  end if;

  if coalesce(array_length(v_profile.device_ids, 1), 0) < v_max then
    update public.profiles
       set device_ids = array_append(device_ids, p_device_id),
           device_id = coalesce(device_id, p_device_id),
           updated_at = now()
     where id = auth.uid();
    return 'bound';
  end if;

  return 'mismatch';
end;
$$ language plpgsql security definer set search_path = public;

-- 3. Admin reset clears all of a student's devices
create or replace function public.reset_student_device(target_user_id uuid)
returns void as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can reset device locks.';
  end if;

  update public.profiles
     set device_id = null, device_ids = '{}', updated_at = now()
   where id = target_user_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Students still cannot edit their own device list directly
revoke update on public.profiles from authenticated, anon;
grant update (full_name, updated_at) on public.profiles to authenticated;
grant execute on function public.bind_device(text) to authenticated;
grant execute on function public.reset_student_device(uuid) to authenticated;
