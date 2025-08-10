
import React from 'react'
import Starfield from './components/Starfield'
import DicePhysics from './components/DicePhysics'

export default function App(){
  return (
    <div className="app">
      <Starfield />
      <div className="toolbar">
        <div className="toolbar-inner">
          <strong>Astral Grove</strong>
          <span className="meta">Circle of the Stars • Vercel-ready</span>
        </div>
      </div>
      <div className="container">
        <section className="card" style={{gridColumn:'1 / -1'}}>
          <h3>Dice</h3>
          <DicePhysics />
        </section>
      </div>
    </div>
  )
}
