-- Protein Tracker cloud sync. Run in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Uses its own pt_ tables, so it can share a project with other apps.

create table if not exists public.pt_entries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at timestamptz,
  day date,
  amount numeric,
  is_addition boolean,
  name text,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table if not exists public.pt_recipes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists pt_entries_user_synced on public.pt_entries (user_id, synced_at);
create index if not exists pt_recipes_user_synced on public.pt_recipes (user_id, synced_at);

-- synced_at is set by the server on every write, so devices can ask for "everything since".
create or replace function public.pt_touch_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists pt_entries_touch on public.pt_entries;
create trigger pt_entries_touch before insert or update on public.pt_entries
  for each row execute function public.pt_touch_synced_at();

drop trigger if exists pt_recipes_touch on public.pt_recipes;
create trigger pt_recipes_touch before insert or update on public.pt_recipes
  for each row execute function public.pt_touch_synced_at();

-- Each account can only see and change its own rows.
alter table public.pt_entries enable row level security;
alter table public.pt_recipes enable row level security;

drop policy if exists "Own protein entries" on public.pt_entries;
create policy "Own protein entries" on public.pt_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own recipes" on public.pt_recipes;
create policy "Own recipes" on public.pt_recipes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.pt_entries to authenticated;
grant select, insert, update, delete on public.pt_recipes to authenticated;
