// Room storage: Supabase table `poker_rooms` when env vars are set, otherwise in-memory (local dev).
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const memory = new Map()

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  })
  if (res.status === 409) return null
  if (!res.ok) throw new Error(`Storage error ${res.status}: ${await res.text()}`)
  return res.json()
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
