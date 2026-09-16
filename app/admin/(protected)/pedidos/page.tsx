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

function diaDe(dataIso: string) {
  return dataIso.slice(0, 10);
}
function formatarDia(diaIso: string) {
  const [ano, mes, dia] = diaIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<string>('todos');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [detalhes, setDetalhes] = useState<Record<string, any[]>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<Record<string, boolean>>({});

  const hojeStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false }).limit(200);
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

  async function alternarExpandir(id: string) {
    const abrindo = !expandido[id];
    setExpandido((prev) => ({ ...prev, [id]: abrindo }));
    if (abrindo && !detalhes[id]) {
      setCarregandoDetalhe((prev) => ({ ...prev, [id]: true }));
      const { data } = await supabase
        .from('pedido_marmitas')
        .select(`
          numero,
          tamanho:tamanho_id ( nome ),
          arroz:arroz_id ( nome ),
          feijao:feijao_id ( nome ),
          salada:salada_id ( nome ),
          carne:carne_id ( nome ),
          extra:extra_id ( nome ),
          pedido_marmita_guarnicoes ( itens_estoque ( nome ) ),
          pedido_marmita_extra_carnes ( quantidade, itens_estoque ( nome ) )
        `)
        .eq('pedido_id', id)
        .order('numero');
      setDetalhes((prev) => ({ ...prev, [id]: data || [] }));
      setCarregandoDetalhe((prev) => ({ ...prev, [id]: false }));
    }
  }

  // Dashboard: sempre reflete HOJE, independente do filtro da lista abaixo
  const pedidosHoje = pedidos.filter((p) => diaDe(p.created_at) === hojeStr);
  const pedidosHojeValidos = pedidosHoje.filter((p) => p.status !== 'cancelado');
  const faturamentoHoje = pedidosHojeValidos.reduce((s, p) => s + Number(p.total), 0);
  const entregasHoje = pedidosHojeValidos.filter((p) => p.modo === 'entrega').length;
  const retiradasHoje = pedidosHojeValidos.filter((p) => p.modo === 'retirada').length;

  // Dias disponíveis pra o filtro (sempre inclui hoje, mesmo sem pedidos ainda)
  const diasDisponiveis = Array.from(new Set([hojeStr, ...pedidos.map((p) => diaDe(p.created_at))])).sort((a, b) => b.localeCompare(a));

  const pedidosFiltrados = diaSelecionado === 'todos' ? pedidos : pedidos.filter((p) => diaDe(p.created_at) === diaSelecionado);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-green-dark mb-4">Pedidos</h1>

      {/* Dashboard fixo — sempre do dia de hoje */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-2xl font-extrabold text-green-dark">{pedidosHojeValidos.length}</div>
          <div className="text-xs text-ink/50 font-semibold">Pedidos hoje</div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-2xl font-extrabold text-green-dark">R$ {faturamentoHoje.toFixed(2)}</div>
          <div className="text-xs text-ink/50 font-semibold">Faturamento estimado</div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-2xl font-extrabold text-orange-dark">{entregasHoje}</div>
          <div className="text-xs text-ink/50 font-semibold">Entregas</div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-2xl font-extrabold text-orange-dark">{retiradasHoje}</div>
          <div className="text-xs text-ink/50 font-semibold">Retiradas</div>
        </div>
      </div>
      <p className="text-xs text-ink/40 -mt-4 mb-5">Faturamento não conta pedidos cancelados.</p>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-ink/60">Filtrar por dia</span>
        <select
          value={diaSelecionado}
          onChange={(e) => setDiaSelecionado(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="todos">Todos os dias</option>
          {diasDisponiveis.map((d) => (
            <option key={d} value={d}>{d === hojeStr ? `Hoje (${formatarDia(d)})` : formatarDia(d)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {pedidosFiltrados.length === 0 && <p className="text-ink/40 text-sm">Nenhum pedido neste dia.</p>}
        {pedidosFiltrados.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between gap-4">
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
                <div className="text-xs text-ink/40 mt-0.5">
                  Confirmado em {new Date(p.created_at).toLocaleString('pt-BR')}
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
                <button
                  onClick={() => alternarExpandir(p.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-ink/10 text-ink/50 hover:bg-cream transition"
                  title="Ver resumo do pedido"
                >
                  <span className={`transition-transform ${expandido[p.id] ? 'rotate-180' : ''}`}>▾</span>
                </button>
              </div>
            </div>

            {expandido[p.id] && (
              <div className="mt-3 pt-3 border-t border-dashed border-ink/10 text-sm">
                {carregandoDetalhe[p.id] && <p className="text-ink/40 text-xs">Carregando resumo…</p>}
                {!carregandoDetalhe[p.id] && (detalhes[p.id] || []).map((m: any) => {
                  const partes = [
                    m.arroz?.nome, m.feijao?.nome,
                    m.pedido_marmita_guarnicoes?.length ? m.pedido_marmita_guarnicoes.map((g: any) => g.itens_estoque?.nome).join(' / ') : null,
                    m.salada?.nome, m.carne?.nome,
                  ].filter(Boolean);
                  return (
                    <div key={m.numero} className="mb-2">
                      <div className="font-bold text-green-dark">Marmita {m.numero} — {m.tamanho?.nome}</div>
                      <div className="text-ink/60 text-xs">{partes.length ? partes.join(', ') : 'sem acompanhamentos escolhidos'}</div>
                      {m.pedido_marmita_extra_carnes?.length > 0 && (
                        <div className="text-ink/60 text-xs">
                          + {m.extra?.nome}: {m.pedido_marmita_extra_carnes.map((e: any) => `${e.quantidade}x ${e.itens_estoque?.nome}`).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!carregandoDetalhe[p.id] && (detalhes[p.id] || []).length === 0 && (
                  <p className="text-ink/40 text-xs">Sem detalhes de marmitas para este pedido.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}