// three.js layer: the floating-island table with chip, card and confetti effects, and the lobby logo.
// Effects take screen points (CSS px in the viewport) and map them onto the table, so they line up
// with the HTML seats drawn on top.
import * as THREE from './vendor/three.module.min.js'

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
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Same camera as the design: looking down at the table from the near side.
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 300)
  camera.position.set(0, 30, 21)
  camera.lookAt(0, 0, 2)
  const camBase = camera.position.clone()

  scene.add(new THREE.HemisphereLight('#ffffff', '#3d7a3a', 1.7))
  const sun = new THREE.DirectionalLight('#ffffff', 2.4)
  sun.position.set(-10, 30, 14)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)

  const world = new THREE.Group() // island, clouds and floating chips; rebuilt when the layout changes
  scene.add(world)

  let W = 1280
  let H = 720
  let MX = 0 // extra stage px rendered on each side, so the scene fills the whole window
  let MY = 0
  let K = 1 // effect scale: 1 for the design's 1280×720 table
  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  // Stage point (design px) -> point on the felt.
  const toPlane = ([x, y]) => {
    ray.setFromCamera(new THREE.Vector2(((x + MX) / (W + 2 * MX)) * 2 - 1, 1 - ((y + MY) / (H + 2 * MY)) * 2), camera)
    return ray.ray.intersectPlane(plane, new THREE.Vector3()) || new THREE.Vector3()
  }

  const chipGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.2, 36)
  const cardGeo = new THREE.BoxGeometry(1.4, 0.05, 1.95)
  const white = toon({ color: '#ffffff' })
  const cardMats = [white, white, toon({ map: canvasTexture(256, 360, drawCardBack) }), white, white, white]
  const makeChip = color => {
    const m = new THREE.Mesh(chipGeo, chipMaterials()[color % CHIP_COLORS.length])
    m.castShadow = true
    m.scale.setScalar(K)
    return m
  }
  const makeCard = () => {
    const m = new THREE.Mesh(cardGeo, cardMats)
    m.castShadow = true
    m.scale.setScalar(K)
    return m
  }

  const stacks = [0, 1, 2].map(() => {
    const g = new THREE.Group()
    scene.add(g)
    return g
  })
  let pot = new THREE.Vector3()
  const chipCount = () => stacks.reduce((n, g) => n + g.children.length, 0)
  const addChip = color => {
    const g = stacks.reduce((a, b) => (b.children.length < a.children.length ? b : a))
    const c = makeChip(color)
    c.position.y = (0.1 + g.children.length * 0.2) * K
    c.rotation.y = Math.random() * 6
    g.add(c)
  }
  const placeStacks = () => {
    const offsets = [[-1.2, 0.2], [0, -0.5], [1.2, 0.1]]
    stacks.forEach((g, i) => {
      g.position.set(pot.x + offsets[i][0] * K, 0, pot.z + offsets[i][1] * K)
      g.children.forEach((c, k) => {
        c.scale.setScalar(K)
        c.position.y = (0.1 + k * 0.2) * K
      })
    })
  }

  let floaters = []
  let clouds = []

  // Build the floating island so its felt covers the given stage rectangle.
  function buildWorld(rect) {
    world.clear()
    const cx = (rect.left + rect.right) / 2
    const far = toPlane([cx, rect.top])
    const near = toPlane([cx, rect.bottom])
    const cz = (far.z + near.z) / 2
    const rz = (near.z - far.z) / 2
    const mid = new THREE.Vector3(far.x, 0, cz).project(camera)
    const midY = ((1 - mid.y) / 2) * (H + 2 * MY) - MY
    const rx = Math.abs(toPlane([rect.right, midY]).x - toPlane([cx, midY]).x)
    const x0 = far.x
    const squash = rz / rx
    K = (rx + rz) / 24.6

    const felt = new THREE.Mesh(new THREE.CylinderGeometry(rx, rx * 0.947, 1.6 * K, 72),
      [toon({ color: '#2C9E49' }), toon({ color: '#43C463' }), toon({ color: '#2C9E49' })])
    felt.scale.z = squash
    felt.position.set(x0, -0.8 * K, cz)
    felt.receiveShadow = true
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rx, 0.7 * K, 20, 96), toon({ color: '#FFC233' }))
    rim.rotation.x = Math.PI / 2
    rim.scale.y = squash
    rim.position.set(x0, 0, cz)
    const line = new THREE.Mesh(new THREE.RingGeometry(rx * 0.68, rx * 0.7, 96),
      new THREE.MeshBasicMaterial({ color: '#8BE39B', transparent: true, opacity: 0.7 }))
    line.rotation.x = -Math.PI / 2
    line.scale.y = squash
    line.position.set(x0, 0.02, cz)
    const rock = new THREE.Mesh(new THREE.ConeGeometry(rx * 0.947, 9 * K, 40), toon({ color: '#A0714B' }))
    rock.rotation.x = Math.PI
    rock.scale.z = squash
    rock.position.set(x0, -6.1 * K, cz)
    world.add(felt, rim, line, rock)

    const cloudMat = toon({ color: '#ffffff' })
    clouds = [[-26, -7, 4, 2.2], [25, -8, 6, 2.6], [-22, -6, -12, 1.8], [23, -6, -14, 2], [-8, -12, 16, 2.4], [11, -13, 17, 2.2], [0, -14, -26, 3]]
      .map(([x, y, z, s]) => {
        const g = new THREE.Group()
        for (const [a, b, c, r] of [[0, 0, 0, 1.6], [1.5, 0.2, 0.3, 1.2], [-1.5, -0.1, 0.2, 1.1], [0.6, 0.8, -0.2, 1.1]]) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), cloudMat)
          m.position.set(a, b, c)
          g.add(m)
        }
        g.position.set(x0 + x * (rx / 15), y * K, cz + z * K)
        g.scale.setScalar(s * K)
        world.add(g)
        return g
      })

    floaters = [[-21, -1, -2], [21, -1.5, -1], [-19, -3, -10], [19, -2.5, -11]].map(([x, y, z], i) => {
      const c = makeChip(i + 1)
      c.scale.setScalar(1.6 * K)
      c.userData.base = new THREE.Vector3(x0 + x * (rx / 15), y * K, cz + z * K)
      world.add(c)
      return c
    })
  }

  // A tiny tween engine: move along an arc, optionally spinning.
  const tweens = []
  let clock = 0
  const tween = (obj, to, dur, { delay = 0, arc = 0, spin = 0 } = {}) => new Promise(done => {
    obj.visible = delay === 0
    tweens.push({ obj, to, dur, start: clock + delay, arc, spin, done, from: null })
  })
  const confetti = []
  const confettiGeo = new THREE.PlaneGeometry(0.42, 0.24)
  const confettiMats = CHIP_COLORS.map(color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
  let shakeUntil = 0

  const fx = {
    // layout: { W, H, margin: [x, y], island: {left, right, top, bottom}, pot: [x, y], pixelRatio }
    setLayout(layout) {
      W = layout.W
      H = layout.H
      ;[MX, MY] = layout.margin || [0, 0]
      Object.assign(canvas.style, { left: -MX + 'px', top: -MY + 'px', width: W + 2 * MX + 'px', height: H + 2 * MY + 'px' })
      renderer.setPixelRatio(layout.pixelRatio)
      renderer.setSize(W + 2 * MX, H + 2 * MY, false)
      camera.aspect = W / H
      camera.fov = W < H ? 50 : 34
      camera.setViewOffset(W, H, -MX, -MY, W + 2 * MX, H + 2 * MY)
      camera.position.copy(camBase)
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      buildWorld(layout.island)
      pot = toPlane(layout.pot)
      placeStacks()
    },

    setPot(count) {
      while (chipCount() > count) {
        const g = stacks.reduce((a, b) => (b.children.length > a.children.length ? b : a))
        g.remove(g.children[g.children.length - 1])
      }
      while (chipCount() < count) addChip(chipCount())
    },

    deal(points, onCard) {
      let i = 0
      for (let round = 0; round < 2; round++) {
        for (const pt of points) {
          const card = makeCard()
          card.position.set(pot.x, 0.3 * K, pot.z + K)
          scene.add(card)
          const to = toPlane(pt).add(new THREE.Vector3((round * 0.9 - 0.45) * K, 0.4 * K, 0))
          const delay = i++ * 110
          setTimeout(onCard, delay)
          tween(card, to, 520, { delay, arc: 2.6 * K, spin: Math.PI * 2 })
            .then(() => setTimeout(() => scene.remove(card), 250))
        }
      }
    },

    toss(point, n) {
      const from = toPlane(point)
      for (let i = 0; i < n; i++) {
        const color = Math.floor(Math.random() * CHIP_COLORS.length)
        const chip = makeChip(color)
        chip.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 1.2 * K, 0.6 * K, (Math.random() - 0.5) * 0.8 * K))
        scene.add(chip)
        const g = stacks[Math.floor(Math.random() * 3)]
        const to = g.position.clone()
        to.y = (0.1 + g.children.length * 0.2) * K
        tween(chip, to, 650, { delay: i * 70, arc: 4.5 * K, spin: Math.PI * 4 }).then(() => {
          scene.remove(chip)
          addChip(color)
        })
      }
    },

    fold(point) {
      const from = toPlane(point)
      for (let i = 0; i < 2; i++) {
        const card = makeCard()
        card.position.copy(from).add(new THREE.Vector3(i * 0.9 * K, 0.5 * K, 0))
        scene.add(card)
        const to = pot.clone().add(new THREE.Vector3((3 + i) * K, 0.2 * K, -2 * K))
        tween(card, to, 500, { delay: i * 80, arc: 3 * K, spin: Math.PI * 3 }).then(() => scene.remove(card))
      }
    },

    win(points) {
      const targets = points.map(toPlane)
      let k = 0
      stacks.forEach(g => {
        g.children.slice().forEach((c, i) => {
          const at = c.getWorldPosition(new THREE.Vector3())
          g.remove(c)
          c.position.copy(at)
          scene.add(c)
          const to = targets[k++ % targets.length].clone()
            .add(new THREE.Vector3((Math.random() - 0.5) * 1.5 * K, 0.5 * K, (Math.random() - 0.5) * 1.5 * K))
          tween(c, to, 700, { delay: i * 45 + Math.random() * 120, arc: 5 * K, spin: Math.PI * 2 })
            .then(() => scene.remove(c))
        })
      })
      for (let i = 0; i < 150; i++) {
        const m = new THREE.Mesh(confettiGeo, confettiMats[i % confettiMats.length])
        m.scale.setScalar(K)
        m.position.set(pot.x + (Math.random() - 0.5) * 2 * K, K, pot.z + (Math.random() - 0.5) * 2 * K)
        m.userData = {
          v: new THREE.Vector3((Math.random() - 0.5) * 14, 10 + Math.random() * 10, (Math.random() - 0.5) * 10).multiplyScalar(K),
          spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
          life: 2.4 + Math.random(),
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
      u.v.y -= 22 * K * dt
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
      c.position.set(base.x, base.y + Math.sin(t * 1.3 + i) * 0.5 * K, base.z)
      c.rotation.x = 0.6 + Math.sin(t * 0.8 + i) * 0.3
      c.rotation.z = t * 0.7 + i
    })
    clouds.forEach((g, i) => {
      g.position.x += dt * (0.35 + i * 0.05) * K
      if (g.position.x > 40 * K) g.position.x = -40 * K
    })
    if (clock < shakeUntil) {
      camera.position.set(camBase.x + (Math.random() - 0.5) * 0.5, camBase.y + (Math.random() - 0.5) * 0.5, camBase.z)
    } else {
      camera.position.copy(camBase)
    }
  }

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
