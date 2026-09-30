import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';

type Ctx = { params: { id: string } };

// Editar nome, emoji, preço, vegetariano, ordem
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (nome.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 });
    update.nome = nome;
  }
  if (body.emoji !== undefined) update.emoji = String(body.emoji).trim() || null;
  if (body.vegetariano !== undefined) update.vegetariano = !!body.vegetariano;
  if (body.ordem !== undefined) update.ordem = Number(body.ordem);
  if (body.preco !== undefined) {
    const preco = Number(String(body.preco).replace(',', '.'));
    if (isNaN(preco) || preco < 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });
    update.preco = preco;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('itens_estoque').update(update).eq('id', params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Exclui item; se já apareceu em pedido, apenas oculta
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('itens_estoque').delete().eq('id', params.id);

  if (error?.code === '23503') {
    await supabase.from('itens_estoque').update({ ativo_cadastro: false }).eq('id', params.id);
    await supabase.from('disponibilidade_dia').update({ disponivel: false }).eq('item_id', params.id);
    return NextResponse.json({ modo: 'oculto' });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modo: 'excluido' });
}