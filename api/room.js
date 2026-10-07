import { randomInt } from 'node:crypto'
import * as poker from '../lib/poker.js'
import { createRoom, updateRoom, recordWin, topPlayers, getPlayer } from '../lib/store.js'

const cleanName = name => String(name || '').trim().slice(0, 16) || 'Player'
const cleanCode = code => String(code || '').trim().toUpperCase()
const cleanAvatar = avatar => Math.min(5, Math.max(0, Math.floor(Number(avatar)) || 0))

function checkPid(pid) {
  if (typeof pid !== 'string' || pid.length < 8 || pid.length > 64) throw new Error('Bad player id')
  return pid
}

async function newTable(pid, name, avatar) {
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(24)]).join('')
    const room = poker.newRoom(code)
    poker.addPlayer(room, pid, name, avatar)
    if (await createRoom(code, room)) return room
  }
  throw new Error('Could not create a table, try again')
}

// Runs `change` on the room and, if that just finished a hand, adds each winner's profit to the leaderboard.
async function update(code, change) {
  let finished = false
  const room = await updateRoom(code, r => {
    const doneHand = r.hand?.done ? r.handNo : null
    const changed = change(r)
    finished = Boolean(r.hand?.done) && r.handNo !== doneHand
    return changed
  })
  if (finished) {
    for (const { seat, amount } of room.hand.results) {
      const p = room.players[seat]
      const profit = amount - p.total
      if (profit <= 0) continue
      try {
        await recordWin(p.id, p.name, p.avatar, profit)
      } catch (e) {
        console.error(e) // the game goes on even if the leaderboard can't be saved
      }
    }
  }
  return room
}

async function leaderboard(pid) {
  const [top, mine] = await Promise.all([topPlayers(10), pid ? getPlayer(pid) : null])
  const row = p => ({ name: p.name, avatar: p.avatar, chips: Number(p.chips_won), hands: p.hands_won, me: p.id === pid })
  return { top: top.map(row), me: mine && row(mine) } // device ids stay on the server
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const pid = String(req.query.pid || '')
      if (req.query.leaderboard) return res.status(200).json(await leaderboard(pid))
      const room = await update(cleanCode(req.query.code), r => poker.tick(r, Date.now()))
      return res.status(200).json(poker.view(room, pid, Date.now()))
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { op, code, name, avatar, action, amount } = req.body || {}
    const pid = checkPid(req.body?.pid)
    const now = Date.now()
    const room = op === 'create'
      ? await newTable(pid, cleanName(name), cleanAvatar(avatar))
      : await update(cleanCode(code), r => {
        if (op === 'join') poker.addPlayer(r, pid, cleanName(name), cleanAvatar(avatar))
        else if (op === 'start') poker.startHand(r, now)
        else if (op === 'act') poker.act(r, pid, action, amount, now)
        else if (op === 'sitout') poker.setSitOut(r, pid, true)
        else if (op === 'back') poker.setSitOut(r, pid, false)
        else if (op === 'rebuy') poker.rebuy(r, pid)
        else if (op === 'leave') poker.leave(r, pid)
        else if (op === 'emote') poker.emote(r, pid, req.body.text, now)
        else throw new Error('Unknown op')
        return true
      })
    res.status(200).json(poker.view(room, pid, now))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}
