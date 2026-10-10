-- Protein Tracker cloud sync. Run in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Uses its own pt_ tables and functions, so it can share a project with other apps
-- (with the travel log app it also shares the PIN: the same PIN works in both).

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

-- ---------------------------------------------------------------------------
-- PIN access (same design as the travel log app, and the same tables: if both apps use
-- this Supabase project, one PIN works for both).
-- While signed in, set a PIN; a device that enters it gets its own long random key
-- (stored hashed in `devices`) and syncs through the pt_pin_* functions below, which only
-- ever touch that account's rows. Wrong PINs are rate limited, and changing the PIN
-- locks out every device that used the old one.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pins (
  owner uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.devices (
  token_hash text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create table if not exists public.pin_attempts (
  at timestamptz not null default now(),
  who uuid
);
-- Row-level security with no policies: only the functions below can read these.
alter table public.pins enable row level security;
alter table public.devices enable row level security;
alter table public.pin_attempts enable row level security;

-- Signed in: is a PIN set?
create or replace function public.pt_has_pin() returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from pins where owner = auth.uid());
$$;

-- Signed in: set or change the PIN. Changing it locks out devices that used the old one.
create or replace function public.pt_set_pin(new_pin text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if length(coalesce(new_pin, '')) < 6 then raise exception 'Use at least 6 characters'; end if;
  if (select count(*) from pin_attempts where who = uid and at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many PIN changes. Try again in 15 minutes.';
  end if;
  insert into pin_attempts (who) values (uid);
  if exists (select 1 from pins where owner <> uid and pin_hash = crypt(new_pin, pin_hash)) then
    raise exception 'Choose a different PIN';
  end if;
  insert into pins (owner, pin_hash) values (uid, crypt(new_pin, gen_salt('bf')))
    on conflict (owner) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from devices where owner = uid;
end $$;

-- Anyone: trade a PIN for a device key. Returns {token, owner} or {error}.
create or replace function public.pt_unlock(pin text) returns json
  language plpgsql security definer set search_path = public, extensions as $$
declare o uuid; tok text;
begin
  delete from pin_attempts where at < now() - interval '1 day';
  if (select count(*) from pin_attempts where who is null and at > now() - interval '15 minutes') >= 20 then
    return json_build_object('error', 'Too many wrong PINs. Try again in 15 minutes.');
  end if;
  select owner into o from pins where pin_hash = crypt(coalesce(pin, ''), pin_hash) limit 1;
  if o is null then
    insert into pin_attempts (who) values (null);
    return json_build_object('error', 'Wrong PIN');
  end if;
  tok := encode(gen_random_bytes(32), 'hex');
  insert into devices (token_hash, owner) values (encode(digest(tok, 'sha256'), 'hex'), o);
  return json_build_object('token', tok, 'owner', o);
end $$;

-- Internal: the account a device key belongs to.
create or replace function public.pt_owner(token text) returns uuid
  language plpgsql security definer set search_path = public, extensions as $$
declare o uuid;
begin
  update devices set seen_at = now() where token_hash = encode(digest(coalesce(token, ''), 'sha256'), 'hex') returning owner into o;
  if o is null then raise exception 'PT_DEVICE_LOCKED'; end if;
  return o;
end $$;
revoke execute on function public.pt_owner(text) from public, anon, authenticated;

-- Device key: upload entries or recipes (rows shaped like the tables). Rows belonging to
-- another account are never touched.
create or replace function public.pt_pin_put(p_token text, p_tbl text, p_rows jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare o uuid := pt_owner(p_token);
begin
  if p_tbl = 'entries' then
    insert into pt_entries (id, user_id, logged_at, day, amount, is_addition, name, deleted, updated_at)
      select r ->> 'id', o, (r ->> 'logged_at')::timestamptz, (r ->> 'day')::date, (r ->> 'amount')::numeric,
             (r ->> 'is_addition')::boolean, r ->> 'name', coalesce((r ->> 'deleted')::boolean, false),
             coalesce((r ->> 'updated_at')::timestamptz, now())
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
      where coalesce(r ->> 'id', '') <> ''
      on conflict (id) do update set
        logged_at = excluded.logged_at, day = excluded.day, amount = excluded.amount,
        is_addition = excluded.is_addition, name = excluded.name, deleted = excluded.deleted,
        updated_at = excluded.updated_at
      where pt_entries.user_id = o;
  elsif p_tbl = 'recipes' then
    insert into pt_recipes (id, user_id, data, deleted, updated_at)
      select r ->> 'id', o, r -> 'data', coalesce((r ->> 'deleted')::boolean, false),
             coalesce((r ->> 'updated_at')::timestamptz, now())
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
      where coalesce(r ->> 'id', '') <> ''
      on conflict (id) do update set
        data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at
      where pt_recipes.user_id = o;
  else
    raise exception 'Unknown table';
  end if;
end $$;

-- Device key: entries or recipes changed since a time, oldest first, a page at a time.
create or replace function public.pt_pin_pull(p_token text, p_tbl text, p_since timestamptz, p_limit integer, p_offset integer) returns json
  language plpgsql security definer set search_path = public as $$
declare o uuid := pt_owner(p_token); n integer := least(greatest(coalesce(p_limit, 1000), 1), 1000); k integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_tbl = 'entries' then
    return coalesce((select json_agg(t) from (
      select * from pt_entries where user_id = o and (p_since is null or synced_at > p_since)
      order by synced_at limit n offset k) t), '[]'::json);
  elsif p_tbl = 'recipes' then
    return coalesce((select json_agg(t) from (
      select * from pt_recipes where user_id = o and (p_since is null or synced_at > p_since)
      order by synced_at limit n offset k) t), '[]'::json);
  end if;
  raise exception 'Unknown table';
end $$;

-- Device key: forget this device.
create or replace function public.pt_forget(token text) returns void
  language sql security definer set search_path = public, extensions as $$
  delete from devices where token_hash = encode(digest(coalesce(token, ''), 'sha256'), 'hex');
$$;
