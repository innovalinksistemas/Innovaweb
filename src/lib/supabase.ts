import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env');
}

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce', // los enlaces de recuperación llegan con ?code=...
    detectSessionInUrl: true,
    persistSession: true,
  },
});
