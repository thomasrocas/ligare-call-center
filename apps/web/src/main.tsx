import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Button } from './components/ui/button'

function App(){
  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Ligare Call Center</h1>
        <p className="mt-2 text-zinc-600">Tailwind + shadcn baseline is ready.</p>
        <div className="mt-4 flex gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
