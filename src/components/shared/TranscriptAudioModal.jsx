import { useEffect, useMemo, useRef, useState } from 'react'
import WordLevelTranscript from './WordLevelTranscript'

const TRANSCRIPT_SYNC_DELAY_SEC = 0.18

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function TranscriptAudioModal({ isOpen, job, initialTime = 0, onClose }) {
  const audioRef = useRef(null)
  const rafRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!isOpen || !audioRef.current) return undefined

    const audioEl = audioRef.current

    const stopSync = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const syncCurrentTime = () => {
      setCurrentTime(audioEl.currentTime)

      if (!audioEl.paused && !audioEl.ended) {
        rafRef.current = requestAnimationFrame(syncCurrentTime)
      } else {
        rafRef.current = null
      }
    }

    const startSync = () => {
      stopSync()
      rafRef.current = requestAnimationFrame(syncCurrentTime)
    }

    audioEl.addEventListener('play', startSync)
    audioEl.addEventListener('seeking', syncCurrentTime)
    audioEl.addEventListener('seeked', syncCurrentTime)
    audioEl.addEventListener('pause', stopSync)
    audioEl.addEventListener('ended', stopSync)

    if (!audioEl.paused) startSync()

    return () => {
      audioEl.removeEventListener('play', startSync)
      audioEl.removeEventListener('seeking', syncCurrentTime)
      audioEl.removeEventListener('seeked', syncCurrentTime)
      audioEl.removeEventListener('pause', stopSync)
      audioEl.removeEventListener('ended', stopSync)
      stopSync()
    }
  }, [isOpen, job?.id])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !audioRef.current) return

    const audioEl = audioRef.current
    const target = Number.isFinite(initialTime) ? initialTime : 0
    audioEl.currentTime = target
    setCurrentTime(target)

    const playPromise = audioEl.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {})
    }
  }, [initialTime, isOpen, job?.id])

  const progress = useMemo(() => {
    if (!duration) return 0
    return Math.min(100, (currentTime / duration) * 100)
  }, [currentTime, duration])

  const transcriptTime = useMemo(
    () => Math.max(0, currentTime - TRANSCRIPT_SYNC_DELAY_SEC),
    [currentTime],
  )

  if (!isOpen || !job?.output?.url) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 p-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Now playing: {job.title}</h3>
            <p className="text-xs text-zinc-400">Immersive transcript mode with word-level sync</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-4">
          <audio
            ref={audioRef}
            controls
            autoPlay
            src={job.output.url}
            className="w-full"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const loadedDuration = e.currentTarget.duration
              setDuration(Number.isFinite(loadedDuration) ? loadedDuration : 0)
            }}
          />

          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <WordLevelTranscript
            title="Transcript"
            text={job.text}
            wordTimestamps={job.output.wordTimestamps}
            currentTime={transcriptTime}
            duration={duration}
            maxHeightClass="max-h-[50vh]"
            onWordClick={(token) => {
              if (!audioRef.current) return
              audioRef.current.currentTime = token.start
              setCurrentTime(token.start)
            }}
          />
        </div>
      </div>
    </div>
  )
}
