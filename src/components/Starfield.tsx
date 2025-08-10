import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Starfield(){
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current!
    // Mount to BODY so it’s never clipped; keep it behind UI
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference:'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color('#040812'), 1)
    document.body.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, {
      position:'fixed', inset:'0', zIndex:'0', pointerEvents:'none'
    })

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight
      camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    }
    onResize(); window.addEventListener('resize', onResize)

    const make = (count:number, depth:number, color:string, size:number) => {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count*3)
      for (let i=0;i<count;i++){
        pos[i*3+0] = (Math.random()-0.5)*2400
        pos[i*3+1] = (Math.random()-0.5)*1600
        pos[i*3+2] = -Math.random()*depth - 100
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos,3))
      const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation:true, transparent:true, opacity:0.95 })
      return new THREE.Points(geo, mat)
    }

    // Denser, brighter layers
    const A = make(1600, 2200, '#e8f4ff', 2.2)
    const B = make(1200, 1800, '#bfe3ff', 2.0)
    const C = make(900, 1400, '#9fd6ff', 1.8)
    scene.add(A,B,C)

    // Soft nebula plane for contrast
    const nebula = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 3000),
      new THREE.MeshBasicMaterial({ color:0x0b1f3a, transparent:true, opacity:0.25 })
    )
    nebula.position.z = -1200
    scene.add(nebula)

    camera.position.set(0,0,60)
    let tx=0, ty=0
    const onMouse = (e:MouseEvent)=>{ tx=(e.clientX/window.innerWidth)*2-1; ty=(e.clientY/window.innerHeight)*2-1 }
    window.addEventListener('mousemove', onMouse)
    const onTilt = (e:DeviceOrientationEvent)=>{ if(e.gamma!=null&&e.beta!=null){ tx=e.gamma/45; ty=e.beta/45 } }
    window.addEventListener('deviceorientation', onTilt)

    let t=0; const clock=new THREE.Clock(); let raf=0
    const anim = ()=>{
      const dt = clock.getDelta(); t+=dt
      const lerp=(a:number,b:number,p:number)=>a+(b-a)*p
      camera.position.x = lerp(camera.position.x, tx*12, 0.03)
      camera.position.y = lerp(camera.position.y,-ty*8, 0.03)
      ;(A.material as THREE.PointsMaterial).size = 2.2 + Math.sin(t*1.0)*0.2
      ;(B.material as THREE.PointsMaterial).size = 2.0 + Math.sin(t*1.3)*0.2
      ;(C.material as THREE.PointsMaterial).size = 1.8 + Math.sin(t*0.8)*0.2
      scene.rotation.z = lerp(scene.rotation.z, tx*0.05, 0.02)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(anim)
    }
    raf = requestAnimationFrame(anim)

    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouse); window.removeEventListener('deviceorientation', onTilt)
      renderer.dispose(); document.body.removeChild(renderer.domElement) }
  }, [])

  return <div ref={ref} />
}
