import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_TRANSCRIPT_SYNC_DELAY_SEC } from '../lib/constants'
import {
  deleteReferenceVoice,
  getReferenceVoice,
  listReferenceVoices,
  saveReferenceVoice,
  updateReferenceVoice,
} from '../lib/indexed-db'

export function useReferenceVoices() {
  const [voices, setVoices] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const items = await listReferenceVoices()
      setVoices(items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveVoice = useCallback(async (name, audioData) => {
    const voice = {
      id: crypto.randomUUID(),
      name: name.trim(),
      audioData,
      transcriptSyncDelaySec: DEFAULT_TRANSCRIPT_SYNC_DELAY_SEC,
    }
    await saveReferenceVoice(voice)
    await refresh()
    return voice.id
  }, [refresh])

  const removeVoice = useCallback(async (id) => {
    await deleteReferenceVoice(id)
    await refresh()
  }, [refresh])

  const loadVoiceAudio = useCallback(async (id) => {
    const voice = await getReferenceVoice(id)
    return voice?.audioData || null
  }, [])

  const updateVoiceTranscriptSyncDelay = useCallback(async (id, transcriptSyncDelaySec) => {
    await updateReferenceVoice(id, { transcriptSyncDelaySec })
    await refresh()
  }, [refresh])

  return {
    voices,
    loading,
    saveVoice,
    removeVoice,
    loadVoiceAudio,
    updateVoiceTranscriptSyncDelay,
    refresh,
  }
}
