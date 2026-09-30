import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';

type Ctx = { params: { id: string } };

// Renomear, reordenar, ligar/desligar preço
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (nome.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 });
    update.nome = nome;
  }
  if (body.ordem !== undefined) update.ordem = Number(body.ordem);
  if (body.tem_preco !== undefined) update.tem_preco = !!body.tem_preco;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('categorias').update(update).eq('id', params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Exclui categoria criada pelo restaurante.
// Se algum item já foi usado em pedido, oculta em vez de apagar.
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: cat } = await supabase
    .from('categorias').select('id, sistema').eq('id', params.id).single();

  if (!cat) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
  if (cat.sistema) {
    return NextResponse.json(
      { error: 'Esta categoria faz parte da montagem do pedido e não pode ser excluída. Você pode renomeá-la.' },
      { status: 400 }
    );
  }

  const { error: erroItens } = await supabase
    .from('itens_estoque').delete().eq('categoria_id', params.id);

  if (erroItens?.code === '23503') {
    const { data: itens } = await supabase
      .from('itens_estoque').select('id').eq('categoria_id', params.id);
    const ids = (itens || []).map((i) => i.id);

    await supabase.from('itens_estoque').update({ ativo_cadastro: false }).in('id', ids);
    await supabase.from('disponibilidade_dia').update({ disponivel: false }).in('item_id', ids);
    await supabase.from('categorias').update({ ativo: false }).eq('id', params.id);
    return NextResponse.json({ modo: 'oculta' });
  }
  if (erroItens) return NextResponse.json({ error: erroItens.message }, { status: 500 });

  const { error } = await supabase.from('categorias').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modo: 'excluida' });
}