// Game sounds, synthesized with Web Audio so nothing needs downloading.
// They stand in for the picked Mixkit/Pixabay sounds (see README) until those files are added.
let ctx = null
let noise = null
let muted = false
try { muted = localStorage.getItem('muted') === '1' } catch {}

export const isMuted = () => muted

export function setMuted(value) {
  muted = value
  try { localStorage.setItem('muted', value ? '1' : '0') } catch {}
}

// Browsers only allow audio after a tap or click.
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume()
}

export function play(name) {
  if (muted || !ctx || ctx.state !== 'running') return
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.value = 0.45
  out.connect(ctx.destination)

  const envelope = (gain, t, dur, vol) => {
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }
  const hiss = (t, dur, f0, f1, vol, type = 'bandpass') => {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(f0, t)
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const gain = ctx.createGain()
    envelope(gain, t, dur, vol)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }
  const tone = (t, dur, f0, f1, vol, type = 'sine') => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const gain = ctx.createGain()
    envelope(gain, t, dur, vol)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  const chips = () => {
    for (let i = 0; i < 4; i++) {
      tone(now + i * 0.06, 0.05, 3200 + i * 300, 2600, 0.16, 'triangle')
      hiss(now + i * 0.06, 0.04, 5000, 7000, 0.25)
    }
  }

  const sounds = {
    shuffle: () => { for (let i = 0; i < 14; i++) hiss(now + i * 0.045, 0.05, 2500, 5000, 0.35) },
    card: () => hiss(now, 0.12, 1800, 6000, 0.6),
    place: () => { hiss(now, 0.09, 900, 300, 0.5, 'lowpass'); tone(now, 0.08, 160, 90, 0.3) },
    turn: () => { tone(now, 0.14, 520, 880, 0.3); tone(now + 0.12, 0.16, 780, 1180, 0.26) },
    chips,
    fold: () => hiss(now, 0.35, 1400, 250, 0.5, 'lowpass'),
    allin: () => { tone(now, 0.5, 180, 720, 0.18, 'sawtooth'); chips() },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(now + i * 0.1, 0.4, f, f * 1.01, 0.28, 'triangle')),
    lose: () => [392, 330].forEach((f, i) => tone(now + i * 0.14, 0.3, f, f * 0.98, 0.2, 'triangle')),
    click: () => tone(now, 0.05, 900, 1300, 0.18),
  }
  sounds[name]?.()
}
