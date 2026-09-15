import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ATENÇÃO: use este cliente SOMENTE em código que roda no servidor
// (Route Handlers, Server Actions). A service role key ignora RLS —
// nunca importe este arquivo em um Client Component ('use client').
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}