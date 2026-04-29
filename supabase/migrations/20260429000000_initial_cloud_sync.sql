-- Timer Stacks cloud sync schema.
-- Apply in Supabase SQL editor or with the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  total_duration_ms bigint not null check (total_duration_ms >= 0),
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_id uuid not null references public.stacks(id) on delete cascade,
  label text not null,
  duration_ms bigint not null check (duration_ms > 0),
  color text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stack_id, position)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_id uuid references public.stacks(id) on delete set null,
  stack_name text not null,
  status text not null check (status in ('running', 'paused', 'completed', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  total_elapsed_ms bigint not null default 0 check (total_elapsed_ms >= 0),
  segments_completed integer not null default 0 check (segments_completed >= 0),
  total_segments integer not null default 0 check (total_segments >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_type text not null,
  segment_id uuid references public.segments(id) on delete set null,
  segment_index integer,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists stacks_user_updated_idx on public.stacks (user_id, updated_at desc);
create index if not exists segments_user_stack_position_idx on public.segments (user_id, stack_id, position);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index if not exists session_events_user_session_time_idx on public.session_events (user_id, session_id, occurred_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_stacks_updated_at on public.stacks;
create trigger set_stacks_updated_at
before update on public.stacks
for each row execute function public.set_updated_at();

drop trigger if exists set_segments_updated_at on public.segments;
create trigger set_segments_updated_at
before update on public.segments
for each row execute function public.set_updated_at();

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stacks enable row level security;
alter table public.segments enable row level security;
alter table public.sessions enable row level security;
alter table public.session_events enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can read own stacks" on public.stacks;
create policy "Users can read own stacks"
on public.stacks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own stacks" on public.stacks;
create policy "Users can insert own stacks"
on public.stacks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own stacks" on public.stacks;
create policy "Users can update own stacks"
on public.stacks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own stacks" on public.stacks;
create policy "Users can delete own stacks"
on public.stacks for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own segments" on public.segments;
create policy "Users can read own segments"
on public.segments for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own segments" on public.segments;
create policy "Users can insert own segments"
on public.segments for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.stacks
    where stacks.id = segments.stack_id
      and stacks.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own segments" on public.segments;
create policy "Users can update own segments"
on public.segments for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.stacks
    where stacks.id = segments.stack_id
      and stacks.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own segments" on public.segments;
create policy "Users can delete own segments"
on public.segments for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own sessions" on public.sessions;
create policy "Users can read own sessions"
on public.sessions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own sessions" on public.sessions;
create policy "Users can insert own sessions"
on public.sessions for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own sessions" on public.sessions;
create policy "Users can update own sessions"
on public.sessions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own sessions" on public.sessions;
create policy "Users can delete own sessions"
on public.sessions for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own session events" on public.session_events;
create policy "Users can read own session events"
on public.session_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own session events" on public.session_events;
create policy "Users can insert own session events"
on public.session_events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.sessions
    where sessions.id = session_events.session_id
      and sessions.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own session events" on public.session_events;
create policy "Users can update own session events"
on public.session_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own session events" on public.session_events;
create policy "Users can delete own session events"
on public.session_events for delete
to authenticated
using ((select auth.uid()) = user_id);
