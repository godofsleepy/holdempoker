import { randomInt } from 'node:crypto'
import * as poker from '../lib/poker.js'
import { createRoom, updateRoom } from '../lib/store.js'

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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const pid = String(req.query.pid || '')
      const room = await updateRoom(cleanCode(req.query.code), r => poker.tick(r, Date.now()))
      return res.status(200).json(poker.view(room, pid, Date.now()))
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { op, code, name, avatar, action, amount } = req.body || {}
    const pid = checkPid(req.body?.pid)
    const now = Date.now()
    const room = op === 'create'
      ? await newTable(pid, cleanName(name), cleanAvatar(avatar))
      : await updateRoom(cleanCode(code), r => {
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
