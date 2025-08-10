import React, { useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

type Mode = 'normal' | 'adv' | 'dis'

/* ---------- audio ---------- */
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const ensure = () => (ctxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)())
  function whoosh(vol=0.2, dur=0.25) {
    try {
      const ctx = ensure()
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sawtooth'; o.frequency.value = 220; g.gain.value = vol
      o.connect(g); g.connect(ctx.destination); o.start()
      o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + dur * 0.7)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
      o.stop(ctx.currentTime + dur + 0.02)
    } catch {}
  }
  function impact(vol=0.15) {
    try {
      const ctx = ensure()
      const N = 2 * ctx.sampleRate * 0.08
      const buf = ctx.createBuffer(1, N, ctx.sampleRate)
      const out = buf.getChannelData(0)
      for (let i=0;i<N;i++) out[i] = (Math.random()*2-1) * (1 - i/N)
      const s = ctx.createBufferSource(); const g = ctx.createGain()
      s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(ctx.destination); s.start()
    } catch {}
  }
  return { whoosh, impact }
}

/* ---------- numbered-face textures ---------- */
function makeFaceTexture(num: number){
  const size = 256
  const c = document.createElement('canvas'); c.width=size; c.height=size
  const ctx = c.getContext('2d')!
  // pale triangle
  ctx.fillStyle = '#dff2ff'
  ctx.beginPath()
  ctx.moveTo(size*0.5, size*0.08)
  ctx.lineTo(size*0.92, size*0.75)
  ctx.lineTo(size*0.08, size*0.75)
  ctx.closePath()
  ctx.fill()
  // number
  ctx.fillStyle = '#0f2333'
  ctx.font = `bold ${Math.floor(size*0.48)}px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(String(num), size/2, size*0.55)
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.needsUpdate = true
  return tex
}

/* ---------- d20 geometry with true D&D pairing (opposites sum to 21) ---------- */
function buildNumberedMesh(){
  const geom = new THREE.IcosahedronGeometry(1, 0).toNonIndexed()
  const triCount = geom.attributes.position.count / 3

  // compute face normals
  const normals: THREE.Vector3[] = []
  for (let f=0; f<triCount; f++){
    const i = f*3
    const vA = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+0)
    const vB = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+1)
    const vC = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+2)
    const n = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA)).normalize()
    normals.push(n)
  }
  // greedily pair opposite faces
  const used = new Array(triCount).fill(false)
  const pairs: [number,number][] = []
  for (let i=0;i<triCount;i++){
    if (used[i]) continue
    let best = 1, bestJ = -1
    for (let j=i+1;j<triCount;j++){
      if (used[j]) continue
      const d = normals[i].dot(normals[j])
      if (d < best){ best = d; bestJ = j }
    }
    if (bestJ>=0){ used[i]=used[bestJ]=true; pairs.push([i,bestJ]) }
  }
  const faceToValue:number[] = new Array(triCount).fill(0)
  for (let k=0;k<pairs.length;k++){
    const [a,b]=pairs[k]; const low=k+1; const high=21-low
    faceToValue[a]=low; faceToValue[b]=high
  }

  // material per face (we’ll use plane labels for crisp numbers, but keep materials for future styling)
  const materials: THREE.MeshStandardMaterial[] = []
  for (let f=0; f<triCount; f++){
    materials.push(new THREE.MeshStandardMaterial({ color:0x99bfe3, roughness:0.4, metalness:0.2 }))
  }
  const mesh = new THREE.Mesh(geom, materials)
  mesh.geometry.clearGroups()
  for (let i=0;i<triCount;i++){ mesh.geometry.addGroup(i*3, 3, i) }
  return { mesh, faceToValue }
}

/* ---------- helpers to place numbered labels on each face ---------- */
function faceCenter(geom: THREE.BufferGeometry, faceIndex: number){
  const a = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, faceIndex*3+0)
  const b = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, faceIndex*3+1)
  const c = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, faceIndex*3+2)
  return new THREE.Vector3().addVectors(a,b).add(c).multiplyScalar(1/3)
}
function faceNormal(geom: THREE.BufferGeometry, faceIndex: number){
  const i = faceIndex*3
  const a = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+0)
  const b = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+1)
  const c = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, i+2)
  return new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize()
}
function addFaceLabels(mesh: THREE.Mesh, faceToValue: number[]){
  const triCount = mesh.geometry.attributes.position.count / 3
  for (let f=0; f<triCount; f++){
    const v = faceToValue[f] || 1
    const tex = makeFaceTexture(v)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), mat)
    const center = faceCenter(mesh.geometry, f)
    const normal = faceNormal(mesh.geometry, f)
    plane.position.copy(center.clone().add(normal.clone().multiplyScalar(0.02))) // avoid z-fighting
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal.clone().normalize())
    mesh.add(plane)
  }
}

/* ---------- physics shape ---------- */
function buildConvexShape(geom: THREE.BufferGeometry){
  const pos = geom.attributes.position.array as ArrayLike<number>
  const verts: CANNON.Vec3[] = []
  for (let i=0; i<pos.length; i+=3){ verts.push(new CANNON.Vec3(pos[i], pos[i+1], pos[i+2])) }
  const faces:number[][] = []
  for (let i=0; i<verts.length; i+=3){ faces.push([i,i+1,i+2]) }
  return new CANNON.ConvexPolyhedron({ vertices: verts, faces })
}

/* ---------- component ---------- */
export default function DicePhysics(){
  const mountRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('normal')
  const [log, setLog] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('astral_roll_log')||'[]') } catch { return [] }
  })
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(0.7)
  const audio = useAudio()

  function addLog(line:string){
    const next = [line, ...log].slice(0,200)
    setLog(next); localStorage.setItem('astral_roll_log', JSON.stringify(next))
  }

  async function roll(){
    if (busy) return
    setBusy(true)
    const faces:number[] = []
    const count = mode==='normal'?1:2
    for (let i=0;i<count;i++){
      const n = await runDie()
      faces.push(n)
      if (count===2 && i===0) await new Promise(r=>setTimeout(r,120))
    }
    const chosen = mode==='adv' ? Math.max(...faces) : mode==='dis' ? Math.min(...faces) : faces[0]
    const line = faces.length===2 ? `d20 (${mode}) → ${chosen} [${faces[0]}, ${faces[1]}]` : `d20 → ${chosen}`
    addLog(line)
    setBusy(false)
  }

  function runDie(){
    return new Promise<number>((resolve)=>{
      const host = mountRef.current!
      const width = host.clientWidth
      const height = Math.max(260, Math.min(360, Math.round(host.clientWidth * 0.6))) // adapt for tall phones (S24 Ultra)

      // THREE
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, width/height, 0.1, 1000)
      camera.position.set(0, 4.5, 10); camera.lookAt(0,0,0)
      const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
      renderer.setSize(width, height)
      host.appendChild(renderer.domElement)

      const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb)
      const dir = new THREE.DirectionalLight(0xbfe3ff, 1.0); dir.position.set(5,8,7); scene.add(dir)
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshStandardMaterial({color:0x0b1420, roughness:1, metalness:0}))
      ground.rotation.x = -Math.PI/2; ground.position.y = 0; scene.add(ground)

      // CANNON
      const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
      world.solver.iterations = 12
      const matDice = new CANNON.Material('dice'), matGround = new CANNON.Material('ground')
      world.addContactMaterial(new CANNON.ContactMaterial(matDice, matGround, { friction:0.35, restitution:0.35 }))

      const groundBody = new CANNON.Body({ mass:0, shape:new CANNON.Plane(), material:matGround })
      groundBody.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(groundBody)

      // **Invisible walls** to keep the die on-screen (scaled for wide/tall phones)
      const worldScale = Math.max(1, Math.min(1.6, width / 400)) // ~1 on small phones, ~1.6 on big ones
      const xWall = 7.5 * worldScale
      const zBack = -6.5 * worldScale
      const mkWall = (pos:[number,number,number], rot:[number,number,number])=>{
        const b = new CANNON.Body({ mass:0, material:matGround, shape:new CANNON.Plane() })
        b.position.set(pos[0], pos[1], pos[2]); b.quaternion.setFromEuler(rot[0], rot[1], rot[2]); world.addBody(b)
      }
      mkWall([  xWall, 0, 0], [0,  Math.PI/2, 0])  // right wall
      mkWall([ -xWall, 0, 0], [0, -Math.PI/2, 0])  // left wall
      mkWall([  0,     0, zBack], [0, 0, 0])       // back wall (toward camera)

      // d20
      const { mesh, faceToValue } = buildNumberedMesh()
      addFaceLabels(mesh, faceToValue) // visible numbers on faces
      mesh.position.set(-6,6,0)
      scene.add(mesh)

      const shape = buildConvexShape(mesh.geometry)
      const body = new CANNON.Body({ mass:1, shape, material:matDice })
      body.position.set(-6,6,0)
      body.angularVelocity.set(Math.random()*12, Math.random()*12, Math.random()*12)
      body.velocity.set(8+Math.random()*2, 0, (Math.random()-0.5)*2)
      world.addBody(body)

      if (!muted) audio.whoosh(0.12*vol, 0.22)

      let thumped=false, last=performance.now(), raf=0, rest=0
      function step(now:number){
        const dt = Math.min(1/30, (now-last)/1000); last = now
        world.step(1/60, dt, 3)
        mesh.position.set(body.position.x, body.position.y, body.position.z)
        mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
        renderer.render(scene, camera)

        if (!muted && !thumped && body.position.y<1.2 && Math.abs(body.velocity.y)>2.5){ audio.impact(0.15*vol); thumped=true }

        const speed = body.velocity.length() + body.angularVelocity.length()
        if (speed<0.2) rest++; else rest=0

        if (rest>10 && body.position.y<1.5){
          cancelAnimationFrame(raf)
          // determine top face by normals
          const posAttr = mesh.geometry.attributes.position
          const up = new CANNON.Vec3(0,1,0)
          const q = new CANNON.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
          const triCount = posAttr.count/3
          let bestIdx=0, bestDot=-Infinity
          for (let f=0; f<triCount; f++){
            const i=f*3
            const vA = new THREE.Vector3().fromBufferAttribute(posAttr, i+0)
            const vB = new THREE.Vector3().fromBufferAttribute(posAttr, i+1)
            const vC = new THREE.Vector3().fromBufferAttribute(posAttr, i+2)
            const n = new THREE.Vector3().subVectors(vB,vA).cross(new THREE.Vector3().subVectors(vC,vA)).normalize()
            const nC = new CANNON.Vec3(n.x,n.y,n.z)
            const rn = new CANNON.Vec3()
            q.vmult(nC, rn)
            const d = rn.dot(up)
            if (d>bestDot){ bestDot=d; bestIdx=f }
          }
          const result = faceToValue[bestIdx] || 1

          const hud = document.createElement('div')
          hud.textContent = String(result)
          Object.assign(hud.style, { position:'absolute', right:'12px', bottom:'12px', color:'#0f2333', background:'#dff2ff', borderRadius:'12px', padding:'8px 12px', fontWeight:'800', fontFamily:'system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif', zIndex:'10', boxShadow:'0 6px 18px rgba(0,0,0,.35)' } as CSSStyleDeclaration)
          host.appendChild(hud)

          setTimeout(()=>{ renderer.dispose(); host.removeChild(renderer.domElement); hud.remove(); resolve(result) }, 900)
          return
        }
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    })
  }

  return (
    <div>
      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
        <label>Mode</label>
        <select value={mode} onChange={e=>setMode(e.target.value as Mode)}>
          <option value="normal">Normal</option>
          <option value="adv">Advantage</option>
          <option value="dis">Disadvantage</option>
        </select>

        <button onClick={roll} disabled={busy}>{busy?'Rolling…':'Roll d20'}</button>

        <span style={{marginLeft:12}}>Sound</span>
        <label style={{display:'flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={!muted} onChange={e=>setMuted(!e.target.checked)} />
          <span>{muted?'Muted':'On'}</span>
        </label>
        <input type="range" min={0} max={1} step={0.01} value={vol} onChange={e=>setVol(parseFloat((e.target as HTMLInputElement).value))} style={{width:120}} />
      </div>

      <div className="results" style={{minHeight:60}}>
        {log.map((l,i)=><div key={i}>{l}</div>)}
      </div>

      <div ref={mountRef} style={{position:'relative', width:'100%', height:300, marginTop:8}} />
    </div>
  )
}
