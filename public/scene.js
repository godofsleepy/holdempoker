// three.js layer: the floating-island table with chip, card and confetti effects, and the lobby logo.
// Effects take screen points (CSS px in the viewport) and map them onto the table, so they line up
// with the HTML seats drawn on top.
import * as THREE from './vendor/three.module.min.js'

const TOP = 0.3 // height of the felt surface
const CHIP_COLORS = ['#E8413C', '#1F7AE0', '#2DB84D', '#FFC233', '#26324B']

const gradient = new THREE.DataTexture(
  new Uint8Array([120, 120, 120, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
gradient.minFilter = gradient.magFilter = THREE.NearestFilter
gradient.needsUpdate = true
const toon = opts => new THREE.MeshToonMaterial({ gradientMap: gradient, ...opts })

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const paint = () => {
    draw(cv.getContext('2d'))
    tex.needsUpdate = true
  }
  paint()
  document.fonts?.ready.then(paint) // redraw once the display font has loaded
  return tex
}

function drawChip(g, size, color) {
  const r = size / 2
  g.clearRect(0, 0, size, size)
  g.fillStyle = color
  g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#ffffff'
  for (let i = 0; i < 8; i++) {
    g.save(); g.translate(r, r); g.rotate((i * Math.PI) / 4)
    g.fillRect(-r * 0.1, -r, r * 0.2, r * 0.28)
    g.restore()
  }
  g.beginPath(); g.arc(r, r, r * 0.66, 0, Math.PI * 2); g.fill()
  g.fillStyle = color
  g.beginPath(); g.arc(r, r, r * 0.58, 0, Math.PI * 2); g.fill()
}

function drawCardFace(g, rank, suit, red) {
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 360)
  g.fillStyle = red ? '#D7263D' : '#1B1B1F'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '64px "Lilita One", sans-serif'
  g.fillText(rank, 46, 56)
  g.font = '44px sans-serif'
  g.fillText(suit, 46, 108)
  g.font = '150px sans-serif'
  g.fillText(suit, 128, 196)
}

function drawCardBack(g) {
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 360)
  g.fillStyle = '#D7302B'
  g.fillRect(16, 16, 224, 328)
  g.strokeStyle = 'rgba(255,255,255,.28)'
  g.lineWidth = 5
  for (let i = -360; i < 600; i += 26) {
    g.beginPath(); g.moveTo(16 + i, 16); g.lineTo(16 + i + 328, 344); g.stroke()
    g.beginPath(); g.moveTo(16 + i, 344); g.lineTo(16 + i + 328, 16); g.stroke()
  }
  g.strokeStyle = '#ffffff'
  g.lineWidth = 6
  g.strokeRect(26, 26, 204, 308)
}

let chipMats = null
function chipMaterials() {
  chipMats ||= CHIP_COLORS.map(color => {
    const face = toon({ map: canvasTexture(128, 128, g => drawChip(g, 128, color)) })
    return [toon({ color }), face, face]
  })
  return chipMats
}

