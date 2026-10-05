import * as sfx from './sfx.js'

const $ = s => document.querySelector(s)
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
}

const pid = store.get('pid') || crypto.randomUUID()
store.set('pid', pid)
let code = (new URLSearchParams(location.search).get('room') || '').toUpperCase()
let avatar = Math.min(5, Math.max(0, Number(store.get('avatar')) || 0))
let view = null
let pollTimer = null
let controlsKey = ''
let turnDeadline = 0
let potTimer = null
let fx = null
let logo = null

// ---------- look ----------

const FACE = (body) => `<svg class="face" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`
const AVATARS = [
  { name: 'Frog', bg: '#FFC233', svg: FACE('<circle cx="31" cy="30" r="15" fill="#6BD96B" stroke="#1F4D2B" stroke-width="4"/><circle cx="69" cy="30" r="15" fill="#6BD96B" stroke="#1F4D2B" stroke-width="4"/><ellipse cx="50" cy="60" rx="38" ry="28" fill="#6BD96B" stroke="#1F4D2B" stroke-width="4"/><circle cx="31" cy="30" r="7" fill="#fff"/><circle cx="33" cy="31" r="4" fill="#1F4D2B"/><circle cx="69" cy="30" r="7" fill="#fff"/><circle cx="67" cy="31" r="4" fill="#1F4D2B"/><path d="M32 64 Q50 78 68 64" fill="none" stroke="#1F4D2B" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="62" r="4" fill="#FF8FB1"/><circle cx="75" cy="62" r="4" fill="#FF8FB1"/>') },
  { name: 'Bear', bg: '#1F7AE0', svg: FACE('<circle cx="24" cy="28" r="13" fill="#B97A4B" stroke="#3B2416" stroke-width="4"/><circle cx="76" cy="28" r="13" fill="#B97A4B" stroke="#3B2416" stroke-width="4"/><circle cx="50" cy="56" r="34" fill="#C98B5A" stroke="#3B2416" stroke-width="4"/><ellipse cx="50" cy="68" rx="15" ry="11" fill="#F4D9BC" stroke="#3B2416" stroke-width="3"/><ellipse cx="50" cy="63" rx="6" ry="4.5" fill="#3B2416"/><circle cx="37" cy="50" r="4.5" fill="#3B2416"/><circle cx="63" cy="50" r="4.5" fill="#3B2416"/><path d="M44 72 Q50 77 56 72" fill="none" stroke="#3B2416" stroke-width="3" stroke-linecap="round"/>') },
  { name: 'Cat', bg: '#E8413C', svg: FACE('<polygon points="20,44 26,10 48,30" fill="#FF9F43" stroke="#3B2416" stroke-width="4" stroke-linejoin="round"/><polygon points="80,44 74,10 52,30" fill="#FF9F43" stroke="#3B2416" stroke-width="4" stroke-linejoin="round"/><ellipse cx="50" cy="58" rx="35" ry="31" fill="#FFAE5C" stroke="#3B2416" stroke-width="4"/><circle cx="37" cy="54" r="4.5" fill="#3B2416"/><circle cx="63" cy="54" r="4.5" fill="#3B2416"/><path d="M46 63 L54 63 L50 68 Z" fill="#E8417A"/><path d="M50 68 Q45 74 40 70 M50 68 Q55 74 60 70" fill="none" stroke="#3B2416" stroke-width="3" stroke-linecap="round"/>') },
  { name: 'Panda', bg: '#2DB84D', svg: FACE('<circle cx="24" cy="28" r="12" fill="#26324B"/><circle cx="76" cy="28" r="12" fill="#26324B"/><circle cx="50" cy="56" r="34" fill="#fff" stroke="#26324B" stroke-width="4"/><ellipse cx="37" cy="52" rx="8" ry="10" fill="#26324B" transform="rotate(-20 37 52)"/><ellipse cx="63" cy="52" rx="8" ry="10" fill="#26324B" transform="rotate(20 63 52)"/><circle cx="38" cy="51" r="3" fill="#fff"/><circle cx="62" cy="51" r="3" fill="#fff"/><ellipse cx="50" cy="66" rx="6" ry="4.5" fill="#26324B"/><path d="M45 73 Q50 77 55 73" fill="none" stroke="#26324B" stroke-width="3" stroke-linecap="round"/>') },
  { name: 'Fox', bg: '#8E5CF7', svg: FACE('<polygon points="16,46 22,8 46,30" fill="#F26B2A" stroke="#3B2416" stroke-width="4" stroke-linejoin="round"/><polygon points="84,46 78,8 54,30" fill="#F26B2A" stroke="#3B2416" stroke-width="4" stroke-linejoin="round"/><path d="M14 46 Q50 22 86 46 Q80 84 50 92 Q20 84 14 46 Z" fill="#F7843E" stroke="#3B2416" stroke-width="4" stroke-linejoin="round"/><path d="M24 58 Q38 60 50 80 Q62 60 76 58 Q72 80 50 88 Q28 80 24 58 Z" fill="#FFF3E6"/><circle cx="37" cy="54" r="4.5" fill="#3B2416"/><circle cx="63" cy="54" r="4.5" fill="#3B2416"/><ellipse cx="50" cy="77" rx="5" ry="4" fill="#3B2416"/>') },
  { name: 'Bunny', bg: '#FF8FB1', svg: FACE('<ellipse cx="36" cy="24" rx="9" ry="22" fill="#fff" stroke="#3B2416" stroke-width="4"/><ellipse cx="64" cy="24" rx="9" ry="22" fill="#fff" stroke="#3B2416" stroke-width="4"/><ellipse cx="36" cy="26" rx="4" ry="13" fill="#FF8FB1"/><ellipse cx="64" cy="26" rx="4" ry="13" fill="#FF8FB1"/><circle cx="50" cy="62" r="30" fill="#fff" stroke="#3B2416" stroke-width="4"/><circle cx="40" cy="58" r="4" fill="#3B2416"/><circle cx="60" cy="58" r="4" fill="#3B2416"/><ellipse cx="50" cy="67" rx="4" ry="3" fill="#FF8FB1"/><path d="M44 75 Q50 80 56 75" fill="none" stroke="#3B2416" stroke-width="3" stroke-linecap="round"/>') },
]

