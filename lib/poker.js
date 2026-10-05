import { randomInt } from 'node:crypto'

export const START_CHIPS = 1000
export const SMALL_BLIND = 10
export const BIG_BLIND = 20
export const MAX_PLAYERS = 8
export const TURN_MS = 30000
export const NEXT_HAND_MS = 6000

const RANKS = '23456789TJQKA'
const SUITS = 'shdc'
const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']

// ---------- hand evaluation ----------

function rank5(cards) {
  const vals = cards.map(c => RANKS.indexOf(c[0])).sort((a, b) => b - a)
  const flush = cards.every(c => c[1] === cards[0][1])
  const counts = {}
  for (const v of vals) counts[v] = (counts[v] || 0) + 1
  const groups = Object.entries(counts).map(([v, n]) => [n, +v]).sort((a, b) => b[0] - a[0] || b[1] - a[1])
  const byGroup = groups.map(g => g[1])
  let straight = -1
  if (groups.length === 5 && vals[0] - vals[4] === 4) straight = vals[0]
  if (groups.length === 5 && vals[0] === 12 && vals[1] === 3) straight = 3 // A-2-3-4-5
  if (straight >= 0 && flush) return [8, straight]
  if (groups[0][0] === 4) return [7, ...byGroup]
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup]
  if (flush) return [5, ...vals]
  if (straight >= 0) return [4, straight]
  if (groups[0][0] === 3) return [3, ...byGroup]
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup]
  if (groups[0][0] === 2) return [1, ...byGroup]
  return [0, ...vals]
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? -1) !== (b[i] ?? -1)) return (a[i] ?? -1) - (b[i] ?? -1)
  }
  return 0
}

function combos(cards, k, start = 0, pick = [], out = []) {
  if (pick.length === k) out.push([...pick])
  else for (let i = start; i < cards.length; i++) {
    pick.push(cards[i])
    combos(cards, k, i + 1, pick, out)
    pick.pop()
  }
  return out
}

// Best 5-card hand out of 5-7 cards.
export function bestHand(cards) {
  let best = null
  for (const five of combos(cards, 5)) {
    const score = rank5(five)
    if (!best || compareScores(score, best) > 0) best = score
  }
  const name = best[0] === 8 && best[1] === 12 ? 'Royal Flush' : HAND_NAMES[best[0]]
  return { score: best, name }
}

// ---------- table helpers ----------

function shuffledDeck() {
  const deck = []
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function nextIdx(room, from, pred) {
  const n = room.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (((from + i) % n) + n) % n
    if (pred(room.players[idx])) return idx
  }
  return -1
}

function log(room, msg) {
  room.log.push(msg)
  if (room.log.length > 30) room.log.shift()
}

function put(p, amount) {
  amount = Math.min(amount, p.chips)
  p.chips -= amount
  p.bet += amount
  p.total += amount
  if (p.chips === 0) p.allIn = true
  return amount
}

const handActive = room => room.hand && !room.hand.done
const canPlay = p => p.chips > 0 && !p.sitOut && !p.left
const needsAction = room => p =>
  p.inHand && !p.folded && !p.allIn && (!p.acted || p.bet < room.hand.currentBet)

function findPlayer(room, id) {
  const p = room.players.find(p => p.id === id)
  if (!p) throw new Error('You are not at this table')
  return p
}

// ---------- room actions ----------

export function newRoom(code) {
  return { code, players: [], button: -1, hand: null, log: [] }
}

export function addPlayer(room, id, name, avatar = 0) {
  const existing = room.players.find(p => p.id === id)
  if (existing) {
    existing.name = name
    existing.avatar = avatar
    existing.left = false
    return
  }
  if (room.players.length >= MAX_PLAYERS) throw new Error('Table is full')
  room.players.push({
    id, name, avatar, chips: START_CHIPS, sitOut: false, left: false, action: '',
    cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, inHand: false,
  })
  log(room, `${name} sat down`)
}

export function leave(room, id) {
  const p = findPlayer(room, id)
  if (handActive(room)) {
    p.left = true // folded by tick() on their turn, removed before the next hand
  } else {
    const i = room.players.indexOf(p)
    room.players.splice(i, 1)
    if (i <= room.button) room.button--
  }
  log(room, `${p.name} left`)
}

export function setSitOut(room, id, sitOut) {
  findPlayer(room, id).sitOut = sitOut
}

export function rebuy(room, id) {
  const p = findPlayer(room, id)
  if (p.chips > 0) throw new Error('You still have chips')
  if (handActive(room) && p.inHand) throw new Error('Wait for the hand to finish')
  p.chips = START_CHIPS
  log(room, `${p.name} rebought ${START_CHIPS}`)
}