export function createTable(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400)
  camera.position.set(0, 34, 15)
  camera.lookAt(0, 0, 0)
  const camBase = camera.position.clone()

  scene.add(new THREE.HemisphereLight('#ffffff', '#3d7a3a', 1.7))
  const sun = new THREE.DirectionalLight('#ffffff', 2.3)
  sun.position.set(-12, 34, 16)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)

  // Floating island: unit radius, stretched in fit() to sit under the HTML table area.
  const island = new THREE.Group()
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 96),
    [toon({ color: '#2C9E49' }), toon({ color: '#43C463' }), toon({ color: '#2C9E49' })])
  felt.position.y = TOP - 0.2
  felt.receiveShadow = true
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.045, 1, 1.2, 96), toon({ color: '#FFC233' }))
  rim.position.y = TOP - 0.75
  const line = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.752, 96),
    new THREE.MeshBasicMaterial({ color: '#8BE39B', transparent: true, opacity: 0.6 }))
  line.rotation.x = -Math.PI / 2
  line.position.y = TOP + 0.01
  const rock = new THREE.Mesh(new THREE.ConeGeometry(1, 8, 48), toon({ color: '#A0714B' }))
  rock.rotation.x = Math.PI
  rock.position.y = TOP - 1.35 - 4
  island.add(felt, rim, line, rock)
  scene.add(island)

  // Effects are modelled in "pixels" and scaled by S (world units per screen pixel), set in fit().
  let S = 0.03
  const chipGeo = new THREE.CylinderGeometry(15, 15, 5, 32)
  const cardGeo = new THREE.BoxGeometry(40, 1.5, 56)
  const white = toon({ color: '#ffffff' })
  const backMat = toon({ map: canvasTexture(256, 360, drawCardBack) })
  const cardMats = [white, white, backMat, white, white, white]
  const makeChip = color => {
    const m = new THREE.Mesh(chipGeo, chipMaterials()[color % CHIP_COLORS.length])
    m.castShadow = true
    m.scale.setScalar(S)
    return m
  }
  const makeCard = () => {
    const m = new THREE.Mesh(cardGeo, cardMats)
    m.castShadow = true
    m.scale.setScalar(S)
    return m
  }

  let W = 1
  let H = 1
  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP)
  const toPlane = pt => {
    ray.setFromCamera(new THREE.Vector2((pt.x / W) * 2 - 1, 1 - (pt.y / H) * 2), camera)
    return ray.ray.intersectPlane(plane, new THREE.Vector3()) || new THREE.Vector3(0, TOP, 0)
  }

  const stacks = [0, 1, 2].map(() => {
    const g = new THREE.Group()
    scene.add(g)
    return g
  })
  let pot = new THREE.Vector3(0, TOP, 0)
  const chipCount = () => stacks.reduce((n, g) => n + g.children.length, 0)
  const addChip = color => {
    const g = stacks.reduce((a, b) => (b.children.length < a.children.length ? b : a))
    const c = makeChip(color)
    c.position.y = (2.5 + g.children.length * 5) * S
    c.rotation.y = Math.random() * 6
    g.add(c)
  }
  const placeStacks = () => {
    const offsets = [[-36, 8], [0, -10], [36, 6]]
    stacks.forEach((g, i) => {
      g.position.set(pot.x + offsets[i][0] * S, TOP, pot.z + offsets[i][1] * S)
      g.children.forEach((c, k) => {
        c.scale.setScalar(S)
        c.position.y = (2.5 + k * 5) * S
      })
    })
  }

  const floaters = [0, 1, 2, 3].map(i => {
    const c = makeChip(i + 1)
    scene.add(c)
    return c
  })

  // Stretch the island so it sits under the given screen rectangle (the HTML table area).
  function fit(rect) {
    if (!rect || !rect.width) return
    const cx = rect.left + rect.width / 2
    const far = toPlane({ x: cx, y: rect.top + rect.height * 0.08 })
    const near = toPlane({ x: cx, y: rect.bottom - rect.height * 0.07 })
    const center = new THREE.Vector3(far.x, TOP, (far.z + near.z) / 2)
    const centerPx = center.clone().project(camera)
    const side = toPlane({ x: rect.right - rect.width * 0.03, y: ((1 - centerPx.y) / 2) * H })
    const halfWidth = Math.max(0.5, Math.abs(side.x - center.x))
    island.position.set(center.x, 0, center.z)
    island.scale.set(halfWidth, 1, Math.max(0.5, (near.z - far.z) / 2))
    S = halfWidth / (rect.width * 0.47)
    placeStacks()
    floaters.forEach((c, i) => {
      c.scale.setScalar(S * 1.5)
      c.userData.base = new THREE.Vector3(
        center.x + (i % 2 ? 1 : -1) * (halfWidth + 40 * S),
        TOP - 30 * S,
        center.z + (i < 2 ? -0.4 : 0.5) * island.scale.z,
      )
    })
  }

  function resize() {
    W = canvas.clientWidth || window.innerWidth
    H = canvas.clientHeight || window.innerHeight
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  // A tiny tween engine: move along an arc, optionally spinning.
  const tweens = []
  let clock = 0
  const tween = (obj, to, dur, { delay = 0, arc = 0, spin = 0 } = {}) => new Promise(done => {
    obj.visible = delay === 0
    tweens.push({ obj, to, dur, start: clock + delay, arc, spin, done, from: null })
  })

  const confetti = []
  const confettiGeo = new THREE.PlaneGeometry(10, 6)
  const confettiMats = CHIP_COLORS.map(color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
  let shakeUntil = 0

  const fx = {
    fit,
    resize,

    setPot(screenPt, count) {
      if (screenPt) pot = toPlane(screenPt)
      placeStacks()
      while (chipCount() > count) {
        const g = stacks.reduce((a, b) => (b.children.length > a.children.length ? b : a))
        g.remove(g.children[g.children.length - 1])
      }
      while (chipCount() < count) addChip(chipCount())
    },

    deal(screenPts, onCard) {
      let i = 0
      for (let round = 0; round < 2; round++) {
        for (const pt of screenPts) {
          const card = makeCard()
          card.position.set(pot.x, TOP + 4 * S, pot.z)
          scene.add(card)
          const to = toPlane(pt).add(new THREE.Vector3((round * 22 - 11) * S, 12 * S, 0))
          const delay = i++ * 90
          setTimeout(onCard, delay)
          tween(card, to, 480, { delay, arc: 90 * S, spin: Math.PI * 2 })
            .then(() => setTimeout(() => scene.remove(card), 180))
        }
      }
    },

    toss(screenPt, n) {
      const from = toPlane(screenPt)
      for (let i = 0; i < n; i++) {
        const color = Math.floor(Math.random() * CHIP_COLORS.length)
        const chip = makeChip(color)
        chip.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 30 * S, 15 * S, (Math.random() - 0.5) * 20 * S))
        scene.add(chip)
        const g = stacks[Math.floor(Math.random() * 3)]
        const to = g.position.clone()
        to.y = TOP + (2.5 + g.children.length * 5) * S
        tween(chip, to, 600, { delay: i * 60, arc: 120 * S, spin: Math.PI * 4 }).then(() => {
          scene.remove(chip)
          addChip(color)
        })
      }
    },

    fold(screenPt) {
      const from = toPlane(screenPt)
      for (let i = 0; i < 2; i++) {
        const card = makeCard()
        card.position.copy(from).add(new THREE.Vector3(i * 22 * S, 12 * S, 0))
        scene.add(card)
        const to = pot.clone().add(new THREE.Vector3((90 + i * 14) * S, 2 * S, -40 * S))
        tween(card, to, 500, { delay: i * 80, arc: 70 * S, spin: Math.PI * 3 }).then(() => scene.remove(card))
      }
    },

    win(screenPts) {
      const targets = screenPts.map(toPlane)
      let k = 0
      stacks.forEach(g => {
        g.children.slice().forEach((c, i) => {
          const at = c.getWorldPosition(new THREE.Vector3())
          g.remove(c)
          c.position.copy(at)
          scene.add(c)
          const to = targets[k++ % targets.length].clone()
            .add(new THREE.Vector3((Math.random() - 0.5) * 40 * S, 10 * S, (Math.random() - 0.5) * 40 * S))
          tween(c, to, 700, { delay: i * 40 + Math.random() * 120, arc: 140 * S, spin: Math.PI * 2 })
            .then(() => scene.remove(c))
        })
      })
      for (let i = 0; i < 160; i++) {
        const m = new THREE.Mesh(confettiGeo, confettiMats[i % confettiMats.length])
        m.scale.setScalar(S)
        m.position.set(pot.x + (Math.random() - 0.5) * 40 * S, TOP + 10 * S, pot.z + (Math.random() - 0.5) * 40 * S)
        m.userData = {
          v: new THREE.Vector3((Math.random() - 0.5) * 700, 380 + Math.random() * 420, (Math.random() - 0.5) * 500).multiplyScalar(S),
          spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
          life: 1.8 + Math.random(),
        }
        scene.add(m)
        confetti.push(m)
      }
    },

    shake() {
      shakeUntil = clock + 450
    },

    start() {
      let last = 0
      renderer.setAnimationLoop(time => {
        const dt = Math.min(0.05, last ? (time - last) / 1000 : 0)
        last = time
        clock = time
        step(dt, time / 1000)
        renderer.render(scene, camera)
      })
    },

    stop() {
      renderer.setAnimationLoop(null)
    },
  }

  function step(dt, t) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]
      const k = (clock - tw.start) / tw.dur
      if (k < 0) continue
      if (!tw.from) {
        tw.from = tw.obj.position.clone()
        tw.obj.visible = true
      }
      const p = Math.min(k, 1)
      const e = 1 - Math.pow(1 - p, 3)
      tw.obj.position.lerpVectors(tw.from, tw.to, e)
      tw.obj.position.y += Math.sin(Math.PI * p) * tw.arc
      if (tw.spin) tw.obj.rotation.y = tw.spin * e
      if (k >= 1) {
        tweens.splice(i, 1)
        tw.done()
      }
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const m = confetti[i]
      const u = m.userData
      u.v.y -= 900 * S * dt
      m.position.addScaledVector(u.v, dt)
      m.rotation.x += u.spin.x * dt
      m.rotation.y += u.spin.y * dt
      m.rotation.z += u.spin.z * dt
      u.life -= dt
      if (u.life <= 0) {
        scene.remove(m)
        confetti.splice(i, 1)
      }
    }
    floaters.forEach((c, i) => {
      const base = c.userData.base
      if (!base) return
      c.position.set(base.x, base.y + Math.sin(t * 1.3 + i) * 12 * S, base.z)
      c.rotation.x = 0.6 + Math.sin(t * 0.8 + i) * 0.3
      c.rotation.z = t * 0.7 + i
    })
    if (clock < shakeUntil) {
      camera.position.set(camBase.x + (Math.random() - 0.5) * 0.4, camBase.y, camBase.z + (Math.random() - 0.5) * 0.4)
    } else {
      camera.position.copy(camBase)
    }
  }

  resize()
  return fx
}

