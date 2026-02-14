import { useEffect, useMemo, useRef } from 'react'

const MIN_TOKEN_DURATION_SEC = 0.08

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
    const normalizeTokens = (rawTokens) => {
      const sorted = rawTokens
        .filter((token) => Number.isFinite(token.start))
        .sort((a, b) => a.start - b.start)

      return sorted.map((token, index) => {
        const nextStart = sorted[index + 1]?.start
        const fallbackEnd =
          Number.isFinite(nextStart) && nextStart > token.start
            ? nextStart
            : token.start + MIN_TOKEN_DURATION_SEC
        const end = Number.isFinite(token.end) && token.end > token.start ? token.end : fallbackEnd
        return {
          ...token,
          end: Math.max(end, token.start + MIN_TOKEN_DURATION_SEC),
        }
      })
    }

    if (Array.isArray(wordTimestamps) && wordTimestamps.length > 0) {
      const parsedTokens = wordTimestamps
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

      return normalizeTokens(parsedTokens)
    }

    return normalizeTokens(tokenizeWithFallback(text, duration))
  }, [duration, text, wordTimestamps])

  const activeTokenRef = useRef(null)
  const previousActiveIndex = useRef(-1)

  const activeIndex = useMemo(() => {
    if (tokens.length === 0) return -1

    let low = 0
    let high = tokens.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const token = tokens[mid]

      if (currentTime < token.start) {
        high = mid - 1
        continue
      }

      if (currentTime >= token.end) {
        low = mid + 1
        continue
      }

      return mid
    }

    return -1
  }, [currentTime, tokens])

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
