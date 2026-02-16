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

export default function ModelLoader({ compact = false }) {
  const { isIdle, isLoading, isReady, isError, loadProgress, modelDevice, modelError } = useModelStatus()
  const { loadModel } = useTTS()

  if (isReady) return null

  if (isError) {
    return (
      <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
        <p className="text-xs text-red-400 font-medium mb-1">Load failed</p>
        <button
          onClick={() => loadModel()}
          className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (isLoading) {
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

    return (
      <div className="rounded-md border border-zinc-600/40 bg-zinc-800/40 px-3 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">
            {allDownloaded ? 'Initializing...' : 'Downloading...'}
          </span>
        </div>

        {sessionList.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500 font-medium">{s.label}</span>
              <span className="text-zinc-600 tabular-nums">
                {isFileDone(s)
                  ? formatBytes(s.size) || 'Done'
                  : s.progress != null
                    ? `${Math.round(s.progress)}%`
                    : '...'}
              </span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFileDone(s) ? 'bg-emerald-500' : 'bg-indigo-500 animate-progress-pulse'
                }`}
                style={{ width: `${isFileDone(s) ? 100 : s.progress || 0}%` }}
              />
            </div>
          </div>
        ))}

        {allDownloaded && <CompileTimer />}
      </div>
    )
  }

  // Idle
  return (
    <button
      onClick={() => loadModel()}
      className="w-full px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
    >
      Load Engine
    </button>
  )
}

function CompileTimer() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span className="animate-pulse font-medium">Compiling...</span>
        <span className="tabular-nums">{elapsed}s</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500/60 rounded-full animate-[compile-slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
      </div>
    </div>
  )
}