export function startHand(room, now, deck = shuffledDeck()) {
  if (handActive(room)) throw new Error('Hand already in progress')
  for (let i = room.players.length - 1; i >= 0; i--) {
    if (room.players[i].left) {
      room.players.splice(i, 1)
      if (i <= room.button) room.button--
    }
  }
  if (room.players.filter(canPlay).length < 2) throw new Error('Need at least 2 players with chips')

  for (const p of room.players) {
    Object.assign(p, { cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, action: '', handName: null, inHand: canPlay(p) })
  }
  room.button = nextIdx(room, room.button, p => p.inHand)
  room.handNo = (room.handNo || 0) + 1
  room.hand = { deck, board: [], currentBet: BIG_BLIND, minRaise: BIG_BLIND, toAct: -1, turnAt: now, done: false, showdown: false, results: [] }
  for (let round = 0; round < 2; round++) {
    for (const p of room.players) if (p.inHand) p.cards.push(deck.shift())
  }

  const headsUp = room.players.filter(p => p.inHand).length === 2
  const sb = headsUp ? room.button : nextIdx(room, room.button, p => p.inHand)
  const bb = nextIdx(room, sb, p => p.inHand)
  for (const [i, amount] of [[sb, SMALL_BLIND], [bb, BIG_BLIND]]) {
    const p = room.players[i]
    put(p, amount)
    p.action = p.allIn ? 'ALL-IN' : `BLIND ${p.bet}`
  }
  log(room, `New hand — ${room.players[room.button].name} has the button`)
  progress(room, now, bb)
}

export function act(room, id, action, amount, now) {
  const h = room.hand
  if (!handActive(room)) throw new Error('No hand in progress')
  const idx = room.players.findIndex(p => p.id === id)
  if (idx !== h.toAct) throw new Error('Not your turn')
  const p = room.players[idx]
  const toCall = h.currentBet - p.bet

  if (action === 'allin') {
    amount = p.bet + p.chips
    action = amount > h.currentBet ? 'raise' : 'call'
  }

  if (action === 'fold') {
    p.folded = true
    p.action = 'FOLD'
    log(room, `${p.name} folds`)
  } else if (action === 'check' || (action === 'call' && toCall === 0)) {
    if (toCall > 0) throw new Error(`Can't check, ${toCall} to call`)
    p.action = 'CHECK'
    log(room, `${p.name} checks`)
  } else if (action === 'call') {
    const paid = put(p, toCall)
    p.action = p.allIn ? 'ALL-IN' : `CALL ${paid}`
    log(room, `${p.name} calls ${paid}${p.allIn ? ' (all-in)' : ''}`)
  } else if (action === 'raise') {
    const max = p.bet + p.chips
    const target = Math.min(Math.floor(Number(amount)), max)
    if (!Number.isFinite(target) || target <= h.currentBet) throw new Error('Raise must be above the current bet')
    const increase = target - h.currentBet
    if (increase < h.minRaise && target < max) throw new Error(`Minimum raise is to ${h.currentBet + h.minRaise}`)
    const verb = h.currentBet === 0 ? 'bets' : 'raises to'
    if (increase >= h.minRaise) h.minRaise = increase
    h.currentBet = target
    put(p, target - p.bet)
    p.action = p.allIn ? 'ALL-IN' : `${verb === 'bets' ? 'BET' : 'RAISE'} ${target}`
    for (const o of room.players) if (o !== p) o.acted = false
    log(room, `${p.name} ${verb} ${target}${p.allIn ? ' (all-in)' : ''}`)
  } else {
    throw new Error('Unknown action')
  }
  p.acted = true
  progress(room, now, idx)
}

// Moves the hand forward: next player to act, next street, or showdown.
function progress(room, now, from) {
  const h = room.hand
  for (;;) {
    const live = room.players.filter(p => p.inHand && !p.folded)
    if (live.length === 1) return finish(room, now)
    const actors = live.filter(p => !p.allIn)
    const roundDone =
      actors.every(p => p.acted && p.bet >= h.currentBet) ||
      (actors.length <= 1 && actors.every(p => p.bet >= h.currentBet))
    if (!roundDone) {
      h.toAct = nextIdx(room, from, needsAction(room))
      h.turnAt = now
      return
    }
    for (const p of room.players) {
      p.bet = 0
      p.acted = false
      if (!p.folded && !p.allIn) p.action = ''
    }
    h.currentBet = 0
    h.minRaise = BIG_BLIND
    if (h.board.length === 5) return finish(room, now)
    h.board.push(...h.deck.splice(0, h.board.length ? 1 : 3))
    from = room.button
  }
}

