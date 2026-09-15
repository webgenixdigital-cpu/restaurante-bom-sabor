'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ImprimirClient({ pedido, marmitas }: { pedido: any; marmitas: any[] }) {
  useEffect(() => {
    const supabase = createClient();
    supabase.from('pedidos').update({ impresso: true }).eq('id', pedido.id).then(() => {
      setTimeout(() => window.print(), 300);
    });
  }, [pedido.id]);

  return (
    <div className="max-w-xs mx-auto p-4 font-mono text-[13px] leading-tight">
      <div className="text-center mb-2">
        <div className="text-base font-bold">BOM SABOR</div>
        <div className="text-xs">Pedido #{pedido.codigo}</div>
        <div className="text-xs">{new Date(pedido.created_at).toLocaleString('pt-BR')}</div>
      </div>
      <div className="border-t border-dashed border-black my-2" />

      <div>Cliente: {pedido.nome_cliente}</div>
      <div>{pedido.modo === 'entrega' ? `Entrega: ${pedido.endereco}` : 'RETIRADA NO LOCAL'}</div>
      <div>Pagamento: {pedido.forma_pagamento}</div>

      <div className="border-t border-dashed border-black my-2" />

      {marmitas.map((m: any) => (
        <div key={m.numero} className="mb-2">
          <div className="font-bold">Marmita {m.numero} — {m.tamanho?.nome}</div>
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

      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between font-bold text-base">
        <span>TOTAL</span>
        <span>R$ {Number(pedido.total).toFixed(2)}</span>
      </div>

      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-xs mt-3">Obrigado pela preferência 😉</div>

      <button onClick={() => window.print()} className="no-print w-full mt-4 bg-ink text-white py-2 rounded-lg font-bold">
        Imprimir de novo
      </button>
    </div>
  );
}