// ︎ keeps suits as text instead of emoji on phones
const SUITS = { s: ['♠︎', 'spades'], h: ['♥︎', 'hearts'], d: ['♦︎', 'diamonds'], c: ['♣︎', 'clubs'] }
const RANKS = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' }

function cardHtml(c, cls = '', style = '') {
  if (!c) return `<div class="card back ${cls}" style="${style}"></div>`
  const rank = c[0] === 'T' ? '10' : c[0]
  const [suit, suitName] = SUITS[c[1]]
  const red = c[1] === 'h' || c[1] === 'd'
  return `<div class="card ${red ? 'red' : ''} ${cls}" style="${style}" role="img" aria-label="${RANKS[c[0]] || rank} of ${suitName}">
    <span class="corner tl">${rank}<i>${suit}</i></span><span class="pip">${suit}</span><span class="corner br">${rank}<i>${suit}</i></span></div>`
}

const RIBBON_COLORS = { FOLD: '#5B6B8C', CHECK: '#5B6B8C', CALL: '#2DB84D', BET: '#1F7AE0', RAISE: '#1F7AE0', 'ALL-IN': '#FF7A1A', BLIND: '#8E5CF7' }
const ribbonColor = label => RIBBON_COLORS[label.split(' ')[0]] || '#5B6B8C'

const ringHtml = '<svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect class="track" x="2" y="2" width="96" height="96" rx="30" pathLength="100"/><rect class="left" x="2" y="2" width="96" height="96" rx="30" pathLength="100"/></svg>'

// ---------- talking to the server ----------

function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 3000)
}

async function send(body) {
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, code, avatar, ...body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  } catch (e) {
    toast(e.message || 'Network error')
    return null
  }
}

async function poll() {
  clearTimeout(pollTimer)
  try {
    const res = await fetch(`/api/room?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(pid)}`)
    const data = await res.json()
    if (res.ok) render(data)
    else if (data.error === 'Table not found') return exitTable('That table no longer exists')
  } catch {}
  if (code) pollTimer = setTimeout(poll, 1500)
}

// ---------- screens ----------

