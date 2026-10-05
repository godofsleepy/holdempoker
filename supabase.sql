-- Run once in the Supabase SQL editor.
create table public.poker_rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.poker_rooms enable row level security;
-- The key is only used by the Vercel API (never sent to browsers), which owns all game rules.
create policy "api access" on public.poker_rooms for all to anon using (true) with check (true);
