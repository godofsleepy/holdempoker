// Room storage: Supabase table `poker_rooms` when env vars are set, otherwise in-memory (local dev).
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const memory = new Map()
const memoryPlayers = new Map()

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  })
  if (res.status === 409) return null
  if (!res.ok) throw new Error(`Storage error ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function load(code) {
  if (!SUPABASE_URL) return memory.has(code) ? structuredClone(memory.get(code)) : null
  const rows = await rest(`poker_rooms?code=eq.${encodeURIComponent(code)}&select=state,version`)
  return rows[0] || null
}

// Saves only if nobody else saved since we loaded (optimistic locking).
async function save(code, state, version) {
  if (!SUPABASE_URL) {
    if (memory.get(code)?.version !== version) return false
    memory.set(code, structuredClone({ state, version: version + 1 }))
    return true
  }
  const rows = await rest(`poker_rooms?code=eq.${encodeURIComponent(code)}&version=eq.${version}`, {
    method: 'PATCH',
    body: JSON.stringify({ state, version: version + 1, updated_at: new Date().toISOString() }),
  })
  return rows.length === 1
}

// Returns false if the code is already taken.
export async function createRoom(code, state) {
  if (!SUPABASE_URL) {
    if (memory.has(code)) return false
    memory.set(code, structuredClone({ state, version: 0 }))
    return true
  }
  const dayAgo = new Date(Date.now() - 864e5).toISOString()
  await rest(`poker_rooms?updated_at=lt.${dayAgo}`, { method: 'DELETE' }) // clean up abandoned tables
  return (await rest('poker_rooms', { method: 'POST', body: JSON.stringify({ code, state }) })) !== null
}

// Loads a room, lets `change(state)` mutate it, and saves if it returns true. Retries on conflicts.
export async function updateRoom(code, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await load(code)
    if (!row) throw new Error('Table not found')
    if (!change(row.state) || (await save(code, row.state, row.version))) return row.state
  }
  throw new Error('Table is busy, try again')
}

// ---------- leaderboard: lifetime winnings per device id (the browser's random `pid`) ----------

export async function recordWin(id, name, avatar, chips) {
  if (!SUPABASE_URL) {
    const p = memoryPlayers.get(id) || { chips_won: 0, hands_won: 0 }
    memoryPlayers.set(id, { id, name, avatar, chips_won: p.chips_won + chips, hands_won: p.hands_won + 1 })
    return
  }
  await rest('rpc/record_win', {
    method: 'POST',
    body: JSON.stringify({ p_id: id, p_name: name, p_avatar: avatar, p_chips: chips }),
  })
}

export async function topPlayers(limit) {
  if (!SUPABASE_URL) return [...memoryPlayers.values()].sort((a, b) => b.chips_won - a.chips_won).slice(0, limit)
  return rest(`poker_players?select=id,name,avatar,chips_won,hands_won&order=chips_won.desc&limit=${limit}`)
}

export async function getPlayer(id) {
  if (!SUPABASE_URL) return memoryPlayers.get(id) || null
  const rows = await rest(`poker_players?id=eq.${encodeURIComponent(id)}&select=id,name,avatar,chips_won,hands_won`)
  return rows[0] || null
}
