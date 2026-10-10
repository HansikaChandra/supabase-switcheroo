-- Kampus.VC marketplace schema for Supabase.
-- Apply with `supabase db push` or paste this file into the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role text not null check (role in ('brand', 'creator')),
  avatar_url text,
  location text,
  bio text,
  company_name text,
  industry text,
  is_public boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_demo or auth_user_id = id)
);

alter table public.profiles add column if not exists industry text;

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  headline text,
  bio text,
  specializations text[] not null default '{}',
  skills text[] not null default '{}',
  ai_tools text[] not null default '{}',
  ai_models text[] not null default '{}',
  content_types text[] not null default '{}',
  supported_formats text[] not null default '{}',
  aspect_ratios text[] not null default '{}',
  workflow text,
  availability_status text not null default 'available'
    check (availability_status in ('available', 'limited', 'unavailable')),
  experience_years integer not null default 0 check (experience_years >= 0),
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  commercial_use_supported boolean not null default false,
  commercial_use_details text,
  rating numeric(3, 2) not null default 0 check (rating between 0 and 5),
  completed_projects integer not null default 0 check (completed_projects >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  media_url text,
  thumbnail_url text,
  media_type text not null default 'image'
    check (media_type in ('image', 'video', 'animation', '3d', 'other')),
  content_type text,
  tools text[] not null default '{}',
  models text[] not null default '{}',
  skills text[] not null default '{}',
  specialization text,
  workflow text,
  format text,
  aspect_ratio text,
  commercial_use boolean not null default false,
  commercial_use_details text,
  project_context text,
  client_name text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_signals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  tool_usage_status text not null default 'self_declared'
    check (tool_usage_status in ('self_declared', 'submitted', 'reviewed')),
  workflow_status text not null default 'self_declared'
    check (workflow_status in ('self_declared', 'submitted', 'reviewed')),
  past_work_status text not null default 'self_declared'
    check (past_work_status in ('self_declared', 'submitted', 'reviewed')),
  tool_usage_notes text,
  workflow_notes text,
  past_work_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id)
);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company_name text,
  description text,
  objective text,
  target_audience text,
  content_type text,
  visual_style text,
  required_tools text[] not null default '{}',
  required_skills text[] not null default '{}',
  formats text[] not null default '{}',
  aspect_ratio text,
  number_of_deliverables integer not null default 1 check (number_of_deliverables > 0),
  budget_min numeric(12, 2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(12, 2) check (budget_max is null or budget_max >= 0),
  currency text not null default 'USD',
  deadline date,
  commercial_use boolean not null default false,
  licensing_requirements text,
  reference_links text[] not null default '{}',
  additional_requirements text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  proposal text not null,
  relevant_portfolio_id uuid references public.portfolio_items(id) on delete set null,
  proposed_price numeric(12, 2) check (proposed_price is null or proposed_price >= 0),
  estimated_timeline text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  brand_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  match_score numeric(5, 2) not null check (match_score between 0 and 100),
  skills_score numeric(5, 2) not null default 0,
  portfolio_score numeric(5, 2) not null default 0,
  tools_score numeric(5, 2) not null default 0,
  format_score numeric(5, 2) not null default 0,
  other_score numeric(5, 2) not null default 0,
  match_explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete restrict,
  brand_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  current_stage text not null default 'brief_confirmed'
    check (current_stage in ('brief_confirmed', 'concept', 'generation', 'editing', 'review', 'revisions', 'final_delivery', 'completed')),
  agreed_budget numeric(12, 2) check (agreed_budget is null or agreed_budget >= 0),
  agreed_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_url text,
  thumbnail_url text,
  version integer not null default 1 check (version > 0),
  description text,
  notes text,
  is_final boolean not null default false,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'revision_requested', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, creator_id, title, version)
);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  unique (engagement_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  reference_type text,
  reference_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  brief_id uuid not null references public.briefs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, brief_id)
);

