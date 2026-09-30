import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';

// Cria item dentro de uma categoria
export async function POST(req: Request) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const nome = String(body.nome || '').trim();
  const categoria_id = String(body.categoria_id || '');
  const preco = Number(String(body.preco ?? 0).replace(',', '.'));

  if (nome.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 });
  if (isNaN(preco) || preco < 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: cat } = await supabase
    .from('categorias').select('id').eq('id', categoria_id).eq('ativo', true).single();
  if (!cat) return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 });

  const { data: ultimos } = await supabase
    .from('itens_estoque').select('ordem').eq('categoria_id', categoria_id)
    .order('ordem', { ascending: false }).limit(1);
  const ordem = (ultimos?.[0]?.ordem ?? 0) + 1;

  const { data, error } = await supabase
    .from('itens_estoque')
    .insert({
      categoria_id, nome, preco, ordem,
      emoji: body.emoji?.trim() || null,
      vegetariano: !!body.vegetariano,
      ativo_cadastro: true,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}