function enterTable(data) {
  code = data.code
  history.replaceState(null, '', `?room=${code}`)
  $('#lobby').hidden = true
  $('#game').hidden = false
  $('#roomCode').textContent = code
  document.body.classList.add('ingame')
  logo?.stop()
  fx?.start()
  view = null
  render(data)
  pollTimer = setTimeout(poll, 1500)
}

function exitTable(msg) {
  clearTimeout(pollTimer)
  code = ''
  view = null
  history.replaceState(null, '', location.pathname)
  $('#game').hidden = true
  $('#lobby').hidden = false
  document.body.classList.remove('ingame')
  fx?.stop()
  logo?.start()
  if (msg) toast(msg)
}

// Screen point (viewport px) at the centre of an element, for the 3D effects.
function centerOf(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
function seatPoint(i) {
  if (view && i === view.me) return centerOf($('#mycards .card')) || centerOf($('#me .avatar'))
  return centerOf($(`.seat[data-i="${i}"] .avatar`))
}
function potPoint() {
  const r = $('#pot').getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top - 16 }
}
const potChips = pot => Math.min(36, Math.ceil(Math.sqrt(pot / 20) * 3))

function fitTable() {
  if (!fx || $('#game').hidden) return
  fx.resize()
  fx.fit($('#stage').getBoundingClientRect())
}
function syncPot(delay) {
  clearTimeout(potTimer)
  potTimer = setTimeout(() => {
    const h = view?.hand
    if (fx && h && !h.done) fx.setPot(potPoint(), potChips(h.pot))
  }, delay)
}

// ---------- rendering ----------

function render(v) {
  const prev = view
  view = v
  if (v.me < 0) return exitTable()
  renderSeats(v)
  renderCenter(v, prev)
  renderMe(v, prev)
  renderControls(v)
  renderGuideHighlight()
  const last = v.log[v.log.length - 1] || ''
  if ($('#ticker').dataset.text !== last) {
    $('#ticker').dataset.text = last
    $('#ticker').innerHTML = last ? `<span>${esc(last)}</span>` : ''
  }
  fitTable()
  effects(prev, v)
}

function seatLayout(count) {
  const narrow = matchMedia('(max-width: 760px)').matches
  const rx = narrow ? 37 : 45
  const ry = narrow ? 40 : 40
  return k => {
    const a = (90 + ((k + 1) * 360) / (count + 1)) * (Math.PI / 180)
    return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a), cos: Math.cos(a), sin: Math.sin(a) }
  }
}

function renderSeats(v) {
  const h = v.hand
  const active = h && !h.done
  const n = v.players.length
  const others = []
  for (let k = 1; k < n; k++) others.push((v.me + k) % n)
  const place = seatLayout(others.length)
  const box = $('#seats')
  const key = others.join(',') + ':' + n
  if (box.dataset.key !== key) {
    box.dataset.key = key
    box.innerHTML = others.map(i => `<div class="seat" data-i="${i}"></div>`).join('')
  }
  others.forEach((i, k) => {
    const p = v.players[i]
    const el = box.querySelector(`[data-i="${i}"]`)
    const pos = place(k)
    el.style.left = pos.x + '%'
    el.style.top = pos.y + '%'
    el.classList.toggle('out', p.folded || p.sitOut || p.left || (active && !p.inHand))
    const turn = active && h.toAct === i
    const av = AVATARS[p.avatar] || AVATARS[0]
    const ribbon = p.left ? 'LEFT' : p.sitOut ? 'SITTING OUT' : p.action
    const showCards = p.cards.length > 0 && !p.folded
    const html = `
      <div class="avatar ${turn ? 'turn' : ''}" style="--bg:${av.bg}">${av.svg}
        ${h && i === v.button ? '<span class="dealer" title="Dealer">D</span>' : ''}
        ${turn ? ringHtml : ''}
        ${showCards ? `<div class="hole ${p.cards[0] ? 'up' : ''}">${p.cards.map(c => cardHtml(c)).join('')}</div>` : ''}
        ${p.bet ? `<div class="betchip" style="--dx:${pos.cos.toFixed(3)};--dy:${pos.sin.toFixed(3)}"><span class="chipicon"></span>${p.bet}</div>` : ''}
      </div>
      <div class="plate"><b>${esc(p.name)}</b><span>${p.chips.toLocaleString('en-US')}</span></div>
      ${ribbon ? `<span class="ribbon" style="--k:${ribbonColor(ribbon)}">${esc(ribbon)}</span>` : ''}
      ${p.handName ? `<span class="handtag">${esc(p.handName)}</span>` : ''}`
    if (el.dataset.html !== html) {
      el.dataset.html = html
      el.innerHTML = html
      startRing(el.querySelector('.ring'), h)
    }
  })
}

