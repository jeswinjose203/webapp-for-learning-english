import { useState, useEffect } from 'react'
import { registerUser, loginUser, listUsers, setLoggedIn } from '../services/api'

interface LoginProps {
  onLogin: () => void
}

interface UserEntry {
  id: number
  name: string
  level: string
}

function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserEntry[]>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await listUsers()
      setUsers(res.data)
    } catch {
      // Server might not be running
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        const res = await registerUser(name.trim(), pin)
        setLoggedIn(res.data.id, res.data.name)
      } else {
        const res = await loginUser(name.trim(), pin)
        setLoggedIn(res.data.id, res.data.name)
      }
      onLogin()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (user: UserEntry) => {
    setName(user.name)
    setMode('login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-800">English Learning AI</h1>
          <p className="text-gray-500 text-sm mt-1">Learn English with your personal AI tutor</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            New User
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                  setPin(e.target.value)
                }
              }}
              placeholder="••••"
              maxLength={4}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Login'}
          </button>
        </div>

        {/* Existing users */}
        {users.length > 0 && mode === 'login' && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-3">Existing users:</p>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => quickLogin(user)}
                  className="bg-gray-100 hover:bg-indigo-50 text-gray-700 px-3 py-1.5 rounded-full text-sm transition-colors"
                >
                  {user.name} ({user.level})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
