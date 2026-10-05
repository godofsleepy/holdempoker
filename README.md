# Hold'em Poker

Multiplayer Texas Hold'em for 2–8 friends. Create a table, share the link, play.

- No-limit, blinds 10/20, 1000 starting chips, free rebuys
- Server deals and enforces the rules; nobody can see your cards
- 30s turn timer (timed-out players are folded and sat out), next hand auto-deals
- Works on phones

## Run locally

```bash
npm run dev     # http://localhost:3000 (tables stored in memory)
npm test
```

No dependencies to install.

## Deploy to Vercel

1. Create a free Supabase project and run `supabase.sql` in its SQL editor.
2. Import this repo in Vercel and add two environment variables:
   - `SUPABASE_URL` — e.g. `https://xxxx.supabase.co`
   - `SUPABASE_KEY` — the project's publishable (anon) key
3. Deploy.

## How it works

- `public/index.html` — the whole UI; polls the API every 1.5s
- `api/room.js` — one Vercel function: create/join/deal/bet/etc.
- `lib/poker.js` — game engine (betting, side pots, hand ranking)
- `lib/store.js` — saves each table as JSON in Supabase, with version checks so simultaneous requests don't clobber each other

Vercel functions don't keep memory between requests, which is why table state lives in Supabase.
