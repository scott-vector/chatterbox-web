import { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useModelStatus } from '../../hooks/useModelStatus'
import logo from '../../assets/logo.png'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/playground', label: 'Playground', icon: PlaygroundIcon },
  { to: '/echo', label: 'Echo', icon: EchoIcon },
  { to: '/voicecraft', label: 'VoiceCraft', icon: VoiceCraftIcon },
  { to: '/narrator', label: 'Narrator', icon: NarratorIcon },
]

export default function Sidebar() {
  const { isReady, isLoading, loadProgress } = useModelStatus()

  // Determine if we're in compile phase (downloads done, not yet ready)
  const isCompiling = isLoading && (() => {
    const isFileDone = (s) => s.status !== 'progress' && s.status !== 'initiate' && s.status !== 'download'
    const onnx = loadProgress.filter((p) => p.file && p.file.endsWith('.onnx'))
    const data = loadProgress.filter((p) => p.file && p.file.endsWith('.onnx_data'))
    const all = [...onnx, ...data]
    return all.length > 0 && all.every((f) => isFileDone(f))
  })()

  return (
    <aside className="sticky top-0 h-screen w-[var(--sidebar-width)] shrink-0 bg-[#1b1b20] border-r border-zinc-600/30 flex flex-col z-50">
      <div className="px-5 py-5">
        <img src={logo} alt="VectorSpeech" className="h-6" />
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        <div className="px-2 pb-2 pt-1">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-600">
            Tools
          </span>
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-[15px] font-medium transition-colors ${
                isActive
                  ? 'nav-active bg-zinc-800/70 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`
            }
          >
            <Icon className="w-[15px] h-[15px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {isCompiling && (
        <div className="px-4 pb-3">
          <CompileIndicator />
        </div>
      )}

      <div className="px-5 py-4 border-t border-zinc-700/30">
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isReady ? 'bg-emerald-400' : isLoading ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="text-sm text-zinc-500 font-medium">
            {isReady ? 'Engine Ready' : isCompiling ? 'Compiling...' : isLoading ? 'Loading...' : 'Engine Offline'}
          </span>
        </div>
      </div>
    </aside>
  )
}

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function PlaygroundIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function EchoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function VoiceCraftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function NarratorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function CompileIndicator() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-400/80 font-medium">Compiling sessions...</span>
        <span className="text-zinc-500 tabular-nums">{elapsed}s</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500/50 rounded-full animate-[compile-slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
      </div>
    </div>
  )
}
