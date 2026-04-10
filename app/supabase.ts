import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dkpcmtkbzjpqhlgopzgi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcGNtdGtiempwcWhsZ29wemdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzQzNDksImV4cCI6MjA5MTM1MDM0OX0.2Y4-ShoteVLdiRk5C1reNSxg9UISIDnUO7xGwl-Ac2s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
