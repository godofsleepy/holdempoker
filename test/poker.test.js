import test from 'node:test'
import assert from 'node:assert/strict'
import * as poker from '../lib/poker.js'

const hand = cards => poker.bestHand(cards.split(' '))
const beats = (a, b) => assert.ok(poker.compareScores(hand(a).score, hand(b).score) > 0, `${a} should beat ${b}`)

test('hand names', () => {
  assert.equal(hand('As Ks Qs Js Ts 2d 3c').name, 'Royal Flush')
  assert.equal(hand('9s 8s 7s 6s 5s 2d 3c').name, 'Straight Flush')
  assert.equal(hand('9s 9d 9h 9c 5s 2d 3c').name, 'Four of a Kind')
  assert.equal(hand('9s 9d 9h 5c 5s 2d 3c').name, 'Full House')
  assert.equal(hand('As 9s 7s 5s 2s Kd 3c').name, 'Flush')
  assert.equal(hand('Ah 2s 3d 4c 5s 9d Jc').name, 'Straight')
  assert.equal(hand('9s 9d 9h 5c 4s 2d Jc').name, 'Three of a Kind')
  assert.equal(hand('9s 9d 5h 5c 4s 2d Jc').name, 'Two Pair')
  assert.equal(hand('9s 9d 5h 7c 4s 2d Jc').name, 'Pair')
  assert.equal(hand('9s Td 5h 7c 4s 2d Jc').name, 'High Card')
})

test('hand ordering', () => {
  beats('2s 3s 4s 5s 6s', 'As Ad Ah Ac Ks')
  beats('6h 2s 3d 4c 5s', 'Ah 2s 3d 4c 5s') // 6-high straight beats wheel
  beats('Kh Kd 5s 5c 9h', 'Kh Kd 5s 5c 8h') // kicker
  beats('Ah Ad 2s 2c 3h', 'Kh Kd Qs Qc Jh')
  beats('2h 2d 2s 3c 3h', 'Ah Kh Qh Jh 9h')
  assert.equal(poker.compareScores(hand('Ah Kd Qs Jc 9h 2c 3d').score, hand('As Kh Qd Jh 9c 4c 5d').score), 0)
})

test('side pots', () => {
  const p = (total, folded = false) => ({ total, folded, inHand: true })
  const a = p(50), b = p(200), c = p(200), d = p(100, true)
  const pots = poker.buildPots([a, b, c, d])
  assert.deepEqual(pots.map(x => x.amount), [200, 350])
  assert.deepEqual(pots[0].eligible, [a, b, c])
  assert.deepEqual(pots[1].eligible, [b, c])
})

function table(n) {
  const room = poker.newRoom('TEST')
  for (let i = 0; i < n; i++) poker.addPlayer(room, `player-${i}`, `P${i}`)
  return room
}
const totalChips = room => room.players.reduce((s, p) => s + p.chips + (room.hand?.done ? 0 : p.total), 0)

test('heads-up hand to showdown', () => {
  const room = table(2)
  // seat 0 (button) gets As Ah, seat 1 gets Kd Kc; board 2c 7d 9h Js 3s
  poker.startHand(room, 0, ['As', 'Kd', 'Ah', 'Kc', '2c', '7d', '9h', 'Js', '3s'])
  const h = room.hand
  assert.equal(room.button, 0)
  assert.equal(h.toAct, 0) // heads-up: button/small blind acts first preflop
  poker.act(room, 'player-0', 'call', 0, 0)
  poker.act(room, 'player-1', 'check', 0, 0)
  assert.equal(h.board.length, 3)
  assert.equal(h.toAct, 1) // big blind acts first after the flop
  for (let street = 0; street < 3; street++) {
    poker.act(room, 'player-1', 'check', 0, 0)
    poker.act(room, 'player-0', 'check', 0, 0)
  }
  assert.ok(h.done && h.showdown)
  assert.equal(room.players[0].chips, 1020)
  assert.equal(room.players[1].chips, 980)
})

test('fold wins the pot', () => {
  const room = table(3)
  poker.startHand(room, 0)
  const first = room.players[room.hand.toAct]
  poker.act(room, first.id, 'raise', 60, 0)
  for (const p of room.players) if (p !== first) poker.act(room, p.id, 'fold', 0, 0)
  assert.ok(room.hand.done)
  assert.equal(first.chips, 1030)
  assert.equal(totalChips(room), 3000)
})

test('rejects bad actions', () => {
  const room = table(3)
  poker.startHand(room, 0)
  const p = room.players[room.hand.toAct]
  const other = room.players.find(o => o !== p)
  assert.throws(() => poker.act(room, other.id, 'call', 0, 0), /Not your turn/)
  assert.throws(() => poker.act(room, p.id, 'check', 0, 0), /Can't check/)
  assert.throws(() => poker.act(room, p.id, 'raise', 30, 0), /Minimum raise/)
})

test('timeout folds and sits out the player', () => {
  const room = table(2)
  poker.startHand(room, 0)
  const p = room.players[room.hand.toAct]
  assert.equal(poker.tick(room, 1000), false)
  assert.equal(poker.tick(room, poker.TURN_MS), true)
  assert.ok(p.folded && p.sitOut && room.hand.done)
})

test('random play never creates or loses chips', () => {
  let seed = 42
  const rand = n => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n)
  for (let game = 0; game < 30; game++) {
    const room = table(2 + (game % 7))
    const start = totalChips(room)
    for (let handNo = 0; handNo < 40; handNo++) {
      if (room.players.filter(p => p.chips > 0).length < 2) break
      poker.startHand(room, 0)
      for (let guard = 0; !room.hand.done; guard++) {
        assert.ok(guard < 200, 'hand did not finish')
        const h = room.hand
        const p = room.players[h.toAct]
        assert.ok(p.inHand && !p.folded && !p.allIn, 'wrong player to act')
        const choice = ['fold', 'call', 'call', 'call', 'raise', 'allin'][rand(6)]
        const amount = h.currentBet + h.minRaise + rand(100)
        try {
          poker.act(room, p.id, choice, amount, 0)
        } catch {
          poker.act(room, p.id, 'call', 0, 0)
        }
        assert.equal(totalChips(room), start)
      }
      assert.equal(totalChips(room), start)
      assert.ok(room.players.every(p => p.chips >= 0))
      assert.ok(room.hand.board.length === 5 || !room.hand.showdown)
    }
  }
})

test('beginner info: hand strength, action labels, winner seat', () => {
  assert.deepEqual(poker.describeHand(['7h', '7c']), { name: 'Pair', strength: 1 })
  assert.deepEqual(poker.describeHand(['Ah', 'Kc']), { name: 'High Card', strength: 0 })
  assert.equal(poker.describeHand('As Ks Qs Js Ts 2d 3c'.split(' ')).strength, 9)
  assert.equal(poker.describeHand('7h 7c 7d Ks 2c'.split(' ')).name, 'Three of a Kind')

  const room = table(3)
  poker.startHand(room, 0)
  assert.equal(room.handNo, 1)
  assert.deepEqual(room.players.map(p => p.action).sort(), ['', 'BLIND 10', 'BLIND 20'])
  const first = room.players[room.hand.toAct]
  poker.act(room, first.id, 'raise', 60, 0)
  assert.equal(first.action, 'RAISE 60')
  const second = room.players[room.hand.toAct]
  poker.act(room, second.id, 'fold', 0, 0)
  assert.equal(second.action, 'FOLD')
  const third = room.players[room.hand.toAct]
  poker.act(room, third.id, 'fold', 0, 0)
  assert.equal(room.hand.results[0].seat, room.players.indexOf(first))
})
