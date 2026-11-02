// Move sounds synthesized with the Web Audio API: no audio files to load.
// A "piece on wood" click is a short burst of filtered noise plus a soft
// low thump; other sounds are layered on top of it.

let ctx = null
let master = null

function audio() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!ctx) {
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(ctx.destination)
  }
  // Browsers (iOS Safari especially) start the context suspended until a user gesture.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

let noiseBuffer = null
function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function click(ac, t, { freq = 1800, gain = 0.55, decay = 0.06, thump = 150 } = {}) {
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.4
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + decay)
  src.connect(filter).connect(g).connect(master)
  src.start(t)
  src.stop(t + decay + 0.02)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(thump, t)
  osc.frequency.exponentialRampToValueAtTime(thump * 0.6, t + 0.08)
  const og = ac.createGain()
  og.gain.setValueAtTime(gain * 0.9, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  osc.connect(og).connect(master)
  osc.start(t)
  osc.stop(t + 0.1)
}

function tone(ac, t, freq, { duration = 0.18, gain = 0.12, type = 'sine', slideTo } = {}) {
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

const SOUNDS = {
  move: (ac, t) => click(ac, t),
  capture: (ac, t) => {
    click(ac, t, { freq: 1200, gain: 0.75, decay: 0.08, thump: 120 })
    click(ac, t + 0.035, { freq: 2600, gain: 0.35, decay: 0.05, thump: 220 })
  },
  castle: (ac, t) => {
    click(ac, t)
    click(ac, t + 0.11, { freq: 1500 })
  },
  check: (ac, t) => {
    click(ac, t)
    tone(ac, t + 0.02, 880, { duration: 0.16, gain: 0.08, type: 'triangle' })
    tone(ac, t + 0.02, 1320, { duration: 0.12, gain: 0.04, type: 'sine' })
  },
  promote: (ac, t) => {
    click(ac, t)
    ;[1047, 1319, 1568].forEach((f, i) => tone(ac, t + 0.05 + i * 0.06, f, { duration: 0.2, gain: 0.07 }))
  },
  gameEnd: (ac, t) => {
    click(ac, t, { gain: 0.7 })
    ;[523, 659, 784, 1047].forEach((f) => tone(ac, t + 0.08, f, { duration: 0.9, gain: 0.05, type: 'triangle' }))
  },
  // Accents for notable classifications, played softly after the move sound.
  brilliant: (ac, t) => [1568, 2093, 2637, 3136].forEach((f, i) => tone(ac, t + i * 0.055, f, { duration: 0.35, gain: 0.05 })),
  great: (ac, t) => [1175, 1568].forEach((f, i) => tone(ac, t + i * 0.07, f, { duration: 0.3, gain: 0.05 })),
  blunder: (ac, t) => tone(ac, t, 330, { duration: 0.45, gain: 0.07, type: 'triangle', slideTo: 165 }),
}

export function playSound(name, delay = 0) {
  const ac = audio()
  const fn = SOUNDS[name]
  if (!ac || !fn) return
  fn(ac, ac.currentTime + 0.005 + delay)
}

// Call from any user gesture so iOS lets the context play later.
export function unlockAudio() {
  audio()
}

/** The sound for a move: game end > promotion > check > castle > capture > move. */
export function soundForMove(move) {
  const san = move.san
  if (san.includes('#')) return 'gameEnd'
  if (san.includes('=')) return 'promote'
  if (san.includes('+')) return 'check'
  if (san.startsWith('O-O')) return 'castle'
  if (move.captured || san.includes('x')) return 'capture'
  return 'move'
}

export function playMove(move, classificationKey) {
  playSound(soundForMove(move))
  if (classificationKey === 'brilliant' || classificationKey === 'great' || classificationKey === 'blunder') {
    playSound(classificationKey, 0.14)
  }
}
