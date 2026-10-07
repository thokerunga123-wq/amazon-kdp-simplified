-- ==============================================================================
-- AMAZON KDP SIMPLIFIED - SUPABASE DATABASE SCHEMA
-- Instructor: Thokerunga Innocent
-- Platform: Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. ENUMS
do $$ begin
    create type enrollment_status as enum ('active', 'inactive', 'pending');
exception
    when duplicate_object then null;
end $$;

-- 3. PROFILES TABLE (Linked to Supabase auth.users)
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    email text not null unique,
    is_admin boolean default false,
    device_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 4. COURSES TABLE
create table if not exists public.courses (
    id uuid default uuid_generate_v4() primary key,
    slug text not null unique,
    title text not null,
    description text,
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on courses
alter table public.courses enable row level security;

-- 5. LESSONS TABLE
create table if not exists public.lessons (
    id uuid default uuid_generate_v4() primary key,
    course_id uuid references public.courses(id) on delete cascade not null,
    lesson_number integer not null,
    title text not null,
    description text not null,
    notes text,
    wistia_video_id text not null,
    duration text not null,
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(course_id, lesson_number)
);

-- Enable RLS on lessons
alter table public.lessons enable row level security;

-- 6. ENROLLMENTS TABLE
create table if not exists public.enrollments (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    course_id uuid references public.courses(id) on delete cascade not null,
    status enrollment_status default 'inactive' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, course_id)
);

-- Enable RLS on enrollments
alter table public.enrollments enable row level security;

-- 7. PROGRESS TABLE
create table if not exists public.progress (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    lesson_id uuid references public.lessons(id) on delete cascade not null,
    completed boolean default false not null,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, lesson_id)
);

-- Enable RLS on progress
alter table public.progress enable row level security;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- This whole file is safe to re-run: policies are dropped and re-created.
-- ==============================================================================

-- Helper function: Check if current authenticated user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer stable set search_path = public;

-- PROFILES POLICIES
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
    on public.profiles for all
    using (public.is_admin());

-- SECURITY: logged-in users may only edit their own name directly.
-- is_admin, email and device_id can NOT be changed from the browser.
-- Device binding / resetting happens only through the secure functions below.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, updated_at) on public.profiles to authenticated;

-- COURSES POLICIES
drop policy if exists "Anyone can view active courses" on public.courses;
create policy "Anyone can view active courses"
    on public.courses for select
    using (active = true or public.is_admin());

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
    on public.courses for all
    using (public.is_admin());

-- LESSONS POLICIES
-- Students can only read lesson details (and wistia_video_id) if enrolled and active
drop policy if exists "Enrolled active students can view lessons" on public.lessons;
create policy "Enrolled active students can view lessons"
    on public.lessons for select
    using (
        public.is_admin() or (
            active = true and exists (
                select 1 from public.enrollments e
                where e.user_id = auth.uid()
                  and e.course_id = lessons.course_id
                  and e.status = 'active'
            )
        )
    );

drop policy if exists "Admins can manage lessons" on public.lessons;
create policy "Admins can manage lessons"
    on public.lessons for all
    using (public.is_admin());

-- ENROLLMENTS POLICIES
drop policy if exists "Users can view own enrollment" on public.enrollments;
create policy "Users can view own enrollment"
    on public.enrollments for select
    using (auth.uid() = user_id or public.is_admin());

-- Only admins can insert or update enrollments (students cannot grant themselves access)
drop policy if exists "Admins can manage all enrollments" on public.enrollments;
create policy "Admins can manage all enrollments"
    on public.enrollments for all
    using (public.is_admin())
    with check (public.is_admin());

-- PROGRESS POLICIES
drop policy if exists "Users can view own progress" on public.progress;
create policy "Users can view own progress"
    on public.progress for select
    using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert/update own progress" on public.progress;
create policy "Users can insert/update own progress"
    on public.progress for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.progress;
create policy "Users can update own progress"
    on public.progress for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Admins can view all progress" on public.progress;
create policy "Admins can view all progress"
    on public.progress for all
    using (public.is_admin());

-- ==============================================================================
-- SINGLE-DEVICE LOCK FUNCTIONS (run on the server, cannot be bypassed)
-- ==============================================================================

