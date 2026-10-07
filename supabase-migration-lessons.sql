-- =============================================================================
-- Let the admin delete and reorder lessons from the Admin > Lessons tab.
-- (Adding and editing lessons already works through the admin's table access.)
-- Safe to run more than once.
-- =============================================================================

-- Delete a lesson and close the gap (later lessons move up one number)
create or replace function public.delete_lesson(p_course uuid, p_number int)
returns void as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can delete lessons.';
  end if;

  delete from public.lessons where course_id = p_course and lesson_number = p_number;

  -- Two steps (via negative numbers) so the unique (course, number) rule is never broken
  update public.lessons set lesson_number = -(lesson_number - 1)
   where course_id = p_course and lesson_number > p_number;
  update public.lessons set lesson_number = -lesson_number
   where course_id = p_course and lesson_number < 0;
end;
$$ language plpgsql security definer set search_path = public;

-- Swap a lesson with the one above (p_direction = -1) or below (p_direction = 1)
create or replace function public.move_lesson(p_course uuid, p_number int, p_direction int)
returns void as $$
declare
  v_target int := p_number + sign(p_direction)::int;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can reorder lessons.';
  end if;
  if not exists (select 1 from public.lessons where course_id = p_course and lesson_number = v_target)
     or not exists (select 1 from public.lessons where course_id = p_course and lesson_number = p_number) then
    return;
  end if;

  update public.lessons set lesson_number = -v_target where course_id = p_course and lesson_number = p_number;
  update public.lessons set lesson_number = p_number where course_id = p_course and lesson_number = v_target;
  update public.lessons set lesson_number = v_target where course_id = p_course and lesson_number = -v_target;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.delete_lesson(uuid, int) from anon;
revoke execute on function public.move_lesson(uuid, int, int) from anon;
grant execute on function public.delete_lesson(uuid, int) to authenticated;
grant execute on function public.move_lesson(uuid, int, int) to authenticated;
