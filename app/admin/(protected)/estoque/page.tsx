'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CategoriaId, ItemEstoque } from '@/lib/types';

const NOMES: Record<CategoriaId, string> = {
  tamanho: 'Tamanhos', arroz: 'Arroz', feijao: 'Feijão',
  guarnicao: 'Guarnições', salada: 'Saladas', carne: 'Carnes', extra: 'Adicionais',
  massa: 'Massas (pedido avulso)', congelados: 'Congelados (pedido avulso)',
};
const ORDEM: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra', 'massa', 'congelados'];

export default function EstoquePage() {
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [disponiveis, setDisponiveis] = useState<Record<string, boolean>>({});
  const [precosEditando, setPrecosEditando] = useState<Record<string, string>>({});
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

  async function alternarVegetariano(item: ItemEstoque) {
    const novoValor = !item.vegetariano;
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, vegetariano: novoValor } : i)));
    setSalvando(true);
    await supabase.from('itens_estoque').update({ vegetariano: novoValor }).eq('id', item.id);
    setSalvando(false);
  }

  async function salvarPreco(item: ItemEstoque) {
    const bruto = precosEditando[item.id];
    if (bruto === undefined) return;
    const novoPreco = parseFloat(bruto.replace(',', '.'));
    if (isNaN(novoPreco) || novoPreco < 0) return;
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, preco: novoPreco } : i)));
    setSalvando(true);
    await supabase.from('itens_estoque').update({ preco: novoPreco }).eq('id', item.id);
    setSalvando(false);
    setPrecosEditando((prev) => { const c = { ...prev }; delete c[item.id]; return c; });
  }

  const porCategoria = useMemo(() => {
    const agrupado: Record<string, ItemEstoque[]> = {};
    itens.forEach((i) => { agrupado[i.categoria_id] = agrupado[i.categoria_id] || []; agrupado[i.categoria_id].push(i); });
    // ordem alfabética em tudo, exceto tamanho (mantém a ordem crescente de porte/preço)
    Object.keys(agrupado).forEach((cat) => {
      if (cat !== 'tamanho') agrupado[cat].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
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

      <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 text-sm text-green-800">
        🌱 Clique no ícone de folha pra marcar como vegetariano. Clique no campo de preço pra editar o valor de cada item
        (essencial pras Massas e Congelados, que não têm preço embutido em um "tamanho").
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-5 text-sm text-blue-800">
        📏 Os <b>Tamanhos</b> ficam sempre disponíveis no cardápio — não precisam ser ativados dia a dia. Só o preço é editável.
      </div>

      {ORDEM.map((cat) => {
        const itensCategoria = porCategoria[cat] || [];
        if (itensCategoria.length === 0) return null;
        const semAtivacaoDiaria = cat === 'tamanho';
        return (
          <div key={cat} className="bg-white rounded-2xl shadow p-4 mb-4">
            <h2 className="font-bold text-sm text-orange-dark mb-3 uppercase tracking-wide">{NOMES[cat]}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {itensCategoria.map((item) => {
                const ativo = semAtivacaoDiaria ? true : disponiveis[item.id];
                const precoEditando = precosEditando[item.id];
                return (
                  <div
                    key={item.id}
                    className={`relative rounded-xl border-2 text-sm transition ${
                      ativo ? 'border-green bg-cream-2 text-ink' : 'border-ink/10 bg-ink/5 text-ink/40'
                    }`}
                  >
                    {semAtivacaoDiaria ? (
                      <div className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                        <span className="font-semibold pl-4">{item.emoji} {item.nome}</span>
                        <span className="text-[10px] font-bold text-green-dark uppercase whitespace-nowrap">Sempre ativo</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => alternar(item)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="font-semibold pl-4">{item.emoji} {item.nome}</span>
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ml-2 ${ativo ? 'bg-green border-green' : 'border-ink/20'}`} />
                      </button>
                    )}

                    <div className="flex items-center gap-1 px-3 pb-2 -mt-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={precoEditando !== undefined ? precoEditando : item.preco.toFixed(2)}
                        onChange={(e) => setPrecosEditando((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => salvarPreco(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 text-xs border rounded px-1.5 py-0.5 bg-white text-ink"
                      />
                    </div>

                    <span
                      onClick={() => alternarVegetariano(item)}
                      title="Marcar como vegetariano"
                      className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow cursor-pointer ${
                        item.vegetariano ? 'bg-green text-white' : 'bg-white text-ink/30 border border-ink/10'
                      }`}
                    >
                      🌱
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-ink/40 mt-2">
        Itens desmarcados somem do cardápio público automaticamente — sem precisar editar código nem redeploy.
      </p>
    </div>
  );
}