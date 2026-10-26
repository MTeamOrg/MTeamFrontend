const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const environment = {
  apiUrl: API_URL.replace(/\/$/, ''),
} as const
