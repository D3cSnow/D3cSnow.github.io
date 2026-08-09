-- Elixir — sync backend.
-- ---------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- The security model, in one line: the vault key is a bearer secret, the
-- database only ever stores its SHA-256, and the table itself is unreachable.
--
-- Why it is built this way:
--
--   * Row Level Security is enabled on `vaults` and NO policy is created. In
--     Postgres that means every direct query from `anon` is denied — there is
--     no `select * from vaults` that returns anything, ever. The table cannot
--     be listed, counted or dumped through the REST API.
--
--   * The only way in is the two SECURITY DEFINER functions below, and both
--     require the caller to already know a vault key. Knowing the public anon
--     API key gets you nothing on its own.
--
--   * The key is hashed before it touches a row, so the stored id is not a
--     credential. Someone who obtained a copy of this table could not use it
--     to read anyone's data.
--
-- What actually gets stored: Leitner box numbers, due dates, answer counts,
-- a streak and an XP number. No name, no email, no student id, nothing that
-- identifies a person. Keep it that way — see the note in README.md.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.vaults (
  id          text        primary key,   -- sha256 hex of the vault key
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- RLS on, no policies: direct table access is denied to everyone but the
-- service role. This is deliberate — do not add a policy here.
alter table public.vaults enable row level security;


-- Read a vault. Returns null when the key has never been used, which is how a
-- freshly paired device tells "nothing up there yet" from "wrong code".
create or replace function public.vault_pull(vault_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if vault_key is null or length(vault_key) < 16 then
    raise exception 'invalid vault key';
  end if;

  select data into result
    from vaults
   where id = encode(digest(vault_key, 'sha256'), 'hex');

  return result;
end;
$$;


-- Write a vault. Returns the server timestamp so the client can show when it
-- last successfully synced.
create or replace function public.vault_push(vault_key text, payload jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  hashed text;
  stamp  timestamptz;
begin
  if vault_key is null or length(vault_key) < 16 then
    raise exception 'invalid vault key';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be a json object';
  end if;

  -- A study vault is a few kilobytes. Anything approaching this is a bug or an
  -- abuse attempt, and either way should not be stored.
  if pg_column_size(payload) > 512000 then
    raise exception 'payload too large';
  end if;

  hashed := encode(digest(vault_key, 'sha256'), 'hex');

  insert into vaults (id, data)
       values (hashed, payload)
  on conflict (id) do update
          set data       = excluded.data,
              updated_at = now()
    returning updated_at into stamp;

  return stamp;
end;
$$;


-- Expose the functions and nothing else.
revoke all on function public.vault_pull(text)         from public;
revoke all on function public.vault_push(text, jsonb)  from public;

grant execute on function public.vault_pull(text)        to anon, authenticated;
grant execute on function public.vault_push(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Optional housekeeping.
--
-- Supabase's free tier pauses a project after a week with no requests. Daily
-- study keeps it awake by itself, so there is nothing to schedule here — but if
-- you ever stop using Elixir for a while, the project pauses and the next sync
-- fails until you resume it from the dashboard. Local data is untouched either
-- way; the app keeps working offline.
--
-- If you want abandoned vaults to expire, run this by hand occasionally:
--
--   delete from public.vaults where updated_at < now() - interval '1 year';
-- ---------------------------------------------------------------------------
