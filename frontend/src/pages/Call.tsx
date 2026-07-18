import { useState, useEffect, useRef } from 'react'
import { sendMessage } from '../services/api'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import useTextToSpeech from '../hooks/useTextToSpeech'

interface TranscriptEntry {
  id: number
  role: 'user' | 'ai'
  text: string
}

function Call() {
  const [isInCall, setIsInCall] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [status, setStatus] = useState<string>('Ready to call')
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [waitingForAi, setWaitingForAi] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInCallRef = useRef<boolean>(false)
  const waitingRef = useRef<boolean>(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const { isListening, transcript: voiceText, interimText, startListening, stopListening, resetTranscript, onSpeechEnd } = useSpeechRecognition()
  const { speak, stop: stopSpeaking, isSpeaking } = useTextToSpeech()

  // Keep refs in sync
  useEffect(() => {
    isInCallRef.current = isInCall
  }, [isInCall])

  useEffect(() => {
    waitingRef.current = waitingForAi
  }, [waitingForAi])

  // Set up the speech end callback — when user stops talking, send their message
  useEffect(() => {
    onSpeechEnd.current = (finalText: string) => {
      if (finalText && isInCallRef.current && !waitingRef.current) {
        handleUserSpoke(finalText)
      }
    }
  }, [])

  // Call timer
  useEffect(() => {
    if (isInCall) {
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isInCall])

  // Track when AI finishes speaking → start listening again
  useEffect(() => {
    if (!aiSpeaking && !waitingForAi && isInCallRef.current && !isListening) {
      // AI just finished — start listening after a short pause
      const timer = setTimeout(() => {
        if (isInCallRef.current && !waitingRef.current) {
          setStatus('Your turn — speak now')
          resetTranscript()
          startListening('en-IN')
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [aiSpeaking])

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const startCall = () => {
    setIsInCall(true)
    setCallDuration(0)
    setTranscript([])
    setStatus('Connecting...')

    // AI starts the conversation
    setTimeout(async () => {
      setStatus('AI is speaking...')
      setWaitingForAi(true)

      try {
        const res = await sendMessage("Hello! Start a conversation with me. Keep it short and natural.", "call")
        const aiText = res.data.reply

        setStatus('AI is speaking...')
        setAiSpeaking(true)
        await speakWithLiveTranscript(aiText)
        setAiSpeaking(false)
      } catch {
        const fallback = "Hello! How are you today?"
        setStatus('AI is speaking...')
        setAiSpeaking(true)
        await speakWithLiveTranscript(fallback)
        setAiSpeaking(false)
      } finally {
        setWaitingForAi(false)
      }
    }, 1000)
  }

  const endCall = () => {
    setIsInCall(false)
    stopListening()
    stopSpeaking()
    setStatus('Call ended')
    setAiSpeaking(false)
    setWaitingForAi(false)
  }

  const handleUserSpoke = async (text: string) => {
    setTranscript(prev => [...prev, { id: Date.now(), role: 'user', text }])
    setStatus('AI is thinking...')
    setWaitingForAi(true)
    resetTranscript()

    try {
      // Auto-detect non-English
      const hasNonEnglish = /[^\x00-\x7F]/.test(text)
      let messageToSend = text

      if (hasNonEnglish) {
        messageToSend = `[The student said this which contains non-English: "${text}"]. Translate it to English, tell them how to say it in English, then continue the conversation naturally.`
      }

      const res = await sendMessage(messageToSend, "call")
      const aiText = res.data.reply

      if (!isInCallRef.current) return

      // Show transcript word-by-word while audio plays
      setStatus('AI is speaking...')
      setAiSpeaking(true)
      await speakWithLiveTranscript(aiText)
      setAiSpeaking(false)
    } catch {
      if (!isInCallRef.current) return
      setStatus('Your turn — speak now')
      setTimeout(() => {
        if (isInCallRef.current) {
          startListening('en-IN')
        }
      }, 500)
    } finally {
      setWaitingForAi(false)
    }
  }

  // Play AI audio and reveal transcript word-by-word simultaneously
  const speakWithLiveTranscript = (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      const words = text.split(' ')
      const msPerWord = 130
      const msgId = Date.now() + 1

      // Show typing animation while audio loads
      setTranscript(prev => [...prev, { id: msgId, role: 'ai', text: '...' }])

      // Fetch audio FIRST
      let audio: HTMLAudioElement | null = null
      try {
        const response = await fetch('/api/tts/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'nova', speed: 1.0 }),
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          audio = new Audio(url)
          // Wait for audio to be ready
          await new Promise<void>((res) => {
            audio!.oncanplaythrough = () => res()
            audio!.onerror = () => res()
            audio!.load()
          })
        }
      } catch {}

      if (!isInCallRef.current) { resolve(); return }

      // NOW start both audio and word reveal at the same time
      // Clear the typing indicator
      setTranscript(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (lastIdx >= 0 && updated[lastIdx].id === msgId) {
          updated[lastIdx] = { id: msgId, role: 'ai', text: '' }
        }
        return updated
      })

      // Start word reveal
      let revealedWords = 0
      const wordInterval = setInterval(() => {
        revealedWords++
        if (revealedWords <= words.length) {
          const partial = words.slice(0, revealedWords).join(' ')
          setTranscript(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].id === msgId) {
              updated[lastIdx] = { id: msgId, role: 'ai', text: partial }
            }
            return updated
          })
        } else {
          clearInterval(wordInterval)
        }
      }, msPerWord)

      // Play audio
      if (audio) {
        ;(window as any).__currentAudio = audio

        audio.onended = () => {
          clearInterval(wordInterval)
          setTranscript(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].id === msgId) {
              updated[lastIdx] = { id: msgId, role: 'ai', text }
            }
            return updated
          })
          ;(window as any).__currentAudio = null
          resolve()
        }
        audio.onerror = () => {
          clearInterval(wordInterval)
          setTranscript(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0) updated[lastIdx] = { id: msgId, role: 'ai', text }
            return updated
          })
          resolve()
        }
        audio.play()
      } else {
        // No audio available — just show words with timing
        await new Promise(r => setTimeout(r, words.length * msPerWord + 300))
        clearInterval(wordInterval)
        setTranscript(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0) updated[lastIdx] = { id: msgId, role: 'ai', text }
          return updated
        })
        resolve()
      }
    })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center max-w-lg mx-auto">
      {!isInCall ? (
        // Pre-call screen
        <div className="text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-5xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">AI English Tutor</h1>
          <p className="text-gray-600 mb-8">Have a live voice conversation to practice speaking.</p>

          <button
            onClick={startCall}
            className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-full text-lg font-semibold shadow-lg transition-all hover:scale-105 flex items-center gap-3 mx-auto"
          >
            <span className="text-2xl">📞</span>
            Call Tutor
          </button>

          <p className="text-xs text-gray-400 mt-4">Uses your microphone. Speak naturally — AI responds with voice.</p>
        </div>
      ) : (
        // In-call screen
        <div className="w-full flex flex-col h-full">
          {/* Call header */}
          <div className="text-center py-4">
            <div className="relative inline-block">
              <div className={`w-20 h-20 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg ${aiSpeaking ? 'animate-pulse' : ''}`}>
                <span className="text-3xl">🎓</span>
              </div>
              {aiSpeaking && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-xs">🔊</span>
                </div>
              )}
              {isListening && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-xs">🎤</span>
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mt-3">AI Tutor</h2>
            <p className="text-green-600 text-sm font-medium">{formatTime(callDuration)}</p>
            <p className="text-xs text-gray-500 mt-1">{status}</p>
          </div>

          {/* Live waveform */}
          <div className="flex justify-center items-center gap-1 h-10 my-2">
            {(isListening || aiSpeaking) && (
              <>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full ${aiSpeaking ? 'bg-indigo-500' : 'bg-red-500'}`}
                    style={{
                      height: `${Math.random() * 24 + 8}px`,
                      animation: 'pulse 0.5s infinite',
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </>
            )}
          </div>

          {/* Live transcript */}
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Live transcript</p>
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`mb-3 ${entry.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <span
                  className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                    entry.role === 'user'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            ))}

            {/* Show what user is currently saying */}
            {isListening && (voiceText || interimText) && (
              <div className="mb-3 text-right">
                <span className="inline-block px-3 py-2 rounded-lg text-sm bg-indigo-50 text-indigo-600 italic max-w-[80%]">
                  {voiceText}{interimText ? ' ' + interimText : ''}
                  <span className="animate-pulse">|</span>
                </span>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* End call button */}
          <div className="text-center pb-4">
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg transition-all hover:scale-105"
            >
              🔴 End Call
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Call