create index if not exists profiles_public_role_idx on public.profiles (role, is_public);
create index if not exists creator_profiles_user_idx on public.creator_profiles (user_id);
create index if not exists portfolio_items_creator_published_idx on public.portfolio_items (creator_id, is_published);
create index if not exists briefs_status_created_idx on public.briefs (status, created_at desc);
create index if not exists briefs_brand_status_idx on public.briefs (brand_id, status);
create index if not exists applications_brief_status_idx on public.applications (brief_id, status);
create index if not exists applications_creator_created_idx on public.applications (creator_id, created_at desc);
create index if not exists invitations_creator_status_idx on public.invitations (creator_id, status);
create index if not exists matches_brief_score_idx on public.matches (brief_id, match_score desc);
create index if not exists engagements_participants_idx on public.engagements (brand_id, creator_id, status);
create index if not exists deliverables_engagement_created_idx on public.deliverables (engagement_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, is_read, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_role text;
  selected_name text;
  selected_specialization text;
begin
  selected_role := new.raw_user_meta_data ->> 'role';
  if selected_role not in ('creator', 'brand') then
    raise exception 'A valid marketplace role is required';
  end if;
  selected_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'New member'), '@', 1));
  selected_specialization := nullif(trim(new.raw_user_meta_data ->> 'specialization'), '');

  insert into public.profiles (id, auth_user_id, full_name, email, role, company_name, industry)
  values (
    new.id, new.id, selected_name, new.email, selected_role,
    nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'industry'), '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name, email = excluded.email, updated_at = now();

  if selected_role = 'creator' then
    insert into public.creator_profiles (user_id, headline, specializations)
    values (new.id, selected_specialization, case when selected_specialization is null then '{}'::text[] else array[selected_specialization] end)
    on conflict (user_id) do update
      set headline = coalesce(public.creator_profiles.headline, excluded.headline),
          specializations = case
            when cardinality(public.creator_profiles.specializations) = 0 and cardinality(excluded.specializations) > 0
              then excluded.specializations
            else public.creator_profiles.specializations
          end;
    insert into public.verification_signals (creator_id)
    select id from public.creator_profiles where user_id = new.id
    on conflict (creator_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kampus_vc on auth.users;
create trigger on_auth_user_created_kampus_vc
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.role is distinct from old.role
     or (new.is_demo is distinct from old.is_demo and coalesce(auth.role(), '') <> 'service_role') then
    raise exception 'Profile identity and role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_trigger on public.profiles;
create trigger protect_profile_identity_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

create or replace function public.prevent_self_reviewed_signal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
begin
  select cp.user_id into owner_id from public.creator_profiles cp where cp.id = new.creator_id;
  if owner_id = auth.uid()
     and ('reviewed' in (new.tool_usage_status, new.workflow_status, new.past_work_status)) then
    raise exception 'Creators cannot mark their own verification signals as reviewed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_reviewed_signal_trigger on public.verification_signals;
create trigger prevent_self_reviewed_signal_trigger
  before insert or update on public.verification_signals
  for each row execute function public.prevent_self_reviewed_signal();

create or replace function public.notify_application_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
  brief_title text;
begin
  select b.brand_id, b.title into recipient_id, brief_title
  from public.briefs b where b.id = new.brief_id;
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
  values (recipient_id, 'application_received', 'New creator application',
    'A creator applied to ' || coalesce(brief_title, 'your brief') || '.', 'application', new.id);
  return new;
end;
$$;

create or replace function public.notify_application_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
    values (new.creator_id, 'application_status', 'Application updated',
      'Your application status is now ' || replace(new.status, '_', ' ') || '.', 'application', new.id);
  end if;
  return new;
end;
$$;

create or replace function public.create_engagement_for_accepted_application()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  project public.briefs%rowtype;
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    select * into project from public.briefs where id = new.brief_id;
    if project.id is not null then
      insert into public.engagements (brief_id, brand_id, creator_id, agreed_budget, agreed_deadline)
      values (project.id, project.brand_id, new.creator_id, coalesce(new.proposed_price, project.budget_min), project.deadline)
      on conflict (brief_id, creator_id) do nothing;
      update public.briefs set status = 'in_progress', updated_at = now()
      where id = project.id and status = 'published';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  brief_title text;
begin
  select title into brief_title from public.briefs where id = new.brief_id;
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
  values (new.creator_id, 'invitation_received', 'New project invitation',
    'You have been invited to ' || coalesce(brief_title, 'a creative project') || '.', 'invitation', new.id);
  return new;
end;
$$;

create or replace function public.create_engagement_for_accepted_invitation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  project public.briefs%rowtype;
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    select * into project from public.briefs where id = new.brief_id;
    if project.id is not null then
      insert into public.engagements (brief_id, brand_id, creator_id, agreed_budget, agreed_deadline)
      values (project.id, new.brand_id, new.creator_id, project.budget_min, project.deadline)
      on conflict (brief_id, creator_id) do nothing;
      update public.briefs set status = 'in_progress', updated_at = now()
      where id = project.id and status = 'published';
    end if;
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
    values (new.brand_id, 'invitation_status', 'Invitation response',
      'Your invitation was ' || replace(new.status, '_', ' ') || '.', 'invitation', new.id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_deliverable_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
begin
  select brand_id into recipient_id from public.engagements where id = new.engagement_id;
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
  values (recipient_id, 'deliverable_submitted', 'New deliverable submitted',
    'A new version of "' || new.title || '" is ready for review.', 'deliverable', new.id);
  return new;
end;
$$;

create or replace function public.notify_revision_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
begin
  select creator_id into recipient_id from public.engagements where id = new.engagement_id;
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
  values (recipient_id, 'revision_requested', 'Revision requested',
    'The brand left feedback on a deliverable.', 'revision', new.id);
  return new;
end;
$$;

create or replace function public.complete_engagement_on_final_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  engagement_row public.engagements%rowtype;
begin
  if new.status = 'approved' and new.is_final and old.status is distinct from new.status then
    select * into engagement_row from public.engagements where id = new.engagement_id;
    if engagement_row.id is not null and engagement_row.status <> 'completed' then
      update public.engagements set status = 'completed', current_stage = 'completed', updated_at = now()
      where id = engagement_row.id;
      update public.briefs set status = 'completed', updated_at = now()
      where id = engagement_row.brief_id;
      update public.creator_profiles set completed_projects = completed_projects + 1, updated_at = now()
      where user_id = engagement_row.creator_id;
      insert into public.notifications (user_id, type, title, message, reference_type, reference_id)
      values (engagement_row.creator_id, 'project_completed', 'Project completed',
        'The final deliverable was approved.', 'engagement', engagement_row.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.update_creator_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.creator_profiles cp
  set rating = coalesce((
    select round(avg(r.rating)::numeric, 2)
    from public.reviews r
    where r.reviewee_id = cp.user_id
  ), 0),
  updated_at = now()
  where cp.user_id = new.reviewee_id;
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists creator_profiles_updated_at on public.creator_profiles;
create trigger creator_profiles_updated_at before update on public.creator_profiles for each row execute function public.set_updated_at();
drop trigger if exists portfolio_items_updated_at on public.portfolio_items;
create trigger portfolio_items_updated_at before update on public.portfolio_items for each row execute function public.set_updated_at();
drop trigger if exists verification_signals_updated_at on public.verification_signals;
create trigger verification_signals_updated_at before update on public.verification_signals for each row execute function public.set_updated_at();
drop trigger if exists briefs_updated_at on public.briefs;
create trigger briefs_updated_at before update on public.briefs for each row execute function public.set_updated_at();
drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();
drop trigger if exists invitations_updated_at on public.invitations;
create trigger invitations_updated_at before update on public.invitations for each row execute function public.set_updated_at();
drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at before update on public.matches for each row execute function public.set_updated_at();
drop trigger if exists engagements_updated_at on public.engagements;
create trigger engagements_updated_at before update on public.engagements for each row execute function public.set_updated_at();
drop trigger if exists deliverables_updated_at on public.deliverables;
create trigger deliverables_updated_at before update on public.deliverables for each row execute function public.set_updated_at();

drop trigger if exists application_created_notification on public.applications;
create trigger application_created_notification after insert on public.applications for each row execute function public.notify_application_created();
drop trigger if exists application_status_notification on public.applications;
create trigger application_status_notification after update on public.applications for each row execute function public.notify_application_status_changed();
drop trigger if exists application_accepted_engagement on public.applications;
create trigger application_accepted_engagement after update on public.applications for each row execute function public.create_engagement_for_accepted_application();
drop trigger if exists invitation_created_notification on public.invitations;
create trigger invitation_created_notification after insert on public.invitations for each row execute function public.notify_invitation_created();
drop trigger if exists invitation_status_engagement on public.invitations;
create trigger invitation_status_engagement after update on public.invitations for each row execute function public.create_engagement_for_accepted_invitation();
drop trigger if exists deliverable_created_notification on public.deliverables;
create trigger deliverable_created_notification after insert on public.deliverables for each row execute function public.notify_deliverable_created();
drop trigger if exists revision_created_notification on public.revisions;
create trigger revision_created_notification after insert on public.revisions for each row execute function public.notify_revision_created();
drop trigger if exists final_deliverable_approved on public.deliverables;
create trigger final_deliverable_approved after update on public.deliverables for each row execute function public.complete_engagement_on_final_approval();
drop trigger if exists review_updates_rating on public.reviews;
create trigger review_updates_rating after insert on public.reviews for each row execute function public.update_creator_rating();

create or replace function public.is_current_user_role(target_id uuid, required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_id
      and p.auth_user_id = auth.uid()
      and p.role = required_role
      and not p.is_demo
  );
$$;

create or replace function public.owns_brief(target_brief_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.briefs b
    where b.id = target_brief_id and b.brand_id = auth.uid()
  );
$$;

create or replace function public.is_engagement_participant(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.engagements e
    where e.id = target_engagement_id
      and auth.uid() in (e.brand_id, e.creator_id)
  );
$$;

create or replace function public.array_match_score(required_values text[], offered_values text[])
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when cardinality(coalesce(required_values, '{}'::text[])) = 0 then 100::numeric
    else coalesce(round(
      100.0 * (
        select count(distinct lower(trim(required_value)))
        from unnest(required_values) as req(required_value)
        where trim(required_value) <> ''
          and exists (
            select 1 from unnest(coalesce(offered_values, '{}'::text[])) as offered(offered_value)
            where lower(trim(offered_value)) = lower(trim(required_value))
          )
      ) / nullif((
        select count(distinct lower(trim(required_value)))
        from unnest(required_values) as req(required_value)
        where trim(required_value) <> ''
      ), 0),
      2
    ), 100::numeric)
  end;
$$;

create or replace function public.match_creators_for_brief(target_brief_id uuid)
returns table (
  creator_id uuid,
  creator_profile_id uuid,
  full_name text,
  avatar_url text,
  headline text,
  specializations text[],
  skills text[],
  ai_tools text[],
  aspect_ratios text[],
  rating numeric,
  completed_projects integer,
  is_demo boolean,
  match_score numeric,
  skills_score numeric,
  portfolio_score numeric,
  tools_score numeric,
  format_score numeric,
  other_score numeric,
  match_explanation jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_current_user_role(auth.uid(), 'brand') then
    raise exception 'Only signed-in brands can generate creator matches';
  end if;

  if not exists (
    select 1 from public.briefs b
    where b.id = target_brief_id and b.brand_id = auth.uid()
  ) then
    raise exception 'Brief not found or not owned by the current brand';
  end if;

  return query
  with brief_row as (
    select b.*
    from public.briefs b
    where b.id = target_brief_id
  ),
  candidates as (
    select
      p.id as candidate_creator_id,
      cp.id as candidate_profile_id,
      p.full_name as candidate_name,
      p.avatar_url as candidate_avatar,
      cp.headline as candidate_headline,
      cp.specializations as candidate_specializations,
      cp.skills as candidate_skills,
      cp.ai_tools as candidate_tools,
      cp.aspect_ratios as candidate_ratios,
      cp.rating as candidate_rating,
      cp.completed_projects as candidate_completed,
      p.is_demo as candidate_demo,
      public.array_match_score(b.required_skills, cp.skills || cp.specializations) as score_skills,
      public.array_match_score(b.required_tools, cp.ai_tools) as score_tools,
      (
        public.array_match_score(b.formats, cp.supported_formats)
        + public.array_match_score(
            case when nullif(trim(b.aspect_ratio), '') is null then '{}'::text[] else array[b.aspect_ratio] end,
            cp.aspect_ratios
          )
      ) / 2 as score_format,
      (
        case when b.commercial_use and cp.commercial_use_supported then 100
             when b.commercial_use then 0 else 100 end * 0.7
        + case when cp.availability_status = 'available' then 100
               when cp.availability_status = 'limited' then 60 else 0 end * 0.3
      ) as score_other,
      coalesce((
        select max(
          (case
            when nullif(trim(b.content_type), '') is not null
              and lower(coalesce(pi.content_type, '')) = lower(b.content_type) then 40 else 0
          end)
          + (case
            when cardinality(b.required_skills) > 0
              then public.array_match_score(b.required_skills, pi.skills) * 0.35
            else 35
          end)
          + (case
            when nullif(trim(b.aspect_ratio), '') is not null
              and lower(coalesce(pi.aspect_ratio, '')) = lower(b.aspect_ratio) then 25
            when nullif(trim(b.aspect_ratio), '') is null then 25
            else 0
          end)
        )
        from public.portfolio_items pi
        where pi.creator_id = cp.user_id and pi.is_published = true
      ), 0) as score_portfolio
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
    cross join brief_row b
    where p.role = 'creator' and p.is_public = true
  ),
  scored as (
    select
      c.*,
      round((
        c.score_skills * 0.30
        + c.score_portfolio * 0.25
        + c.score_tools * 0.20
        + c.score_format * 0.15
        + c.score_other * 0.10
      )::numeric, 2) as total_score
    from candidates c
  ),
  persisted as (
    insert into public.matches as existing_match (
      brief_id, creator_id, match_score, skills_score, portfolio_score,
      tools_score, format_score, other_score, match_explanation
    )
    select
      target_brief_id,
      s.candidate_creator_id,
      s.total_score,
      s.score_skills,
      s.score_portfolio,
      s.score_tools,
      s.score_format,
      s.score_other,
      jsonb_build_object(
        'weights', jsonb_build_object('skills', 30, 'portfolio', 25, 'tools', 20, 'format', 15, 'other', 10),
        'skills', s.score_skills,
        'portfolio', s.score_portfolio,
        'tools', s.score_tools,
        'format', s.score_format,
        'other', s.score_other,
        'demoProfile', s.candidate_demo
      )
    from scored s
    on conflict (brief_id, creator_id) do update set
      match_score = excluded.match_score,
      skills_score = excluded.skills_score,
      portfolio_score = excluded.portfolio_score,
      tools_score = excluded.tools_score,
      format_score = excluded.format_score,
      other_score = excluded.other_score,
      match_explanation = excluded.match_explanation,
      updated_at = now()
    returning existing_match.creator_id
  )
  select
    s.candidate_creator_id,
    s.candidate_profile_id,
    s.candidate_name,
    s.candidate_avatar,
    s.candidate_headline,
    s.candidate_specializations,
    s.candidate_skills,
    s.candidate_tools,
    s.candidate_ratios,
    s.candidate_rating,
    s.candidate_completed,
    s.candidate_demo,
    s.total_score,
    round(s.score_skills::numeric, 2),
    round(s.score_portfolio::numeric, 2),
    round(s.score_tools::numeric, 2),
    round(s.score_format::numeric, 2),
    round(s.score_other::numeric, 2),
    jsonb_build_object(
      'weights', jsonb_build_object('skills', 30, 'portfolio', 25, 'tools', 20, 'format', 15, 'other', 10),
      'skills', s.score_skills,
      'portfolio', s.score_portfolio,
      'tools', s.score_tools,
      'format', s.score_format,
      'other', s.score_other,
      'reasons', jsonb_build_array(
        case when cardinality((select required_skills from brief_row)) > 0 then 'Skills and specialization fit' end,
        case when cardinality((select required_tools from brief_row)) > 0 then 'AI tool match' end,
        case when (select nullif(trim(aspect_ratio), '') from brief_row) is not null then 'Aspect ratio compatibility' end,
        case when s.candidate_demo then 'Sample creator profile' end
      )
    )
  from scored s
  cross join (select count(*) from persisted) persistence_guard
  order by s.total_score desc, s.candidate_name;
end;
$$;

create or replace function public.guard_application_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  brand_owner uuid;
begin
  select b.brand_id into brand_owner from public.briefs b where b.id = old.brief_id;
  if new.brief_id is distinct from old.brief_id
     or new.creator_id is distinct from old.creator_id
     or new.proposal is distinct from old.proposal
     or new.relevant_portfolio_id is distinct from old.relevant_portfolio_id
     or new.proposed_price is distinct from old.proposed_price
     or new.estimated_timeline is distinct from old.estimated_timeline then
    raise exception 'Application details cannot be changed after submission';
  end if;

  if auth.uid() = old.creator_id then
    if new.status not in ('withdrawn', old.status) then
      raise exception 'Creators may only withdraw their application';
    end if;
  elsif auth.uid() = brand_owner then
    if new.status not in ('under_review', 'shortlisted', 'accepted', 'rejected', old.status) then
      raise exception 'Invalid brand application decision';
    end if;
  else
    raise exception 'Only application participants may update this application';
  end if;
  return new;
end;
$$;

create or replace function public.guard_invitation_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.brief_id is distinct from old.brief_id
     or new.brand_id is distinct from old.brand_id
     or new.creator_id is distinct from old.creator_id
     or new.message is distinct from old.message then
    raise exception 'Invitation details cannot be changed after sending';
  end if;
  if auth.uid() = old.creator_id and new.status not in ('accepted', 'declined', old.status) then
    raise exception 'Creators may only accept or decline an invitation';
  end if;
  if auth.uid() = old.brand_id and new.status not in ('cancelled', old.status) then
    raise exception 'Brands may only cancel an invitation';
  end if;
  return new;
end;
$$;

create or replace function public.guard_engagement_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.brief_id is distinct from old.brief_id
     or new.brand_id is distinct from old.brand_id
     or new.creator_id is distinct from old.creator_id
     or new.agreed_budget is distinct from old.agreed_budget
     or new.agreed_deadline is distinct from old.agreed_deadline then
    raise exception 'Engagement participants and agreed terms cannot be changed here';
  end if;
  if auth.uid() not in (old.brand_id, old.creator_id) then
    raise exception 'Only engagement participants may update the project stage';
  end if;
  return new;
end;
$$;

create or replace function public.guard_deliverable_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  brand_owner uuid;
begin
  select e.brand_id into brand_owner from public.engagements e where e.id = old.engagement_id;
  if new.engagement_id is distinct from old.engagement_id
     or new.creator_id is distinct from old.creator_id
     or new.title is distinct from old.title
     or new.file_url is distinct from old.file_url
     or new.thumbnail_url is distinct from old.thumbnail_url
     or new.version is distinct from old.version
     or new.description is distinct from old.description
     or new.is_final is distinct from old.is_final then
    raise exception 'Submit a new version instead of editing a submitted deliverable';
  end if;
  if auth.uid() = brand_owner then
    if new.status not in ('in_review', 'revision_requested', 'approved', old.status) then
      raise exception 'Invalid review status';
    end if;
  elsif auth.uid() = old.creator_id then
    if new.status is distinct from old.status or new.notes is distinct from old.notes then
      raise exception 'Submit a new version to respond to feedback';
    end if;
  else
    raise exception 'Only engagement participants may update deliverables';
  end if;
  return new;
end;
$$;

create or replace function public.guard_revision_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  creator_owner uuid;
begin
  select e.creator_id into creator_owner from public.engagements e where e.id = old.engagement_id;
  if new.engagement_id is distinct from old.engagement_id
     or new.deliverable_id is distinct from old.deliverable_id
     or new.requested_by is distinct from old.requested_by
     or new.comment is distinct from old.comment then
    raise exception 'Revision feedback cannot be edited';
  end if;
  if auth.uid() = creator_owner then
    if new.status not in ('in_progress', 'completed', old.status) then
      raise exception 'Invalid revision progress state';
    end if;
  elsif auth.uid() <> old.requested_by then
    raise exception 'Only engagement participants may update revision status';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_application_update_trigger on public.applications;
create trigger guard_application_update_trigger before update on public.applications for each row execute function public.guard_application_update();
drop trigger if exists guard_invitation_update_trigger on public.invitations;
create trigger guard_invitation_update_trigger before update on public.invitations for each row execute function public.guard_invitation_update();
drop trigger if exists guard_engagement_update_trigger on public.engagements;
create trigger guard_engagement_update_trigger before update on public.engagements for each row execute function public.guard_engagement_update();
drop trigger if exists guard_deliverable_update_trigger on public.deliverables;
create trigger guard_deliverable_update_trigger before update on public.deliverables for each row execute function public.guard_deliverable_update();
drop trigger if exists guard_revision_update_trigger on public.revisions;
create trigger guard_revision_update_trigger before update on public.revisions for each row execute function public.guard_revision_update();

alter table public.profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.verification_signals enable row level security;
alter table public.briefs enable row level security;
alter table public.applications enable row level security;
alter table public.invitations enable row level security;
alter table public.matches enable row level security;
alter table public.engagements enable row level security;
alter table public.deliverables enable row level security;
alter table public.revisions enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_projects enable row level security;

drop policy if exists profiles_read_public on public.profiles;
create policy profiles_read_public on public.profiles for select
  using (is_demo or is_public or auth_user_id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (auth_user_id = auth.uid() and not is_demo)
  with check (auth_user_id = auth.uid() and not is_demo);

drop policy if exists creator_profiles_read_public on public.creator_profiles;
create policy creator_profiles_read_public on public.creator_profiles for select
  using (exists (
    select 1 from public.profiles p
    where p.id = user_id and (p.is_demo or p.is_public or p.auth_user_id = auth.uid())
  ));
drop policy if exists creator_profiles_insert_self on public.creator_profiles;
create policy creator_profiles_insert_self on public.creator_profiles for insert
  with check (user_id = auth.uid() and public.is_current_user_role(user_id, 'creator'));
drop policy if exists creator_profiles_update_self on public.creator_profiles;
create policy creator_profiles_update_self on public.creator_profiles for update
  using (user_id = auth.uid() and public.is_current_user_role(user_id, 'creator'))
  with check (user_id = auth.uid() and public.is_current_user_role(user_id, 'creator'));
drop policy if exists creator_profiles_delete_self on public.creator_profiles;
create policy creator_profiles_delete_self on public.creator_profiles for delete
  using (user_id = auth.uid() and public.is_current_user_role(user_id, 'creator'));

drop policy if exists portfolio_read_published on public.portfolio_items;
create policy portfolio_read_published on public.portfolio_items for select
  using (is_published or creator_id = auth.uid());
drop policy if exists portfolio_insert_self on public.portfolio_items;
create policy portfolio_insert_self on public.portfolio_items for insert
  with check (creator_id = auth.uid() and public.is_current_user_role(creator_id, 'creator'));
drop policy if exists portfolio_update_self on public.portfolio_items;
create policy portfolio_update_self on public.portfolio_items for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and public.is_current_user_role(creator_id, 'creator'));
drop policy if exists portfolio_delete_self on public.portfolio_items;
create policy portfolio_delete_self on public.portfolio_items for delete
  using (creator_id = auth.uid());

drop policy if exists verification_read_public on public.verification_signals;
create policy verification_read_public on public.verification_signals for select
  using (exists (
    select 1 from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
    where cp.id = creator_id and (p.is_demo or p.is_public or p.auth_user_id = auth.uid())
  ));
drop policy if exists verification_manage_self on public.verification_signals;
create policy verification_manage_self on public.verification_signals for all
  using (exists (select 1 from public.creator_profiles cp where cp.id = creator_id and cp.user_id = auth.uid()))
  with check (exists (select 1 from public.creator_profiles cp where cp.id = creator_id and cp.user_id = auth.uid()));

drop policy if exists briefs_read_published_or_owner on public.briefs;
create policy briefs_read_published_or_owner on public.briefs for select
  using (status = 'published' or brand_id = auth.uid());
drop policy if exists briefs_insert_brand on public.briefs;
create policy briefs_insert_brand on public.briefs for insert
  with check (brand_id = auth.uid() and public.is_current_user_role(brand_id, 'brand'));
drop policy if exists briefs_update_brand on public.briefs;
create policy briefs_update_brand on public.briefs for update
  using (brand_id = auth.uid() and public.is_current_user_role(brand_id, 'brand'))
  with check (brand_id = auth.uid() and public.is_current_user_role(brand_id, 'brand'));
drop policy if exists briefs_delete_brand on public.briefs;
create policy briefs_delete_brand on public.briefs for delete
  using (brand_id = auth.uid() and public.is_current_user_role(brand_id, 'brand'));

drop policy if exists applications_read_participants on public.applications;
create policy applications_read_participants on public.applications for select
  using (creator_id = auth.uid() or public.owns_brief(brief_id));
drop policy if exists applications_insert_creator on public.applications;
create policy applications_insert_creator on public.applications for insert
  with check (
    creator_id = auth.uid()
    and public.is_current_user_role(creator_id, 'creator')
    and exists (select 1 from public.briefs b where b.id = brief_id and b.status = 'published')
  );
drop policy if exists applications_update_participants on public.applications;
create policy applications_update_participants on public.applications for update
  using (creator_id = auth.uid() or public.owns_brief(brief_id))
  with check (creator_id = auth.uid() or public.owns_brief(brief_id));
drop policy if exists applications_delete_creator on public.applications;
create policy applications_delete_creator on public.applications for delete
  using (creator_id = auth.uid() and status in ('submitted', 'withdrawn'));

drop policy if exists invitations_read_participants on public.invitations;
create policy invitations_read_participants on public.invitations for select
  using (brand_id = auth.uid() or creator_id = auth.uid());
drop policy if exists invitations_insert_brand on public.invitations;
create policy invitations_insert_brand on public.invitations for insert
  with check (
    brand_id = auth.uid()
    and public.is_current_user_role(brand_id, 'brand')
    and public.owns_brief(brief_id)
    and creator_id <> brand_id
    and exists (
      select 1 from public.profiles p
      where p.id = creator_id and p.role = 'creator' and (not p.is_demo or p.auth_user_id is not null)
    )
  );
drop policy if exists invitations_update_participants on public.invitations;
create policy invitations_update_participants on public.invitations for update
  using (brand_id = auth.uid() or creator_id = auth.uid())
  with check (brand_id = auth.uid() or creator_id = auth.uid());

drop policy if exists matches_read_brand on public.matches;
create policy matches_read_brand on public.matches for select
  using (public.owns_brief(brief_id));
drop policy if exists matches_write_brand on public.matches;
create policy matches_write_brand on public.matches for all
  using (public.owns_brief(brief_id))
  with check (public.owns_brief(brief_id));

drop policy if exists engagements_read_participants on public.engagements;
create policy engagements_read_participants on public.engagements for select
  using (auth.uid() in (brand_id, creator_id));
drop policy if exists engagements_update_participants on public.engagements;
create policy engagements_update_participants on public.engagements for update
  using (auth.uid() in (brand_id, creator_id))
  with check (auth.uid() in (brand_id, creator_id));

drop policy if exists deliverables_read_participants on public.deliverables;
create policy deliverables_read_participants on public.deliverables for select
  using (public.is_engagement_participant(engagement_id));
drop policy if exists deliverables_insert_creator on public.deliverables;
create policy deliverables_insert_creator on public.deliverables for insert
  with check (
    creator_id = auth.uid()
    and exists (select 1 from public.engagements e where e.id = engagement_id and e.creator_id = auth.uid())
  );
drop policy if exists deliverables_update_participants on public.deliverables;
create policy deliverables_update_participants on public.deliverables for update
  using (public.is_engagement_participant(engagement_id))
  with check (public.is_engagement_participant(engagement_id));
drop policy if exists deliverables_delete_creator on public.deliverables;
create policy deliverables_delete_creator on public.deliverables for delete
  using (creator_id = auth.uid());

drop policy if exists revisions_read_participants on public.revisions;
create policy revisions_read_participants on public.revisions for select
  using (public.is_engagement_participant(engagement_id));
drop policy if exists revisions_insert_brand on public.revisions;
create policy revisions_insert_brand on public.revisions for insert
  with check (
    requested_by = auth.uid()
    and exists (select 1 from public.engagements e where e.id = engagement_id and e.brand_id = auth.uid())
  );
drop policy if exists revisions_update_participants on public.revisions;
create policy revisions_update_participants on public.revisions for update
  using (public.is_engagement_participant(engagement_id))
  with check (public.is_engagement_participant(engagement_id));

drop policy if exists reviews_read_public on public.reviews;
create policy reviews_read_public on public.reviews for select
  using (
    reviewer_id = auth.uid()
    or reviewee_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = reviewee_id and (p.is_demo or p.is_public))
  );
drop policy if exists reviews_insert_participant on public.reviews;
create policy reviews_insert_participant on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.engagements e
      where e.id = engagement_id
        and e.status = 'completed'
        and auth.uid() in (e.brand_id, e.creator_id)
        and reviewee_id in (e.brand_id, e.creator_id)
        and reviewee_id <> auth.uid()
    )
  );

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_projects_read_self on public.saved_projects;
create policy saved_projects_read_self on public.saved_projects for select using (user_id = auth.uid());
drop policy if exists saved_projects_insert_creator on public.saved_projects;
create policy saved_projects_insert_creator on public.saved_projects for insert
  with check (
    user_id = auth.uid()
    and public.is_current_user_role(user_id, 'creator')
    and exists (select 1 from public.briefs b where b.id = brief_id and b.status = 'published')
  );
drop policy if exists saved_projects_delete_self on public.saved_projects;
create policy saved_projects_delete_self on public.saved_projects for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('project-references', 'project-references', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('deliverables', 'deliverables', false, 209715200, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists public_read_avatars on storage.objects;
create policy public_read_avatars on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists users_upload_own_avatar on storage.objects;
create policy users_upload_own_avatar on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists users_update_own_avatar on storage.objects;
create policy users_update_own_avatar on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists users_delete_own_avatar on storage.objects;
create policy users_delete_own_avatar on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists public_read_portfolio_media on storage.objects;
create policy public_read_portfolio_media on storage.objects for select using (bucket_id = 'portfolio');
drop policy if exists users_upload_portfolio_media on storage.objects;
create policy users_upload_portfolio_media on storage.objects for insert
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists users_update_portfolio_media on storage.objects;
create policy users_update_portfolio_media on storage.objects for update
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists users_delete_portfolio_media on storage.objects;
create policy users_delete_portfolio_media on storage.objects for delete
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists brands_manage_project_references on storage.objects;
create policy brands_manage_project_references on storage.objects for all
  using (
    bucket_id = 'project-references'
    and exists (
      select 1 from public.briefs b
      where b.id::text = (storage.foldername(name))[1] and b.brand_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'project-references'
    and exists (
      select 1 from public.briefs b
      where b.id::text = (storage.foldername(name))[1] and b.brand_id = auth.uid()
    )
  );

drop policy if exists engagement_participants_read_deliverables on storage.objects;
create policy engagement_participants_read_deliverables on storage.objects for select
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.engagements e
      where e.id::text = (storage.foldername(name))[1]
        and auth.uid() in (e.brand_id, e.creator_id)
    )
  );
drop policy if exists creators_manage_own_deliverables on storage.objects;
create policy creators_manage_own_deliverables on storage.objects for all
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.engagements e
      where e.id::text = (storage.foldername(name))[1] and e.creator_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.engagements e
      where e.id::text = (storage.foldername(name))[1] and e.creator_id = auth.uid()
    )
  );

-- Demo users and their related records are created by the server-side seed script.
-- This avoids publishing profiles that cannot sign in through Supabase Auth.

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (full_name, avatar_url, location, bio, company_name, industry, is_public)
  on public.profiles to authenticated;
grant select on public.creator_profiles, public.portfolio_items, public.verification_signals, public.briefs, public.reviews to anon, authenticated;
grant select, insert, update, delete on public.creator_profiles, public.portfolio_items, public.verification_signals, public.briefs, public.applications, public.invitations, public.matches, public.engagements, public.deliverables, public.revisions, public.reviews, public.notifications, public.saved_projects to authenticated;
grant select on public.applications, public.invitations, public.matches, public.engagements, public.deliverables, public.revisions, public.notifications, public.saved_projects to authenticated;
grant execute on function public.is_current_user_role(uuid, text) to anon, authenticated;
grant execute on function public.owns_brief(uuid) to anon, authenticated;
grant execute on function public.is_engagement_participant(uuid) to anon, authenticated;
grant execute on function public.array_match_score(text[], text[]) to anon, authenticated;
grant execute on function public.match_creators_for_brief(uuid) to authenticated;