// The ring empties over the turn; start it part-way through if the turn began earlier.
function startRing(ring, h) {
  if (!ring) return
  const left = ring.querySelector('.left')
  left.style.animationDuration = view.turnMs + 'ms'
  left.style.animationDelay = -(view.turnMs - h.turnLeft) + 'ms'
}

function renderCenter(v, prev) {
  const h = v.hand
  $('#pot').textContent = `POT ${(h ? h.pot : 0).toLocaleString('en-US')}`
  const board = $('#board')
  const boardKey = h ? `${h.no}:${h.board.join(',')}` : ''
  if (board.dataset.key !== boardKey) {
    const sameHand = prev?.hand && h && prev.hand.no === h.no
    const before = sameHand ? prev.hand.board.length : h ? h.board.length : 0
    board.dataset.key = boardKey
    board.innerHTML = [0, 1, 2, 3, 4].map(i => {
      const c = h?.board[i]
      if (!c) return '<div class="slot"></div>'
      const fresh = i >= before
      return cardHtml(c, fresh ? 'flip' : '', fresh ? `animation-delay:${(i - before) * 140}ms` : '')
    }).join('')
  }

  const banner = $('#banner')
  if (h?.done && h.results.length) {
    const bannerKey = 'b' + h.no
    if (banner.dataset.key !== bannerKey) {
      banner.dataset.key = bannerKey
      const mine = h.results.find(r => r.seat === v.me)
      const total = h.results.reduce((s, r) => s + r.amount, 0)
      const title = h.results.length > 1 ? 'SPLIT POT!' : mine ? `YOU WIN ${mine.amount}!` : `${h.results[0].name} wins ${total}`
      const why = h.results.length > 1
        ? h.results.map(r => `${r.name} +${r.amount}`).join(' · ')
        : h.results[0].hand ? `with ${h.results[0].hand}` : 'Everyone else folded'
      banner.innerHTML = `<b>${esc(title)}</b><span>${esc(why)}</span>`
      banner.hidden = false
    }
  } else {
    banner.hidden = true
    banner.dataset.key = ''
  }
}

function renderMe(v, prev) {
  const h = v.hand
  const me = v.players[v.me]
  const active = h && !h.done
  const turn = active && h.toAct === v.me
  const av = AVATARS[me.avatar] || AVATARS[0]
  const ribbon = me.sitOut ? 'SITTING OUT' : me.action
  const html = `
    <div class="avatar ${turn ? 'turn' : ''}" style="--bg:${av.bg}">${av.svg}
      ${h && v.me === v.button ? '<span class="dealer" title="Dealer">D</span>' : ''}
      ${turn ? ringHtml : ''}
    </div>
    <div class="plate"><b>${esc(me.name)}</b><span>${me.chips.toLocaleString('en-US')}</span></div>
    ${ribbon ? `<span class="ribbon" style="--k:${ribbonColor(ribbon)}">${esc(ribbon)}</span>` : ''}`
  const box = $('#me')
  if (box.dataset.html !== html) {
    box.dataset.html = html
    box.innerHTML = html
    startRing(box.querySelector('.ring'), h)
  }

  const cards = $('#mycards')
  const cardKey = h ? `${h.no}:${me.cards.join(',')}` : ''
  if (cards.dataset.key !== cardKey) {
    cards.dataset.key = cardKey
    cards.innerHTML = me.cards.map(c => cardHtml(c)).join('')
    cards.className = 'mycards' + (prev && prev.hand?.no !== h?.no && me.cards.length ? ' deal' : '')
  }
  if (me.folded) cards.classList.add('folded')

  const helper = $('#helper')
  const mh = active ? h.myHand : null
  helper.hidden = !mh
  if (mh) {
    const tip = mh.strength >= 3 ? 'Strong! Try a raise' : mh.strength === 2 ? 'Good hand' : mh.strength === 1 ? 'Decent' : 'Weak: careful with big bets'
    const meter = Array.from({ length: 10 }, (_, i) => `<i class="${i <= mh.strength ? 'on' : ''}"></i>`).join('')
    const html = `<div class="label"><small>YOU HAVE</small><b>${esc(mh.name.toUpperCase())}</b></div>
      <div><div class="meter" role="img" aria-label="Strength ${mh.strength + 1} of 10">${meter}</div><span class="tip">${tip}</span></div>
      <button data-guide>All hands ›</button>`
    if (helper.dataset.html !== html) {
      helper.dataset.html = html
      helper.innerHTML = html
    }
  }
}

