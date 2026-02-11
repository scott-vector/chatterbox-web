/**
 * Progress bar for multi-chunk TTS generation.
 * Hidden when total <= 1 (single-chunk generation).
 */
export default function ChunkProgressBar({ current, total }) {
  if (total <= 1) return null

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          Generating chunk {current} of {total}...
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
