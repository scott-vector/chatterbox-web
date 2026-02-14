import { useMemo } from 'react'

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

export default function WordLevelTranscript({ text, wordTimestamps, currentTime, duration }) {
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

  if (tokens.length === 0) return null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
        Transcript ({Array.isArray(wordTimestamps) && wordTimestamps.length > 0 ? 'word timestamps' : 'estimated timing'})
      </p>
      <div className="leading-7">
        {tokens.map((token, index) => {
          const isActive = currentTime >= token.start && currentTime < token.end
          return (
            <span
              key={`${token.word}-${index}-${token.start}`}
              className={`mr-1.5 rounded px-1 py-0.5 text-sm transition-colors ${isActive ? 'bg-violet-500/30 text-violet-200' : 'text-zinc-300'}`}
            >
              {token.word}
            </span>
          )
        })}
      </div>
    </div>
  )
}
