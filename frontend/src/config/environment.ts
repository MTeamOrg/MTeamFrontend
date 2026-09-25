const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) throw new Error('VITE_API_URL is required')

export const environment = {
  apiUrl: API_URL.replace(/\/$/, ''),
} as const