function renderControls(v) {
  const h = v.hand
  const me = v.players[v.me]
  const box = $('#actions')
  const myTurn = h && !h.done && h.toAct === v.me
  turnDeadline = myTurn ? Date.now() + h.turnLeft : 0
  updateTimer()

  if (!myTurn) {
    const canPlay = v.players.filter(p => p.chips > 0 && !p.sitOut && !p.left).length
    let msg
    const buttons = []
    if (me.sitOut) {
      msg = 'You are sitting out.'
      buttons.push('<button class="chunky green" data-op="back">I’M BACK</button>')
    } else if (!h) {
      msg = canPlay >= 2 ? 'Everyone here? Deal the first hand!' : 'Waiting for friends… tap the link icon to invite them.'
      if (canPlay >= 2) buttons.push('<button class="chunky yellow" data-op="start">DEAL</button>')
    } else if (h.done) {
      msg = canPlay >= 2 ? `Next hand in ${Math.ceil(h.nextIn / 1000)}s…` : 'Waiting for more players…'
    } else if (!me.inHand) {
      msg = 'You’ll join the next hand.'
    } else if (me.folded) {
      msg = 'You folded. Watch and learn!'
    } else {
      msg = `Waiting for ${esc(v.players[h.toAct].name)}…`
    }
    if (me.chips === 0 && !(h && !h.done && me.inHand)) buttons.push('<button class="chunky yellow" data-op="rebuy">REBUY 1000</button>')
    if (!me.sitOut) buttons.push('<button class="chunky ghost" data-op="sitout">Sit out</button>')
    const html = `<div class="status"><p>${msg}</p>${buttons.join('')}</div>`
    if (html !== controlsKey) box.innerHTML = controlsKey = html
    return
  }

  // Only rebuild the betting controls when the situation changes, so the raise amount keeps its value.
  const key = `turn-${h.no}-${h.board.length}-${h.currentBet}-${me.bet}-${me.chips}`
  if (key === controlsKey) return
  controlsKey = key
  const toCall = Math.min(h.currentBet - me.bet, me.chips)
  const maxTo = me.bet + me.chips
  const minTo = Math.min(h.currentBet + h.minRaise, maxTo)
  const canRaise = maxTo > minTo
  const word = h.currentBet === 0 ? 'BET' : 'RAISE'
  box.innerHTML = `
    <div class="turnbar">
      <span class="yourturn">YOUR TURN!</span><span class="timer" id="timer"></span>
      ${canRaise ? `<div class="stepper">
        <label for="raiseTo">${word === 'BET' ? 'Bet' : 'Raise to'}</label>
        <button data-step="-1" aria-label="Less">−</button>
        <input id="raiseTo" type="number" inputmode="numeric" min="${minTo}" max="${maxTo}" step="${v.bigBlind}" value="${minTo}">
        <button data-step="1" aria-label="More">+</button>
      </div>` : ''}
    </div>
    <div class="btnrow">
      ${toCall > 0 ? '<div class="col"><button class="chunky red act" data-act="fold">FOLD</button><small>Give up this hand</small></div>' : ''}
      <div class="col"><button class="chunky blue act" data-act="${toCall > 0 ? 'call' : 'check'}">${toCall > 0 ? `CALL ${toCall}` : 'CHECK'}</button><small>${toCall > 0 ? 'Match the bet' : 'Pass for free'}</small></div>
      ${canRaise ? `<div class="col"><button class="chunky green act" data-act="raise">${word}</button><small>Bet more</small></div>` : ''}
      ${maxTo > h.currentBet ? '<div class="col"><button class="allin" data-act="allin">ALL<br>IN</button><small>Bet everything</small></div>' : ''}
    </div>`
  updateTimer()
}

