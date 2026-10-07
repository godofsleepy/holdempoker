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

-- Leaderboard (added later: if your project already has poker_rooms, run just this part).
-- Players have no login, so each one is the random device id their browser keeps in localStorage.
create table public.poker_players (
  id text primary key,
  name text not null,
  avatar integer not null default 0,
  chips_won bigint not null default 0,
  hands_won integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.poker_players enable row level security;
create policy "api access" on public.poker_players for all to anon using (true) with check (true);

-- Adds one won hand in a single statement, so two tables finishing at once can't lose an update.
create function public.record_win(p_id text, p_name text, p_avatar integer, p_chips bigint)
returns void language sql as $$
  insert into public.poker_players (id, name, avatar, chips_won, hands_won)
  values (p_id, p_name, p_avatar, p_chips, 1)
  on conflict (id) do update set
    name = excluded.name,
    avatar = excluded.avatar,
    chips_won = poker_players.chips_won + excluded.chips_won,
    hands_won = poker_players.hands_won + 1,
    updated_at = now();
$$;
