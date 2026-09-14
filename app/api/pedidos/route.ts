import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NovoPedidoPayload } from '@/lib/types';

export async function POST(req: Request) {
  const supabase = createClient();
  const body: NovoPedidoPayload = await req.json();

  if (!body.nome_cliente || !body.modo || !body.marmitas?.length) {
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

  // 2. cria cada marmita + suas guarnições
  for (const marmita of body.marmitas) {
    const { data: marmitaSalva, error: erroMarmita } = await supabase
      .from('pedido_marmitas')
      .insert({
        pedido_id: pedido.id,
        numero: marmita.numero,
        tamanho_id: marmita.tamanho.id,
        arroz_id: marmita.arroz.id,
        feijao_id: marmita.feijao.id,
        salada_id: marmita.salada.id,
        carne_id: marmita.carne.id,
        extra_id: marmita.extra?.id || null,
      })
      .select()
      .single();

    if (erroMarmita || !marmitaSalva) continue;

    if (marmita.guarnicoes?.length) {
      await supabase.from('pedido_marmita_guarnicoes').insert(
        marmita.guarnicoes.map((g) => ({ pedido_marmita_id: marmitaSalva.id, item_id: g.id }))
      );
    }
  }

  return NextResponse.json({ codigo: pedido.codigo, id: pedido.id });
}
