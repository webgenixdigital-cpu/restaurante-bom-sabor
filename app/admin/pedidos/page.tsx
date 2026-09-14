'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Pedido } from '@/lib/types';

const STATUS_LABEL: Record<Pedido['status'], string> = {
  novo: 'Novo', preparando: 'Preparando', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado',
};
const STATUS_COR: Record<Pedido['status'], string> = {
  novo: 'bg-orange text-white', preparando: 'bg-amber-500 text-white',
  pronto: 'bg-green text-white', entregue: 'bg-ink/20 text-ink/60', cancelado: 'bg-red-500 text-white',
};

export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false }).limit(50);
      setPedidos(data || []);
    }
    carregar();

    const canal = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregar())
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [supabase]);

  async function mudarStatus(id: string, status: Pedido['status']) {
    await supabase.from('pedidos').update({ status }).eq('id', id);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-green-dark mb-5">Pedidos recebidos</h1>

      <div className="flex flex-col gap-3">
        {pedidos.length === 0 && <p className="text-ink/40 text-sm">Nenhum pedido ainda.</p>}
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">#{p.codigo}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                {p.origem === 'ifood' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">iFood</span>}
              </div>
              <div className="font-semibold">{p.nome_cliente}</div>
              <div className="text-sm text-ink/50">
                {p.modo === 'entrega' ? `Entrega — ${p.endereco}` : 'Retirada no restaurante'} · {p.forma_pagamento} · R$ {Number(p.total).toFixed(2)}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={p.status}
                onChange={(e) => mudarStatus(p.id, e.target.value as Pedido['status'])}
                className="text-sm border rounded-lg px-2 py-1.5"
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Link
                href={`/admin/pedidos/${p.id}/imprimir`}
                target="_blank"
                className="bg-ink text-white text-sm font-bold px-3 py-2 rounded-lg whitespace-nowrap"
              >
                🖨️ Imprimir
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
