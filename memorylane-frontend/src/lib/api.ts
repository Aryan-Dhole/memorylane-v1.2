import axios from 'axios'
import { supabase } from './supabase'

const getApiBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (error) {
    console.warn("Could not retrieve session token, proceeding without auth headers:", error)
  }
  return config
})
