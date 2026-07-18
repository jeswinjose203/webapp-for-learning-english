import { NavLink } from 'react-router-dom'
import { logout, getStoredStudentName } from '../services/api'

interface NavbarProps {
  onLogout: () => void
}

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/learn', label: 'Learn', icon: '📚' },
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/call', label: 'Call Tutor', icon: '📞' },
  { path: '/debate', label: 'Debate', icon: '🎭' },
  { path: '/chess', label: 'Chess', icon: '♟️' },
  { path: '/flashcards', label: 'Flashcards', icon: '📇' },
  { path: '/translate', label: 'Translate', icon: '🌐' },
  { path: '/pronounce', label: 'Pronounce', icon: '🔊' },
  { path: '/progress', label: 'Progress', icon: '📊' },
  { path: '/usage', label: 'Usage Report', icon: '📋' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

function Navbar({ onLogout }: NavbarProps) {
  const studentName = getStoredStudentName() || 'Learner'

  const handleLogout = () => {
    logout()
    onLogout()
  }

  return (
    <nav className="w-64 bg-indigo-900 text-white flex flex-col sticky top-0 h-screen overflow-y-auto">
      <div className="p-6 border-b border-indigo-700">
        <h1 className="text-xl font-bold">🎓 English AI</h1>
        <p className="text-indigo-300 text-sm mt-1">Hi, {studentName}!</p>
      </div>

      <ul className="flex-1 py-4">
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-700 text-white border-r-4 border-indigo-300'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="p-4 border-t border-indigo-700">
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-indigo-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>🚪</span>
          <span>Switch User / Logout</span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar
