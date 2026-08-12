import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasValidUrl =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-ref')

const hasValidAnonKey =
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-anon-key'

export const isSupabaseConfigured = hasValidUrl && hasValidAnonKey

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

type SharedProgressRow = {
  id: string
  owner_id: string
  caught_ids: number[]
  updated_at?: string
}

const PROGRESS_ROW_ID = 'main'

export async function signInOwner(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function signOutOwner() {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentUser() {
  if (!supabase) {
    return null
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user
}

export function onAuthStateChange(
  callback: Parameters<NonNullable<typeof supabase>['auth']['onAuthStateChange']>[0],
) {
  if (!supabase) {
    return {
      data: {
        subscription: {
          unsubscribe() {
            return undefined
          },
        },
      },
    }
  }

  return supabase.auth.onAuthStateChange(callback)
}

export async function fetchSharedProgress() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('pokedex_progress')
    .select('caught_ids')
    .eq('id', PROGRESS_ROW_ID)
    .maybeSingle<Pick<SharedProgressRow, 'caught_ids'>>()

  if (error) {
    throw error
  }

  return data?.caught_ids ?? null
}

export async function saveSharedProgress(caughtIds: number[], ownerId: string) {
  if (!supabase) {
    return
  }

  const payload: SharedProgressRow = {
    id: PROGRESS_ROW_ID,
    owner_id: ownerId,
    caught_ids: caughtIds,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('pokedex_progress')
    .upsert(payload, { onConflict: 'id' })

  if (error) {
    throw error
  }
}