-- Called by the student at login. Binds the account to this device the first
-- time; afterwards returns 'mismatch' when a different device tries to log in.
-- Returns: 'admin' | 'bound' | 'ok' | 'mismatch'
create or replace function public.bind_device(p_device_id text)
returns text as $$
declare
  v_profile public.profiles%rowtype;
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

  if v_profile.device_id is null then
    update public.profiles
       set device_id = p_device_id, updated_at = now()
     where id = auth.uid();
    return 'bound';
  elsif v_profile.device_id = p_device_id then
    return 'ok';
  else
    return 'mismatch';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Admin-only: clear a student's device lock (new laptop etc.)
create or replace function public.reset_student_device(target_user_id uuid)
returns void as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can reset device locks.';
  end if;

  update public.profiles
  set device_id = null, updated_at = now()
  where id = target_user_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.bind_device(text) from anon;
revoke execute on function public.reset_student_device(uuid) from anon;
grant execute on function public.bind_device(text) to authenticated;
grant execute on function public.reset_student_device(uuid) to authenticated;

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
    default_course_id uuid;
begin
    -- 1. Create student profile.
    -- SECURITY: is_admin is ALWAYS false here. Never trust sign-up metadata for
    -- admin rights (anyone can send metadata with the public anon key).
    -- Make yourself admin with the SQL in the README instead.
    insert into public.profiles (id, full_name, email, is_admin)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Student'),
        new.email,
        false
    )
    on conflict (id) do nothing;

    -- 2. Find primary course ID
    select id into default_course_id from public.courses where slug = 'amazon-kdp-simplified' limit 1;

    -- 3. Create default inactive enrollment if course exists (admin activates after Selar payment)
    if default_course_id is not null then
        insert into public.enrollments (user_id, course_id, status)
        values (new.id, default_course_id, 'inactive')
        on conflict (user_id, course_id) do nothing;
    end if;

    return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger definition
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

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

-- ==============================================================================
-- SEED DATA: COURSE AND 10 PRACTICAL LESSONS
-- ==============================================================================

-- Insert primary course
insert into public.courses (id, slug, title, description, active)
values (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'amazon-kdp-simplified',
    'Amazon KDP Simplified',
    'Publish Your Own Book on Amazon and Earn in Dollars, Even If You Have Never Written Anything Before. Taught by Thokerunga Innocent.',
    true
)
on conflict (slug) do nothing;

-- Insert 10 Lessons
insert into public.lessons (course_id, lesson_number, title, description, notes, wistia_video_id, duration, active)
values
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    1,
    'Amazon KDP From Zero: How the Business Works',
    'Understand what Amazon KDP is, how royalties work, what types of books beginners can create, and the complete process from idea to published book.',
    'Key Takeaways:
• Amazon KDP is print-on-demand: no inventory or shipping required.
• Royalties: 70% or 35% on eBooks, 60% minus printing costs on paperbacks.
• Viable starter genres: Cookbooks, self-help, how-to manuals, journals, planners, faith books, and children''s guides.
• Full workflow: Research -> Plan -> Draft -> Design -> Format -> Publish -> Market -> Scale.
• Action Step: Decide on your commitment to publish your very first book.',
    'WISTIA_VIDEO_ID_1',
    '22 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    2,
    'Set Up Your Amazon KDP Account and Get Paid in Uganda',
    'Learn how to set up your KDP account, complete the required information, handle tax details, and set up payment information correctly.',
    'Key Takeaways:
• Always use 100% genuine identification and contact details.
• Setting up payment options for African and Ugandan authors (Payoneer / Wise USD bank account setup).
• Completing the Amazon Tax Interview with zero withholding issues by submitting your local TIN.
• Account safety: Never create multiple accounts or use fake credentials.
• Action Step: Complete and verify your KDP account profile and payment setup.',
    'WISTIA_VIDEO_ID_2',
    '26 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    3,
    'KDP Market Research: Find Book Ideas People Already Buy',
    'Learn how to research Amazon, study existing books, find demand, check competition, and choose topics with a real market.',
    'Key Takeaways:
• The 5-Point Validation Matrix: Demand, Competition, Buyer Intent, Content Feasibility, Profit Margin.
• Analyzing BSR (Best Sellers Rank) to calculate real daily sales volume.
• Reading 2-star and 3-star reviews to identify unaddressed customer pain points in top books.
• Action Step: Score 5 potential book ideas and select your top #1 winner.',
    'WISTIA_VIDEO_ID_3',
    '31 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    4,
    'KDP Keyword Research: Find Search Terms Buyers Use',
    'Learn how to find useful search terms, understand Amazon autocomplete, study competing books, and build a strong keyword list.',
    'Key Takeaways:
