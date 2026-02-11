import { useState, useCallback, useRef } from 'react'
import { useTTS } from './useTTS'
import { splitTextIntoChunks } from '../lib/text-chunker'
import { concatFloat32Arrays, createSilence } from '../lib/audio-utils'
import { SENTENCE_SILENCE_SEC, PARAGRAPH_SILENCE_SEC } from '../lib/constants'

/**
 * Wraps useTTS with automatic text chunking for long-form generation.
 *
 * - Single-chunk text goes straight through generate() with no overhead.
 * - Multi-chunk text is generated sequentially, concatenated with silence gaps,
 *   and returns the same { waveform, inferenceTime } shape.
 * - Exposes chunkProgress and abortGeneration for UI feedback.
 */
export function useChunkedTTS() {
  const tts = useTTS()
  const { generate } = tts

  const [chunkProgress, setChunkProgress] = useState({
    current: 0,
    total: 0,
    phase: 'idle',
  })

  const abortRef = useRef(false)

  const abortGeneration = useCallback(() => {
    abortRef.current = true
  }, [])

  const generateChunked = useCallback(
    async (text, speakerId, exaggeration = 0.5) => {
      const chunks = splitTextIntoChunks(text)

      if (chunks.length === 0) return null

      // Single-chunk fast path — no overhead
      if (chunks.length === 1) {
        setChunkProgress({ current: 1, total: 1, phase: 'generating' })
        try {
          const result = await generate(chunks[0].text, speakerId, exaggeration)
          setChunkProgress({ current: 1, total: 1, phase: 'done' })
          return result
        } finally {
          setChunkProgress({ current: 0, total: 0, phase: 'idle' })
        }
      }

      // Multi-chunk path
      abortRef.current = false
      setChunkProgress({ current: 0, total: chunks.length, phase: 'generating' })

      const waveforms = []
      let totalInferenceTime = 0

      try {
        for (let i = 0; i < chunks.length; i++) {
          if (abortRef.current) {
            setChunkProgress({ current: 0, total: 0, phase: 'idle' })
            return null
          }

          setChunkProgress({ current: i + 1, total: chunks.length, phase: 'generating' })

          const result = await generate(chunks[i].text, speakerId, exaggeration)
          waveforms.push(result.waveform)
          totalInferenceTime += result.inferenceTime

          // Add silence gap before the next chunk (not after the last)
          if (i < chunks.length - 1) {
            const nextChunk = chunks[i + 1]
            const silenceDuration =
              nextChunk.type === 'paragraph_start'
                ? PARAGRAPH_SILENCE_SEC
                : SENTENCE_SILENCE_SEC
            waveforms.push(createSilence(silenceDuration))
          }
        }

        setChunkProgress({ current: chunks.length, total: chunks.length, phase: 'done' })

        const concatenated = concatFloat32Arrays(waveforms)
        return {
          waveform: concatenated,
          inferenceTime: totalInferenceTime,
        }
      } finally {
        setChunkProgress({ current: 0, total: 0, phase: 'idle' })
      }
    },
    [generate],
  )

  return {
    ...tts,
    generateChunked,
    chunkProgress,
    abortGeneration,
  }
}
