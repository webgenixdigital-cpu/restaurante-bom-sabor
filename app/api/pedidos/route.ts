import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NovoPedidoPayload } from '@/lib/types';

export async function POST(req: Request) {
  const supabase = createAdminClient();
  const body: NovoPedidoPayload = await req.json();

  const temMarmitas = body.marmitas?.length > 0;
  const temAvulsos = (body.itensAvulsos?.length || 0) > 0;

  if (!body.nome_cliente || !body.modo || (!temMarmitas && !temAvulsos)) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  // 1. cria o pedido
  const { data: pedido, error: erroPedido } = await supabase
    .from('pedidos')
    .insert({
      nome_cliente: body.nome_cliente,
      modo: body.modo,
      endereco: body.endereco || null,
      forma_pagamento: body.forma_pagamento,
      total: body.total,
      origem: 'site',
    })
    .select()
    .single();

  if (erroPedido || !pedido) {
    return NextResponse.json({ error: erroPedido?.message || 'Erro ao criar pedido' }, { status: 500 });
  }

  // 2a. cria cada marmita + suas guarnições + carnes extras
  for (const marmita of body.marmitas || []) {
    const { data: marmitaSalva, error: erroMarmita } = await supabase
      .from('pedido_marmitas')
      .insert({
        pedido_id: pedido.id,
        numero: marmita.numero,
        tamanho_id: marmita.tamanho?.id || null,
        arroz_id: marmita.arroz?.id || null,
        feijao_id: marmita.feijao?.id || null,
        salada_id: marmita.salada?.id || null,
        carne_id: marmita.carne?.id || null,
        extra_id: marmita.extra?.tipo?.id || null,
      })
      .select()
      .single();

    if (erroMarmita || !marmitaSalva) continue;

    if (marmita.guarnicoes?.length) {
      await supabase.from('pedido_marmita_guarnicoes').insert(
        marmita.guarnicoes.map((g) => ({ pedido_marmita_id: marmitaSalva.id, item_id: g.id }))
      );
    }

    if (marmita.extra?.escolhas?.length) {
      await supabase.from('pedido_marmita_extra_carnes').insert(
        marmita.extra.escolhas.map((e) => ({
          pedido_marmita_id: marmitaSalva.id,
          carne_id: e.carne.id,
          quantidade: e.quantidade,
        }))
      );
    }
  }

  // 2b. cria os itens avulsos (massas/congelados), se houver
  if (temAvulsos) {
    await supabase.from('pedido_itens_avulsos').insert(
      body.itensAvulsos!.map((e) => ({
        pedido_id: pedido.id,
        item_id: e.item.id,
        quantidade: e.quantidade,
      }))
    );
  }

  return NextResponse.json({ codigo: pedido.codigo, id: pedido.id });
}