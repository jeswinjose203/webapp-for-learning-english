import { useState, useRef, useCallback } from 'react'

interface UseSpeechRecognitionResult {
  isListening: boolean
  transcript: string
  interimText: string
  detectedLanguage: string
  error: string | null
  startListening: (lang?: string) => void
  stopListening: () => void
  resetTranscript: () => void
  onSpeechEnd: React.MutableRefObject<((finalText: string) => void) | null>
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('en-US')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const fullTranscriptRef = useRef<string>('')
  const onSpeechEnd = useRef<((finalText: string) => void) | null>(null)

  const startListening = useCallback((lang?: string) => {
    setError(null)
    setTranscript('')
    setInterimText('')
    fullTranscriptRef.current = ''

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      return
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }

    const recognition = new SpeechRecognition()
    // NOT continuous — stops after user pauses speaking
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = lang || 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      fullTranscriptRef.current = ''
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let currentInterim = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
          const detected = detectLanguageFromText(result[0].transcript)
          if (detected) setDetectedLanguage(detected)
        } else {
          currentInterim += result[0].transcript
        }
      }

      // Always store the best text we have (final or interim)
      if (finalTranscript.trim()) {
        fullTranscriptRef.current = finalTranscript.trim()
        setTranscript(finalTranscript.trim())
      } else if (currentInterim.trim()) {
        // If no final yet, store interim as fallback
        fullTranscriptRef.current = currentInterim.trim()
      }
      setInterimText(currentInterim)
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech recognition error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')

      // When speech recognition ends naturally (user stopped talking),
      // call the callback with whatever text we captured
      const finalText = fullTranscriptRef.current.trim()
      if (finalText && onSpeechEnd.current) {
        onSpeechEnd.current(finalText)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimText('')
    fullTranscriptRef.current = ''
  }, [])

  return { isListening, transcript, interimText, detectedLanguage, error, startListening, stopListening, resetTranscript, onSpeechEnd }
}


function detectLanguageFromText(text: string): string | null {
  const clean = text.replace(/[\s\d.,!?'"()-]/g, '')
  if (!clean) return null

  let english = 0, malayalam = 0, devanagari = 0, tamil = 0, telugu = 0
  let kannada = 0, bengali = 0, gujarati = 0, gurmukhi = 0, arabic = 0

  for (const char of clean) {
    const code = char.charCodeAt(0)
    if (code >= 0x0041 && code <= 0x007A) english++
    else if (code >= 0x0D00 && code <= 0x0D7F) malayalam++
    else if (code >= 0x0900 && code <= 0x097F) devanagari++
    else if (code >= 0x0B80 && code <= 0x0BFF) tamil++
    else if (code >= 0x0C00 && code <= 0x0C7F) telugu++
    else if (code >= 0x0C80 && code <= 0x0CFF) kannada++
    else if (code >= 0x0980 && code <= 0x09FF) bengali++
    else if (code >= 0x0A80 && code <= 0x0AFF) gujarati++
    else if (code >= 0x0A00 && code <= 0x0A7F) gurmukhi++
    else if (code >= 0x0600 && code <= 0x06FF) arabic++
  }

  const total = clean.length
  if (total === 0) return null

  if (malayalam / total > 0.3) return 'ml-IN'
  if (devanagari / total > 0.3) return 'hi-IN'
  if (tamil / total > 0.3) return 'ta-IN'
  if (telugu / total > 0.3) return 'te-IN'
  if (kannada / total > 0.3) return 'kn-IN'
  if (bengali / total > 0.3) return 'bn-IN'
  if (gujarati / total > 0.3) return 'gu-IN'
  if (gurmukhi / total > 0.3) return 'pa-IN'
  if (arabic / total > 0.3) return 'ur-IN'
  if (english / total > 0.5) return 'en-US'

  return null
}

export default useSpeechRecognition