// The lobby's spinning chip logo with two floating cards.
export function createLogo(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100)
  camera.position.set(0, 0, 17)
  scene.add(new THREE.HemisphereLight('#ffffff', '#4a6fa5', 1.8))
  const sun = new THREE.DirectionalLight('#ffffff', 2.2)
  sun.position.set(-5, 8, 10)
  scene.add(sun)

  const front = canvasTexture(512, 512, g => {
    drawChip(g, 512, '#E8413C')
    g.fillStyle = '#FFC233'
    g.beginPath(); g.arc(256, 256, 146, 0, Math.PI * 2); g.fill()
    g.save(); g.translate(256, 256); g.rotate(-0.2)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.strokeStyle = '#14254A'
    g.font = '74px "Lilita One", sans-serif'
    g.lineWidth = 16; g.strokeText("HOLD'EM", 0, -18)
    g.fillStyle = '#ffffff'; g.fillText("HOLD'EM", 0, -18)
    g.font = '52px "Lilita One", sans-serif'
    g.lineWidth = 12; g.strokeText('PARTY', 0, 52)
    g.fillStyle = '#FFC233'; g.fillText('PARTY', 0, 52)
    g.restore()
  })
  const back = canvasTexture(512, 512, g => {
    drawChip(g, 512, '#E8413C')
    g.fillStyle = '#FFC233'
    g.beginPath(); g.arc(256, 256, 146, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#14254A'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '200px sans-serif'
    g.fillText('♠', 256, 266)
  })
  const chip = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.7, 72),
    [toon({ color: '#E8413C' }), toon({ map: front }), toon({ map: back })])
  chip.rotation.x = Math.PI / 2
  const pivot = new THREE.Group()
  pivot.add(chip)
  scene.add(pivot)

  const white = toon({ color: '#ffffff' })
  const backMat = toon({ map: canvasTexture(256, 360, drawCardBack) })
  const cards = [['A', '♠', false, -5.1, -0.6, 0.38], ['K', '♥', true, 5.1, 0.7, -0.32]].map(([rank, suit, red, x, y, rz]) => {
    const face = toon({ map: canvasTexture(256, 360, g => drawCardFace(g, rank, suit, red)) })
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.65, 0.07), [white, white, white, white, face, backMat])
    m.position.set(x, y, -0.5)
    m.rotation.z = rz
    m.userData = { y, rz }
    scene.add(m)
    return m
  })

  const small = CHIP_COLORS.map((color, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 36), chipMaterials()[i])
    m.userData.phase = (i / CHIP_COLORS.length) * Math.PI * 2
    scene.add(m)
    return m
  })

  const resize = () => {
    const w = canvas.clientWidth || 400
    const h = canvas.clientHeight || 300
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    resize,
    start() {
      renderer.setAnimationLoop(time => {
        const t = time / 1000
        pivot.rotation.y = t * 1.1
        pivot.rotation.x = Math.sin(t * 0.9) * 0.18
        pivot.position.y = Math.sin(t * 1.4) * 0.25
        cards.forEach((m, i) => {
          m.position.y = m.userData.y + Math.sin(t * 1.2 + i * 2) * 0.35
          m.rotation.z = m.userData.rz + Math.sin(t * 0.9 + i) * 0.08
          m.rotation.y = Math.sin(t * 0.7 + i * 1.5) * 0.45
        })
        small.forEach(m => {
          const a = t * 0.6 + m.userData.phase
          m.position.set(Math.cos(a) * 6.4, Math.sin(a) * 3.6, Math.sin(a) * 2)
          m.rotation.x = t * 1.5 + m.userData.phase
          m.rotation.z = t * 0.8
        })
        renderer.render(scene, camera)
      })
    },
    stop() {
      renderer.setAnimationLoop(null)
    },
  }
}