export function buildPots(players) {
  const live = players.filter(p => p.inHand && !p.folded)
  const levels = [...new Set(players.filter(p => p.total > 0).map(p => p.total))].sort((a, b) => a - b)
  const pots = []
  let prev = 0
  for (const level of levels) {
    const amount = players.reduce((sum, p) => sum + Math.min(p.total, level) - Math.min(p.total, prev), 0)
    const eligible = live.filter(p => p.total >= level)
    prev = level
    const last = pots[pots.length - 1]
    if (last && (eligible.length === 0 || eligible.length === last.eligible.length)) last.amount += amount
    else pots.push({ amount, eligible })
  }
  return pots
}

function finish(room, now) {
  const h = room.hand
  h.done = true
  h.endedAt = now
  h.toAct = -1
  const live = room.players.filter(p => p.inHand && !p.folded)
  const won = new Map()

  if (live.length === 1) {
    const pot = room.players.reduce((sum, p) => sum + p.total, 0)
    won.set(live[0], pot)
  } else {
    h.showdown = true
    const best = new Map(live.map(p => [p, bestHand([...p.cards, ...h.board])]))
    const seatOrder = p => (room.players.indexOf(p) - room.button - 1 + room.players.length) % room.players.length
    for (const pot of buildPots(room.players)) {
      let winners = []
      for (const p of pot.eligible) {
        const cmp = winners.length ? compareScores(best.get(p).score, best.get(winners[0]).score) : 1
        if (cmp > 0) winners = [p]
        else if (cmp === 0) winners.push(p)
      }
      winners.sort((a, b) => seatOrder(a) - seatOrder(b))
      const share = Math.floor(pot.amount / winners.length)
      winners.forEach((p, i) => {
        const amount = share + (i === 0 ? pot.amount - share * winners.length : 0)
        won.set(p, (won.get(p) || 0) + amount)
      })
    }
    for (const p of live) p.handName = best.get(p).name
  }

  h.results = [...won].map(([p, amount]) => {
    p.chips += amount
    log(room, `${p.name} wins ${amount}${h.showdown ? ` with ${p.handName}` : ''}`)
    return { seat: room.players.indexOf(p), name: p.name, amount, hand: h.showdown ? p.handName : null }
  })
}

// Best hand so far, for the beginner strength meter: works from 2 cards (before the flop) up to 7.
// strength runs from 0 (High Card) to 9 (Royal Flush).
export function describeHand(cards) {
  if (cards.length >= 5) {
    const { score, name } = bestHand(cards)
    return { name, strength: name === 'Royal Flush' ? 9 : score[0] }
  }
  const pair = cards.length === 2 && cards[0][0] === cards[1][0]
  return { name: pair ? 'Pair' : 'High Card', strength: pair ? 1 : 0 }
}

// Called on every request: auto-acts for away players and deals the next hand.
export function tick(room, now) {
  const h = room.hand
  if (!h) return false
  if (!h.done) {
    const p = room.players[h.toAct]
    const away = p.sitOut || p.left
    if (!away && now - h.turnAt < TURN_MS) return false
    if (!away) {
      p.sitOut = true
      log(room, `${p.name} timed out and is sitting out`)
    }
    act(room, p.id, p.bet >= h.currentBet ? 'check' : 'fold', 0, now)
    return true
  }
  if (now - h.endedAt >= NEXT_HAND_MS && room.players.filter(canPlay).length >= 2) {
    startHand(room, now)
    return true
  }
  return false
}

// What one player is allowed to see.
export function view(room, id, now) {
  const h = room.hand
  const me = room.players.findIndex(p => p.id === id)
  const reveal = (p, i) => i === me || (h?.showdown && p.inHand && !p.folded)
  const mine = room.players[me]
  return {
    code: room.code,
    me,
    button: room.button,
    bigBlind: BIG_BLIND,
    turnMs: TURN_MS,
    players: room.players.map((p, i) => ({
      name: p.name,
      avatar: p.avatar ?? 0,
      action: p.action || '',
      chips: p.chips,
      bet: p.bet,
      folded: p.folded,
      allIn: p.allIn,
      inHand: p.inHand,
      sitOut: p.sitOut,
      left: p.left,
      cards: reveal(p, i) ? p.cards : p.cards.map(() => ''),
      handName: h?.showdown && p.inHand && !p.folded ? p.handName : null,
    })),
    hand: h && {
      no: room.handNo,
      board: h.board,
      pot: room.players.reduce((sum, p) => sum + p.total, 0),
      currentBet: h.currentBet,
      minRaise: h.minRaise,
      toAct: h.toAct,
      done: h.done,
      showdown: h.showdown,
      results: h.results,
      turnLeft: h.done ? 0 : Math.max(0, TURN_MS - (now - h.turnAt)),
      nextIn: h.done ? Math.max(0, NEXT_HAND_MS - (now - h.endedAt)) : 0,
      myHand: mine?.inHand && !mine.folded ? describeHand([...mine.cards, ...h.board]) : null,
    },
    log: room.log,
  }
}
