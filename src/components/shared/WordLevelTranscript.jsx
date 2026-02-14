import { useEffect, useMemo, useRef } from 'react'

function tokenizeWithFallback(text, duration) {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length === 0) return []

  const step = duration > 0 ? duration / words.length : 0

  return words.map((word, index) => ({
    word,
    start: step * index,
    end: step * (index + 1),
  }))
}

export default function WordLevelTranscript({
  text,
  wordTimestamps,
  currentTime,
  duration,
  title = 'Transcript',
  maxHeightClass = 'max-h-32',
  onWordClick,
}) {
  const tokens = useMemo(() => {
    if (Array.isArray(wordTimestamps) && wordTimestamps.length > 0) {
      return wordTimestamps
        .map((token) => {
          const word = token.word ?? token.text ?? token.token
          if (!word) return null
          return {
            word: String(word),
            start: Number(token.start ?? 0),
            end: Number(token.end ?? token.start ?? 0),
          }
        })
        .filter(Boolean)
    }

    return tokenizeWithFallback(text, duration)
  }, [duration, text, wordTimestamps])

  const activeTokenRef = useRef(null)
  const previousActiveIndex = useRef(-1)

  const activeIndex = useMemo(
    () => tokens.findIndex((token) => currentTime >= token.start && currentTime < token.end),
    [currentTime, tokens],
  )

  useEffect(() => {
    if (!activeTokenRef.current || previousActiveIndex.current === activeIndex) return

    activeTokenRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })

    previousActiveIndex.current = activeIndex
  }, [activeIndex])

  if (tokens.length === 0) return null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
        {title} ({Array.isArray(wordTimestamps) && wordTimestamps.length > 0 ? 'word timestamps' : 'estimated timing'})
      </p>
      <div className={`overflow-y-auto pr-1 leading-7 ${maxHeightClass}`}>
        {tokens.map((token, index) => {
          const isActive = index === activeIndex
          return (
            <button
              type="button"
              key={`${token.word}-${index}-${token.start}`}
              ref={isActive ? activeTokenRef : null}
              onClick={onWordClick ? () => onWordClick(token, index) : undefined}
              className={`mr-1.5 rounded px-1 py-0.5 text-sm transition-colors ${isActive ? 'bg-violet-500/30 text-violet-200' : 'text-zinc-300'} ${onWordClick ? 'hover:bg-zinc-700/60 cursor-pointer' : 'cursor-default'}`}
            >
              {token.word}
            </button>
          )
        })}
      </div>
    </div>
  )
}
