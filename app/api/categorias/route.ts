import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Categorias ativas para o cardápio público
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome, ordem, contexto, tem_preco')
    .eq('ativo', true)
    .order('ordem');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}