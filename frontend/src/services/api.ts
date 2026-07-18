import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add student ID header to every request
api.interceptors.request.use((config) => {
  const studentId = localStorage.getItem('student_id')
  if (studentId) {
    config.headers['X-Student-ID'] = studentId
  }
  return config
})

// Auth API
export const registerUser = (name: string, pin: string) =>
  api.post('/students/register', { name, pin })
export const loginUser = (name: string, pin: string) =>
  api.post('/students/login', { name, pin })
export const listUsers = () => api.get('/students/list')

// Students API
export const getStudentProfile = (studentId?: number) => {
  const id = studentId || localStorage.getItem('student_id')
  return api.get(`/students/profile/${id}`)
}
export const updateStudentProfile = (data: { name?: string; native_language?: string; current_level?: string }) => {
  const id = localStorage.getItem('student_id')
  return api.put(`/students/profile/${id}`, data)
}

// Lessons API
export const getTodaysLesson = () => api.get('/lessons/today')
export const getLessonHistory = (limit = 20) => api.get(`/lessons/history?limit=${limit}`)
export const completeLesson = (lessonId: number, score: number) =>
  api.post(`/lessons/${lessonId}/complete`, { score })

// Chat API
export const sendMessage = (message: string, mode: string = 'chat') =>
  api.post('/chat/send', { message, mode })
export const getChatHistory = (limit = 50, mode: string = 'chat') =>
  api.get(`/chat/history?limit=${limit}&mode=${mode}`)
export const clearChatHistory = (mode: string = 'chat') =>
  api.delete(`/chat/history?mode=${mode}`)

// Progress API
export const getCurrentProgress = () => api.get('/progress/current')
export const getProgressHistory = (limit = 30) => api.get(`/progress/history?limit=${limit}`)
export const getWeaknesses = () => api.get('/progress/weaknesses')

// Helper
export const isLoggedIn = () => !!localStorage.getItem('student_id')
export const getStoredStudentId = () => localStorage.getItem('student_id')
export const getStoredStudentName = () => localStorage.getItem('student_name')

export const setLoggedIn = (id: number, name: string) => {
  localStorage.setItem('student_id', id.toString())
  localStorage.setItem('student_name', name)
}

export const logout = () => {
  localStorage.removeItem('student_id')
  localStorage.removeItem('student_name')
}

export default api