function updateTimer() {
  const t = $('#timer')
  if (t && turnDeadline) t.textContent = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000)) + 's'
}
setInterval(updateTimer, 250)

// ---------- animation and sound triggers ----------

function effects(prev, v) {
  const h = v.hand
  const ph = prev?.hand
  if (!h) return
  if (!prev || !ph || ph.no !== h.no) {
    if (prev) {
      sfx.play('shuffle')
      fx?.deal(v.players.map((p, i) => (p.inHand ? seatPoint(i) : null)).filter(Boolean), () => sfx.play('card'))
    }
    syncPot(prev ? 1200 : 0)
    if (h.toAct === v.me && !h.done) setTimeout(() => sfx.play('turn'), prev ? 1200 : 0)
    return
  }

  for (let i = 0; i < h.board.length - ph.board.length; i++) setTimeout(() => sfx.play('place'), 200 + i * 140)

  let tossed = false
  v.players.forEach((p, i) => {
    const q = prev.players[i]
    if (!q || q.name !== p.name) return
    const paid = q.chips - p.chips
    if (paid > 0) {
      tossed = true
      const allIn = p.allIn && !q.allIn
      fx?.toss(seatPoint(i), Math.min(14, 2 + Math.round(paid / v.bigBlind)))
      if (allIn) fx?.shake()
      sfx.play(allIn ? 'allin' : 'chips')
    }
    if (p.folded && !q.folded) {
      fx?.fold(seatPoint(i))
      sfx.play('fold')
    }
  })

  if (h.done && !ph.done) {
    clearTimeout(potTimer)
    setTimeout(() => {
      fx?.win(h.results.map(r => seatPoint(r.seat)).filter(Boolean))
      sfx.play('win')
    }, tossed ? 900 : 300)
  } else {
    syncPot(tossed ? 900 : 0)
  }

  const myTurn = x => x.hand && !x.hand.done && x.hand.toAct === x.me
  if (myTurn(v) && !myTurn(prev)) sfx.play('turn')
}

// ---------- hand guide ----------

const GUIDE_HANDS = [
  ['Royal Flush', 'A K Q J 10, all the same suit. The rarest hand!', 'As Ks Qs Js Ts'],
  ['Straight Flush', '5 in a row, all the same suit.', '9h 8h 7h 6h 5h'],
  ['Four of a Kind', '4 cards of the same rank.', 'Qc Qd Qh Qs 4d-'],
  ['Full House', 'Three of a kind + a pair.', '8s 8h 8d Kc Kh'],
  ['Flush', 'Any 5 cards of the same suit.', 'Ad Jd 8d 6d 2d'],
  ['Straight', '5 in a row, any suits.', 'Tc 9d 8s 7h 6c'],
  ['Three of a Kind', '3 cards of the same rank.', '7h 7c 7d Ks- 2c-'],
  ['Two Pair', '2 different pairs.', 'Jh Jc 4s 4d 9c-'],
  ['Pair', '2 cards of the same rank.', 'Th Ts Kd- 5c- 3h-'],
  ['High Card', 'Nothing matches? Your highest card counts.', 'Ac Jd- 8h- 5s- 2c-'],
]
const GUIDE_STEPS = [
  ['Deal', 'Everyone gets 2 secret cards. Two players put in small starter bets (the blinds), so there is something to win.', '2 secret cards', '#E8413C'],
  ['Flop', '3 shared cards land in the middle. Everyone can use them.', 'Then everyone bets', '#1F7AE0'],
  ['Turn', '1 more shared card.', 'Then everyone bets', '#2DB84D'],
  ['River', 'The last shared card. Now there are 5.', 'Last chance to bet', '#8E5CF7'],
  ['Showdown', 'Players still in show their cards. The best 5-card hand takes the whole pot!', 'Winner takes the pot', '#FF7A1A'],
]
const GUIDE_BUTTONS = [
  ['FOLD', '#E8413C', '#A82420', 'Give up this hand. You only lose what you already bet.', 'your cards are weak and someone bets.'],
  ['CHECK', '#5B6B8C', '#3A4763', 'Pass without betting. Only possible when nobody has bet yet.', 'you want a free look at the next card.'],
  ['CALL', '#1F7AE0', '#11519A', 'Match the current bet to stay in the hand.', 'your hand is OK and the bet is small.'],
  ['RAISE', '#2DB84D', '#1B7A31', 'Bet more than the current bet. Others must match it or fold.', 'you have a strong hand (Two Pair or better).'],
  ['ALL-IN', '#FF7A1A', '#B34F00', 'Bet all your chips at once. Big risk, big reward.', 'you are very sure, or almost out of chips.'],
]
let guideTab = 'hands'

function miniCards(spec) {
  return spec.split(' ').map(code => {
    const faded = code.endsWith('-')
    const c = faded ? code.slice(0, -1) : code
    const [suit] = SUITS[c[1]]
    const red = c[1] === 'h' || c[1] === 'd'
    return `<span class="mini ${red ? 'red' : ''} ${faded ? 'faded' : ''}">${c[0] === 'T' ? '10' : c[0]}<i>${suit}</i></span>`
  }).join('')
}

function renderGuide(animate = true) {
  const body = $('#guideBody')
  body.classList.toggle('animate', animate)
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === guideTab)))
  const mine = view?.hand && !view.hand.done ? view.hand.myHand?.name : null
  body.dataset.mine = String(mine)
  if (guideTab === 'hands') {
    body.innerHTML = `<div class="note"><span>Build the <b>best 5 cards</b> from your 2 secret cards + the 5 shared cards. <b>Higher on this list wins.</b></span></div>` +
      GUIDE_HANDS.map(([name, desc, spec], i) => `
        <div class="handrow ${name === mine ? 'mine' : ''}" style="animation-delay:${i * 40}ms">
          <span class="badge" style="--k:${name === mine ? '#FF7A1A' : i < 3 ? '#8E5CF7' : i < 6 ? '#1F7AE0' : '#2DB84D'}">${i + 1}</span>
          <div class="text"><span class="name">${name}${name === mine ? '<span class="you">YOU HAVE THIS</span>' : ''}</span><span class="desc">${desc}</span></div>
          <div class="minis">${miniCards(spec)}</div>
        </div>`).join('') +
      '<div class="note"><span>Faded cards don’t count. Same hand? The higher cards win.</span></div>'
  } else if (guideTab === 'play') {
    body.innerHTML = GUIDE_STEPS.map(([title, desc, tag, color], i) => `
      <div class="step" style="animation-delay:${i * 60}ms">
        <div class="dot"><b style="--k:${color}">${i + 1}</b><span></span></div>
        <div class="body"><h3>${title}</h3><p>${desc}</p><em>${tag}</em></div>
      </div>`).join('') +
      '<div class="note warm"><span><b>Shortcut:</b> if everyone else folds, you win the pot right away and never have to show your cards.</span></div>'
  } else {
    body.innerHTML = GUIDE_BUTTONS.map(([label, color, shade, what, when], i) => `
      <div class="btnhelp" style="animation-delay:${i * 60}ms">
        <span class="chip" style="--k:${color};--shade:${shade}">${label}</span>
        <div><p><b>${what}</b></p><p><b>Use it when</b> ${when}</p></div>
      </div>`).join('')
  }
}
function renderGuideHighlight() {
  if (!$('#guide').hidden && guideTab === 'hands') {
    const mine = view?.hand && !view.hand.done ? view.hand.myHand?.name : null
    if ($('#guideBody').dataset.mine !== String(mine)) renderGuide(false)
  }
}
function openGuide() {
  guideTab = 'hands'
  renderGuide()
  $('#guide').hidden = false
  $('#scrim').hidden = false
  $('#guideClose').focus()
}
function closeGuide() {
  $('#guide').hidden = true
  $('#scrim').hidden = true
}

// ---------- events ----------

