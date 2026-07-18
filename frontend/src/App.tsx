import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Learn from './pages/Learn'
import Chat from './pages/Chat'
import Call from './pages/Call'
import Translate from './pages/Translate'
import Pronounce from './pages/Pronounce'
import Debate from './pages/Debate'
import Flashcards from './pages/Flashcards'
import Chess from './pages/Chess'
import Progress from './pages/Progress'
import Usage from './pages/Usage'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { isLoggedIn } from './services/api'

// Stop all audio on page navigation
function AudioStopper() {
  const location = useLocation()

  useEffect(() => {
    // Stop OpenAI TTS audio
    const audio = (window as any).__currentAudio as HTMLAudioElement | undefined
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      ;(window as any).__currentAudio = null
    }
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [location.pathname])

  return null
}

function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Navbar onLogout={() => setLoggedIn(false)} />
      <main className="flex-1 overflow-y-auto p-6">
        <AudioStopper />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/call" element={<Call />} />
          <Route path="/translate" element={<Translate />} />
          <Route path="/pronounce" element={<Pronounce />} />
          <Route path="/debate" element={<Debate />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/chess" element={<Chess />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
