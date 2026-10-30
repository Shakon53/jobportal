create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('job_seeker', 'employer')),
  created_at timestamptz not null default now()
);

create table public.employer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  company_name text not null,
  company_description text not null default '',
  company_website text not null default '',
  location text not null default '',
  phone text not null default '',
  industry text not null default '',
  company_logo_path text
);

create table public.job_seeker_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  skills text not null default '',
  experience text not null default '',
  education text not null default '',
  resume_path text
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default ''
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles (user_id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text not null,
  requirements text not null default '',
  location text not null,
  salary text,
  job_type text not null check (job_type in ('full_time', 'part_time', 'contract', 'internship')),
  posted_at timestamptz not null default now(),
  deadline date,
  is_active boolean not null default true
);

create index jobs_active_posted_at_idx on public.jobs (posted_at desc) where is_active;
create index jobs_employer_id_idx on public.jobs (employer_id);
create index jobs_category_id_idx on public.jobs (category_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  job_seeker_id uuid not null references public.job_seeker_profiles (user_id) on delete cascade,
  cover_letter text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'accepted', 'rejected')),
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, job_seeker_id)
);

create index applications_job_seeker_id_idx on public.applications (job_seeker_id);

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_role text := new.raw_user_meta_data ->> 'role';
  account_username text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
begin
  if account_role not in ('job_seeker', 'employer') then
    raise exception 'Choose a valid account type.';
  end if;

  insert into public.profiles (id, username, role)
  values (new.id, account_username, account_role);

  if account_role = 'employer' then
    insert into public.employer_profiles (user_id, company_name)
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'company_name'), '')
    );
  else
    insert into public.job_seeker_profiles (user_id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.role <> old.role then
    raise exception 'Profile identity and account type cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger profiles_identity_immutable
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

create function public.update_application_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger applications_update_timestamp
  before update on public.applications
  for each row execute function public.update_application_timestamp();

alter table public.profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.job_seeker_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "Profiles are visible to their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Profiles are editable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Employer company details are public"
  on public.employer_profiles for select to anon, authenticated
  using (true);

create policy "Employers can create their company profile"
  on public.employer_profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'employer'
    )
  );

create policy "Employers can update their company profile"
  on public.employer_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Employers can delete their company profile"
  on public.employer_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Job seeker profiles are private to their owner"
  on public.job_seeker_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Job seeker profiles can be edited by their owner"
  on public.job_seeker_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Categories are publicly readable"
  on public.categories for select to anon, authenticated
  using (true);

create policy "Active jobs are public and employers can view their own jobs"
  on public.jobs for select to anon, authenticated
  using (is_active or employer_id = (select auth.uid()));

create policy "Employers can publish their own jobs"
  on public.jobs for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'employer'
    )
  );

create policy "Employers can update their own jobs"
  on public.jobs for update to authenticated
  using (employer_id = (select auth.uid()))
  with check (employer_id = (select auth.uid()));

create policy "Employers can delete their own jobs"
  on public.jobs for delete to authenticated
  using (employer_id = (select auth.uid()));

create policy "Job seekers can view their own applications"
  on public.applications for select to authenticated
  using (job_seeker_id = (select auth.uid()));

create policy "Job seekers can apply to active jobs once"
  on public.applications for insert to authenticated
  with check (
    job_seeker_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'job_seeker'
    )
    and exists (
      select 1 from public.jobs
      where id = job_id and is_active
    )
  );

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.jobs to anon, authenticated;
revoke select on public.employer_profiles from anon, authenticated;
grant select (user_id, company_name, industry) on public.employer_profiles to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.job_seeker_profiles to authenticated;
grant insert, update, delete on public.employer_profiles, public.jobs to authenticated;
revoke insert, update, delete on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant insert (job_id, job_seeker_id, cover_letter) on public.applications to authenticated;

insert into public.categories (name, icon) values
  ('Technology', '⌘'),
  ('Design', '✳'),
  ('Marketing', '↗'),
  ('Business', '◈')
on conflict (name) do nothing;