document.addEventListener('pointerdown', sfx.unlock, { passive: true })
document.addEventListener('keydown', e => {
  sfx.unlock()
  if (e.key === 'Escape' && !$('#guide').hidden) closeGuide()
})

document.addEventListener('click', e => {
  const btn = e.target.closest('button')
  if (!btn) return
  if (btn.matches('[data-guide]')) return openGuide()
  if (btn.dataset.tab) {
    guideTab = btn.dataset.tab
    return renderGuide()
  }
  if (btn.dataset.step) {
    const input = $('#raiseTo')
    const next = Number(input.value) + Number(btn.dataset.step) * view.bigBlind
    input.value = Math.min(Number(input.max), Math.max(Number(input.min), next))
    sfx.play('click')
    return
  }
  if (btn.dataset.act || btn.dataset.op) act(btn)
})

async function act(btn) {
  sfx.play('click')
  btn.disabled = true
  const body = btn.dataset.act
    ? { op: 'act', action: btn.dataset.act, amount: Number($('#raiseTo')?.value) }
    : { op: btn.dataset.op }
  const data = await send(body)
  controlsKey = ''
  if (data) render(data)
  else if (view) renderControls(view)
}

$('#guideClose').onclick = closeGuide
$('#scrim').onclick = closeGuide

$('#avatars').innerHTML = AVATARS.map((a, i) =>
  `<button class="avatar-pick" role="radio" aria-checked="${i === avatar}" aria-label="${a.name}" data-avatar="${i}" style="--bg:${a.bg}">${a.svg}</button>`).join('')
$('#avatars').addEventListener('click', e => {
  const b = e.target.closest('[data-avatar]')
  if (!b) return
  avatar = Number(b.dataset.avatar)
  store.set('avatar', avatar)
  document.querySelectorAll('.avatar-pick').forEach(x => x.setAttribute('aria-checked', String(x === b)))
  sfx.play('click')
})

async function join(op) {
  const name = $('#name').value.trim()
  if (!name) return toast('Enter your name')
  store.set('name', name)
  if (op === 'join') code = $('#code').value.trim().toUpperCase()
  if (op === 'join' && code.length !== 4) return toast('Enter the 4-letter table code')
  const data = await send({ op, name })
  if (data) enterTable(data)
}

$('#create').onclick = () => join('create')
$('#join').onclick = () => join('join')
$('#code').onkeydown = e => {
  if (e.key === 'Enter') join('join')
}
$('#name').onkeydown = e => {
  if (e.key === 'Enter') join($('#code').value ? 'join' : 'create')
}
$('#leave').onclick = async () => {
  if (await send({ op: 'leave' })) exitTable()
}
$('#invite').onclick = async () => {
  const link = `${location.origin}/?room=${code}`
  try {
    await navigator.clipboard.writeText(link)
    toast('Invite link copied!')
  } catch {
    prompt('Share this link', link)
  }
}
const soundBtn = $('#sound')
const showSound = () => {
  soundBtn.classList.toggle('muted', sfx.isMuted())
  soundBtn.setAttribute('aria-label', sfx.isMuted() ? 'Turn sound on' : 'Turn sound off')
}
soundBtn.onclick = () => {
  sfx.setMuted(!sfx.isMuted())
  showSound()
}
showSound()

addEventListener('resize', () => {
  fitTable()
  logo?.resize()
  if (view) {
    $('#seats').dataset.key = ''
    renderSeats(view)
    syncPot(0)
  }
})
addEventListener('scroll', () => {
  fitTable()
  syncPot(0)
}, { passive: true })

// 3D is optional: the game still works if WebGL or the three.js file is unavailable.
import('./scene.js')
  .then(scene => {
    try {
      fx = scene.createTable($('#table3d'))
      if (!$('#game').hidden) {
        fx.start()
        fitTable()
        syncPot(0)
      }
    } catch {
      document.body.classList.add('no3d')
    }
    try {
      logo = scene.createLogo($('#logo3d'))
      if (!$('#lobby').hidden) logo.start()
    } catch {}
  })
  .catch(() => document.body.classList.add('no3d'))

$('#name').value = store.get('name') || ''
$('#code').value = code
if (code && store.get('name')) join('join')
