
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Starfield(){
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference:'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color('#0a1120'), 1)
    ref.current.appendChild(renderer.domElement)
    renderer.domElement.style.position = 'fixed'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.zIndex = '0'
    const onResize = () => { const w = window.innerWidth, h = window.innerHeight; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h) }
    onResize(); window.addEventListener('resize', onResize)
    const make = (count:number, depth:number, color:string)=>{
      const geo = new THREE.BufferGeometry()
      const positions = new Float32Array(count*3)
      for(let i=0;i<count;i++){ positions[i*3]= (Math.random()-0.5)*2000; positions[i*3+1]=(Math.random()-0.5)*1200; positions[i*3+2]= -Math.random()*depth-100 }
      geo.setAttribute('position', new THREE.BufferAttribute(positions,3))
      return new THREE.Points(geo, new THREE.PointsMaterial({color, size:1.6, sizeAttenuation:true, transparent:true, opacity:0.9}))
    }
    const A=make(800,1400,'#cfe6ff'), B=make(600,1000,'#aee3ff'), C=make(400,800,'#ffffff'); scene.add(A,B,C)
    camera.position.set(0,0,60)
    let tx=0,ty=0; window.addEventListener('mousemove', e=>{tx=(e.clientX/window.innerWidth)*2-1; ty=(e.clientY/window.innerHeight)*2-1})
    window.addEventListener('deviceorientation', (e:any)=>{ if(e.gamma!=null&&e.beta!=null){ tx=e.gamma/45; ty=e.beta/45 } })
    let t=0; const clock=new THREE.Clock(); let raf=0
    const anim=()=>{ const dt=clock.getDelta(); t+=dt; const lerp=(a:number,b:number,p:number)=>a+(b-a)*p
      camera.position.x=lerp(camera.position.x, tx*10, .03); camera.position.y=lerp(camera.position.y, -ty*6, .03)
      ;(A.material as THREE.PointsMaterial).opacity=0.75+Math.sin(t*.9)*.1
      ;(B.material as THREE.PointsMaterial).opacity=0.65+Math.sin(t*1.2)*.1
      ;(C.material as THREE.PointsMaterial).opacity=0.55+Math.sin(t*.7)*.1
      scene.rotation.z=lerp(scene.rotation.z, tx*.05, .02)
      renderer.render(scene,camera); raf=requestAnimationFrame(anim) }
    raf=requestAnimationFrame(anim)
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize',onResize); renderer.dispose(); ref.current?.removeChild(renderer.domElement) }
  }, [])
  return <div ref={ref} aria-hidden="true" />
}