• Using Amazon Incognito autocomplete to see real customer queries.
• Understanding the 7 backend keyword boxes (50 characters each).
• Title and subtitle keyword placement without policy-violating keyword stuffing.
• Action Step: Build a spreadsheet of 15-20 validated customer search terms.',
    'WISTIA_VIDEO_ID_4',
    '24 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    5,
    'Create Your Book With AI: From Idea to Complete Draft',
    'Learn how to build an outline, create chapters with AI, improve the writing, fact-check and edit the manuscript, and prepare it for formatting.',
    'Key Takeaways:
• Building comprehensive, reader-focused chapter outlines.
• Prompting AI iteratively chapter-by-chapter rather than asking for full books at once.
• Eliminating fluff, passive tone, and repetitive phrasing.
• Fact-checking and infusing personal author perspective and structured value.
• Action Step: Complete your clean, edited manuscript in MS Word or Google Docs.',
    'WISTIA_VIDEO_ID_5',
    '38 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    6,
    'Create a Professional KDP Cover With AI',
    'Learn how to plan a cover, choose fonts and colors, create images with AI, and prepare a cover that fits Amazon''s technical requirements.',
    'Key Takeaways:
• Amazon KDP cover dimension requirements (front cover for eBook, full wrap with spine and bleed for paperback).
• Genre typography hierarchy: title readability even at thumbnail size.
• Generating high-res focal artwork and cleaning up layout in design tools.
• Action Step: Export your final high-resolution print PDF full wrap and eBook JPG cover.',
    'WISTIA_VIDEO_ID_6',
    '27 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    7,
    'Format Your Book With Book Formatter Pro',
    'Learn how to turn a raw manuscript into a clean, professional KDP interior using Book Formatter Pro.',
    'Key Takeaways:
• Standard KDP trim sizes (6x9 inches, 5.5x8.5 inches, 8.5x11 inches).
• Setting margins, gutters, alternating headers/footers, and page numbering.
• Clean typography, automatic Table of Contents, chapter openers, and section breaks.
• Exporting a 100% compliant, print-ready PDF interior in minutes.
• Action Step: Run your manuscript through Book Formatter Pro and inspect the PDF.',
    'WISTIA_VIDEO_ID_7',
    '25 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    8,
    'Publish Your eBook and Paperback on Amazon KDP',
    'Walk through the KDP publishing process, book details, manuscript upload, cover upload, preview, pricing, territories, and publishing.',
    'Key Takeaways:
• Step 1: Paperback & eBook metadata (Title, Subtitle, Author, Description with HTML formatting).
• Step 2: Content upload, KDP Print Previewer inspection, ISBN selection.
• Step 3: Rights, pricing strategy ($2.99 - $9.99 for eBooks, competitive paperback pricing), and royalties.
• Action Step: Click "Publish Your Paperback Book" and submit for Amazon review.',
    'WISTIA_VIDEO_ID_8',
    '32 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    9,
    'Get Your First KDP Sales: Reviews, Promotion and Amazon Ads',
    'Learn simple ways to market a new book, encourage legitimate reviews, use basic promotion methods, and understand when Amazon Ads may make sense.',
    'Key Takeaways:
• Launching with an Advance Review Team (ARC) legitimately within Amazon terms.
• Organic sharing: leveraging social channels, community groups, and WhatsApp.
• Amazon Ads fundamentals: Sponsored Product auto-targeting vs manual keyword targeting.
• Managing ad spend strictly to protect profitability.
• Action Step: Launch your first $2-5/day discovery campaign and request honest reviews.',
    'WISTIA_VIDEO_ID_9',
    '28 mins',
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    10,
    'Build Your KDP Business: More Books, Series and Long-Term Growth',
    'Learn how to repeat the process, build related books, create series, improve old books, and build a larger KDP catalog over time.',
    'Key Takeaways:
• The compound effect: why 5-10 targeted books multiply your monthly royalties.
• Creating thematic series to boost read-through and organic Amazon cross-recommendations.
• Iterating existing catalog: testing new covers and optimized keyword descriptions.
• The 90-Day Publisher Roadmap: Month 1 (Launch), Month 2 (Scale), Month 3 (Series).
• Action Step: Plan titles 2, 3, and 4 in your author catalog.',
    'WISTIA_VIDEO_ID_10',
    '21 mins',
    true
)
on conflict (course_id, lesson_number) do nothing;
