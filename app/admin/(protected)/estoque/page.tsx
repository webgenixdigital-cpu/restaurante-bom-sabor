'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CategoriaId, ItemEstoque } from '@/lib/types';

const NOMES: Record<CategoriaId, string> = {
  tamanho: 'Tamanhos', arroz: 'Arroz', feijao: 'Feijão',
  guarnicao: 'Guarnições', salada: 'Saladas', carne: 'Carnes', extra: 'Adicionais',
};
const ORDEM: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra'];

export default function EstoquePage() {
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [disponiveis, setDisponiveis] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function carregar() {
      const { data: todosItens } = await supabase.from('itens_estoque').select('*').order('ordem');
      const { data: disp } = await supabase.from('disponibilidade_dia').select('*').eq('data', hoje);

      setItens(todosItens || []);
      const mapa: Record<string, boolean> = {};
      (disp || []).forEach((d) => { mapa[d.item_id] = d.disponivel; });
      setDisponiveis(mapa);
    }
    carregar();
  }, [supabase, hoje]);

  async function alternar(item: ItemEstoque) {
    const novoValor = !disponiveis[item.id];
    setDisponiveis((prev) => ({ ...prev, [item.id]: novoValor }));
    setSalvando(true);
    await supabase.from('disponibilidade_dia').upsert(
      { item_id: item.id, data: hoje, disponivel: novoValor },
      { onConflict: 'item_id,data' }
    );
    setSalvando(false);
  }

  const porCategoria = useMemo(() => {
    const agrupado: Record<string, ItemEstoque[]> = {};
    itens.forEach((i) => { agrupado[i.categoria_id] = agrupado[i.categoria_id] || []; agrupado[i.categoria_id].push(i); });
    return agrupado;
  }, [itens]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-green-dark">Cardápio de hoje ({hoje.split('-').reverse().join('/')})</h1>
        {salvando && <span className="text-xs text-ink/40">salvando…</span>}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-red-800">
          <b>Lembrete:</b> essa alteração ainda não é replicada automaticamente no iFood.
          Depois de ajustar aqui, atualize também por lá.
        </p>
        <a
          href="https://portal.ifood.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl whitespace-nowrap flex-shrink-0"
        >
          🛵 Abrir iFood
        </a>
      </div>

      {ORDEM.map((cat) => (
        <div key={cat} className="bg-white rounded-2xl shadow p-4 mb-4">
          <h2 className="font-bold text-sm text-orange-dark mb-3 uppercase tracking-wide">{NOMES[cat]}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(porCategoria[cat] || []).map((item) => {
              const ativo = disponiveis[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => alternar(item)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm text-left transition ${
                    ativo ? 'border-green bg-cream-2 text-ink' : 'border-ink/10 bg-ink/5 text-ink/40'
                  }`}
                >
                  <span className="font-semibold">{item.emoji} {item.nome}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ml-2 ${ativo ? 'bg-green border-green' : 'border-ink/20'}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-ink/40 mt-2">
        Itens desmarcados somem do cardápio público automaticamente — sem precisar editar código nem redeploy.
      </p>
    </div>
  );
}
