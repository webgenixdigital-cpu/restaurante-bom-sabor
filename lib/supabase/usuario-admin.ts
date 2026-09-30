import { createClient } from '@/lib/supabase/server';

// Retorna o usuário logado no admin, ou null
export async function usuarioAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}