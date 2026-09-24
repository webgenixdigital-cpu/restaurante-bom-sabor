'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ImprimirClient({
  pedido, marmitas, itensAvulsos,
}: { pedido: any; marmitas: any[]; itensAvulsos: any[] }) {
  useEffect(() => {
    const supabase = createClient();
    supabase.from('pedidos').update({ impresso: true }).eq('id', pedido.id).then(() => {
      setTimeout(() => window.print(), 300);
    });
  }, [pedido.id]);

  const isEntrega = pedido.modo === 'entrega';
  const taxaDefinida = pedido.taxa_entrega != null;
  const subtotal = Number(pedido.total);
  const taxa = Number(pedido.taxa_entrega || 0);

  return (
    <div className="max-w-xs mx-auto p-4 font-mono text-[20px] leading-snug font-semibold tracking-tight">
      <div className="text-center mb-2">
        <div className="text-lg font-extrabold">CANTINA BOM SABOR</div>
        <div className="text-sm font-bold">Pedido #{pedido.codigo}</div>
        <div className="text-xs">{new Date(pedido.created_at).toLocaleString('pt-BR')}</div>
      </div>
      <div className="border-t-2 border-black my-2" />

      <div>Cliente: {pedido.nome_cliente}</div>
      <div>{isEntrega ? `Entrega: ${pedido.endereco}` : 'RETIRADA NO LOCAL'}</div>
            <div>Pagamento: {pedido.forma_pagamento}</div>
      {pedido.observacoes && <div>Obs: {pedido.observacoes}</div>}

      <div className="border-t-2 border-black my-2" />

      {marmitas.map((m: any) => (
        <div key={m.numero} className="mb-2">
          <div className="font-extrabold">Marmita {m.numero} — {m.tamanho?.nome}</div>
          {m.arroz?.nome && <div>Arroz: {m.arroz.nome}</div>}
          {m.feijao?.nome && <div>Feijão: {m.feijao.nome}</div>}
          {m.pedido_marmita_guarnicoes?.length > 0 && (
            <div>Guarn.: {m.pedido_marmita_guarnicoes.map((g: any) => g.itens_estoque?.nome).join(', ')}</div>
          )}
          {m.salada?.nome && <div>Salada: {m.salada.nome}</div>}
          {m.carne?.nome && <div>Carne: {m.carne.nome}</div>}
          {m.extra?.nome && m.pedido_marmita_extra_carnes?.length > 0 && (
            <div>
              + {m.extra.nome}:
              {m.pedido_marmita_extra_carnes.map((e: any, i: number) => (
                <span key={i}> {e.quantidade}x {e.itens_estoque?.nome}{i < m.pedido_marmita_extra_carnes.length - 1 ? ',' : ''}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {itensAvulsos.map((it: any, i: number) => (
        <div key={i} className="font-extrabold">
          {it.quantidade}x {it.itens_estoque?.nome}
        </div>
      ))}

      <div className="border-t-2 border-black my-2" />

      {isEntrega ? (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa de entrega</span>
            <span>{taxaDefinida ? `R$ ${taxa.toFixed(2)}` : 'R$ ________'}</span>
          </div>
          <div className="flex justify-between font-extrabold text-lg mt-1">
            <span>TOTAL</span>
            <span>{taxaDefinida ? `R$ ${(subtotal + taxa).toFixed(2)}` : 'R$ ________'}</span>
          </div>
        </>
      ) : (
        <div className="flex justify-between font-extrabold text-lg">
          <span>TOTAL</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
      )}

      <div className="border-t-2 border-black my-2" />
      <div className="text-center text-sm mt-3 font-bold">Obrigado pela preferência 😉</div>

      <button onClick={() => window.print()} className="no-print w-full mt-4 bg-ink text-white py-2 rounded-lg font-bold">
        Imprimir de novo
      </button>
    </div>
  );
}