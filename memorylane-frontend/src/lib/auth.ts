import { supabase } from './supabase'

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  })
  if (error) throw error
}

export const signInWithEmail = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,
    }
  })
  if (error) throw error
}

export const signInWithPhone = async (phone: string) => {
  const normalizedPhone = `+91${phone.replace(/^(\+91|0)/, '')}` // normalize Indian numbers
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone
  })
  if (error) throw error
}

export const verifyPhoneOtp = async (phone: string, token: string) => {
  const normalizedPhone = `+91${phone.replace(/^(\+91|0)/, '')}`
  const { error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token,
    type: 'sms'
  })
  if (error) throw error
}

export const signOut = async () => {
  await supabase.auth.signOut()
  window.location.href = '/'
}
