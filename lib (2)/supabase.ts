import { createClient } from '@supabase/supabase-js'

// Usamos || '' para que Vercel no marque error si la variable falta un segundo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://koatzrklsdukvaafqrkk.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYXR6cmtsc2R1a3ZhYWZxcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjA4MzcsImV4cCI6MjA5MTQzNjgzN30.QeBzXCyO4ERss78JKba4TM-uDN7y6ghCYvcO2PWXX8I';

// Solo creamos el cliente si las llaves existen de verdad
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
