import { useState, useEffect, useRef } from 'react'
import { useModelStatus } from '../../hooks/useModelStatus'
import { useTTS } from '../../hooks/useTTS'

const SESSION_LABELS = {
  'embed_tokens': 'Embed Tokens',
  'speech_encoder': 'Speech Encoder',
  'language_model': 'Language Model',
  'language_model_q4': 'Language Model',
  'language_model_q4f16': 'Language Model',
  'language_model_fp16': 'Language Model',
  'conditional_decoder': 'Conditional Decoder',
}

function getFileLabel(filePath) {
  if (!filePath) return null
  const basename = filePath.split('/').pop().replace(/\.onnx(_data)?$/, '')
  return SESSION_LABELS[basename] || basename
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const CIRCLE_SIZE = 160
const STROKE_WIDTH = 6
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function EngineLoadModal() {
  const { isReady, isLoading, isError, loadProgress, modelError } = useModelStatus()
  const { loadModel } = useTTS()
  const startedRef = useRef(false)
  const [dismissed, setDismissed] = useState(false)

  // Auto-start loading on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      loadModel()
    }
  }, [loadModel])

  const onnxFiles = loadProgress.filter((p) => p.file && p.file.endsWith('.onnx'))
  const dataFiles = loadProgress.filter((p) => p.file && p.file.endsWith('.onnx_data'))

  const isFileDone = (s) => s.status !== 'progress' && s.status !== 'initiate' && s.status !== 'download'
  const sessions = new Map()
  for (const f of [...onnxFiles, ...dataFiles]) {
    const label = getFileLabel(f.file)
    if (!label) continue
    const existing = sessions.get(label)
    if (!existing) {
      sessions.set(label, { ...f, label, size: f.total || 0 })
    } else {
      if (!isFileDone(f)) {
        existing.status = f.status
        existing.progress = f.progress
      }
      existing.size = (existing.size || 0) + (f.total || 0)
    }
  }

  const sessionList = [...sessions.values()]
  const allDownloaded = sessionList.length > 0 && sessionList.every((s) => isFileDone(s))

  // Dismiss modal once all downloads complete — show 100% briefly then fade
  useEffect(() => {
    if (allDownloaded && !dismissed) {
      const timer = setTimeout(() => setDismissed(true), 600)
      return () => clearTimeout(timer)
    }
  }, [allDownloaded, dismissed])

  // Don't render when dismissed or ready
  if (isReady || dismissed) return null

  // Overall progress
  let overallProgress = 0
  if (sessionList.length > 0) {
    const total = sessionList.reduce((sum, s) => sum + (isFileDone(s) ? 100 : (s.progress || 0)), 0)
    overallProgress = total / sessionList.length
  }

  const strokeDashoffset = CIRCUMFERENCE - (overallProgress / 100) * CIRCUMFERENCE

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1f]/97 backdrop-blur-md">
      <div className="w-full max-w-lg px-8">
        {/* Error state */}
        {isError && (
          <div className="text-center space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-red-500/30 bg-red-500/10 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7 text-red-400">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-1.5">Engine failed to load</h2>
              <p className="text-sm text-zinc-500">Something went wrong. Please try again.</p>
            </div>
            <p className="text-xs text-zinc-600 break-all leading-relaxed max-w-sm mx-auto">{modelError}</p>
            <button
              onClick={() => loadModel()}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center">
            {/* Circle progress */}
            <div className="relative mb-8">
              <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="-rotate-90">
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  className="text-zinc-800"
                />
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="url(#progress-gradient)"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tabular-nums text-zinc-100">{Math.round(overallProgress)}</span>
                <span className="text-sm font-medium text-zinc-500 -mt-0.5">%</span>
              </div>
            </div>

            {/* Status text */}
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">
              {allDownloaded ? 'Downloads complete' : 'Loading speech engine...'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              {allDownloaded
                ? 'Starting compilation...'
                : 'Downloading models (~1.5 GB, cached after first load).'}
            </p>

            {/* Per-session progress */}
            <div className="w-full rounded-lg border border-zinc-600/40 bg-zinc-800/30 p-4 space-y-3">
              {sessionList.map((s) => (
                <div key={s.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">{s.label}</span>
                    <span className="text-zinc-500 tabular-nums">
                      {isFileDone(s)
                        ? formatBytes(s.size) || 'Done'
                        : s.progress != null
                          ? `${Math.round(s.progress)}%`
                          : '...'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isFileDone(s) ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${isFileDone(s) ? 100 : s.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))}

              {sessionList.length === 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs text-zinc-500">Initializing download...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Idle / preparing state */}
        {!isLoading && !isError && (
          <div className="text-center">
            <div className="relative inline-block mb-6">
              <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="animate-spin" style={{ animationDuration: '2s' }}>
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  className="text-zinc-800"
                />
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * 0.75}
                  className="text-indigo-500/50"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">Preparing engine...</h2>
            <p className="text-sm text-zinc-500">Starting up.</p>
          </div>
        )}
      </div>
    </div>
  )
}
