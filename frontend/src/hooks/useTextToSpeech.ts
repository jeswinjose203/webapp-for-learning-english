import { useState, useCallback, useEffect } from 'react'

interface Voice {
  id: string
  name: string
  description: string
}

interface UseTextToSpeechResult {
  speak: (text: string) => void
  stop: () => void
  isSpeaking: boolean
  voices: Voice[]
  selectedVoice: string
  setSelectedVoice: (voice: string) => void
  speed: number
  setSpeed: (rate: number) => void
  useAIVoice: boolean
  setUseAIVoice: (val: boolean) => void
}

export function useTextToSpeech(): UseTextToSpeechResult {
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('nova')
  const [speed, setSpeed] = useState<number>(1.0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [useAIVoice, setUseAIVoice] = useState(true)
  const audioRef = useState<HTMLAudioElement | null>(null)

  // Load available AI voices
  useEffect(() => {
    fetchVoices()
    // Load saved preferences
    const savedVoice = localStorage.getItem('tts_voice')
    const savedSpeed = localStorage.getItem('tts_speed')
    const savedUseAI = localStorage.getItem('tts_use_ai')
    if (savedVoice) setSelectedVoice(savedVoice)
    if (savedSpeed) setSpeed(parseFloat(savedSpeed))
    if (savedUseAI !== null) setUseAIVoice(savedUseAI === 'true')
  }, [])

  // Save preferences
  useEffect(() => {
    localStorage.setItem('tts_voice', selectedVoice)
  }, [selectedVoice])
  useEffect(() => {
    localStorage.setItem('tts_speed', speed.toString())
  }, [speed])
  useEffect(() => {
    localStorage.setItem('tts_use_ai', useAIVoice.toString())
  }, [useAIVoice])

  const fetchVoices = async () => {
    try {
      const res = await fetch('/api/tts/voices')
      const data = await res.json()
      setVoices(data.voices)
      if (data.current_default && !localStorage.getItem('tts_voice')) {
        setSelectedVoice(data.current_default)
      }
    } catch {
      // Fallback voices if backend not running
      setVoices([
        { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced' },
        { id: 'echo', name: 'Echo', description: 'Male, warm' },
        { id: 'fable', name: 'Fable', description: 'British, narrative' },
        { id: 'nova', name: 'Nova', description: 'Female, friendly' },
        { id: 'onyx', name: 'Onyx', description: 'Male, deep' },
        { id: 'shimmer', name: 'Shimmer', description: 'Female, expressive' },
      ])
    }
  }

  const speak = useCallback((text: string) => {
    if (!text.trim()) return

    if (useAIVoice) {
      speakWithAI(text)
    } else {
      speakWithBrowser(text)
    }
  }, [selectedVoice, speed, useAIVoice])

  const speakWithAI = async (text: string) => {
    setIsSpeaking(true)

    try {
      const response = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          speed: speed,
        }),
      })

      if (!response.ok) {
        // Fallback to browser TTS
        speakWithBrowser(text)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }

      // Store reference for stop
      (window as any).__currentAudio = audio
      audio.play()
    } catch {
      // Fallback to browser TTS
      speakWithBrowser(text)
    }
  }

  const speakWithBrowser = (text: string) => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    setIsSpeaking(true)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = speed
    utterance.pitch = 1.0

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  const stop = useCallback(() => {
    // Stop AI audio
    const audio = (window as any).__currentAudio as HTMLAudioElement | undefined
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, voices, selectedVoice, setSelectedVoice, speed, setSpeed, useAIVoice, setUseAIVoice }
}

export default useTextToSpeech
