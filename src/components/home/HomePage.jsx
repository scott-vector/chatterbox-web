import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ModelLoader from '../shared/ModelLoader'
import { useModelStatus } from '../../hooks/useModelStatus'

const modes = [
  {
    to: '/playground',
    title: 'Playground',
    description: 'Generate speech, adjust expressiveness, and test voices.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
  {
    to: '/echo',
    title: 'Echo',
    description: 'Create personalized voice message cards.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    to: '/voicecraft',
    title: 'VoiceCraft',
    description: 'Build multi-character dialogues with unique voices.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/narrator',
    title: 'Narrator',
    description: 'Turn stories into narrated audiobooks.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function HomePage() {
  const { isReady } = useModelStatus()

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500">
          Select a tool to get started, or load the speech engine below.
        </p>
      </motion.div>

      <div className="max-w-lg mb-10">
        <ModelLoader />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {modes.map((mode) => (
          <motion.div key={mode.to} variants={item}>
            <Link
              to={mode.to}
              className={`group flex items-start gap-4 p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/40 hover:border-zinc-700/60 transition-all ${
                !isReady ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors shrink-0 mt-0.5">
                {mode.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-zinc-200 mb-0.5">{mode.title}</h3>
                <p className="text-[12px] text-zinc-500 leading-relaxed">{mode.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
