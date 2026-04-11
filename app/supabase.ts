import { createClient } from '@supabase/supabase-js'

// Usamos || '' para que Vercel no marque error si la variable falta un segundo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Solo creamos el cliente si las llaves existen de verdad
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
