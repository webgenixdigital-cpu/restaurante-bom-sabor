'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Categoria, ItemEstoque } from '@/lib/types';
import { infoDia } from '@/lib/calendario';

// Ordem igual à do cardápio online: a massa é perguntada logo após o tamanho.
// Numeração fixa, para combinar com o modelo de pedido enviado aos clientes.
const ORDEM_TEXTO = ['tamanho', 'massa', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra', 'bebida', 'sobremesa'];
const DICA_TEXTO: Record<string, string> = {
  tamanho: ' _(obrigatório)_',
  massa: ' _(opcional)_',
  guarnicao: ' _(até 3)_',
  extra: ' _(opcional)_',
  bebida: ' _(opcional)_',
  sobremesa: ' _(opcional)_',
};
export default function EstoquePage() {
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [disponiveis, setDisponiveis] = useState<Record<string, boolean>>({});
  const [precosEditando, setPrecosEditando] = useState<Record<string, string>>({});
    const [salvando, setSalvando] = useState(false);
  const [copiadoCardapio, setCopiadoCardapio] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function carregar() {
      const resp = await fetch('/api/admin/categorias');
if (resp.ok) setCategorias(await resp.json());
      const { data: todosItens } = await supabase.from('itens_estoque').select('*').eq('ativo_cadastro', true).order('ordem');
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
      function gerarTextoCardapio(): string {
    const dataFormatada = hoje.split('-').reverse().join('/');
    const ehFeijoada = (i: ItemEstoque) => i.nome.toLowerCase().includes('feijoada');
    const dia = infoDia(); // sábado, domingo e feriado = dia especial
    const LINK = 'https://cantina-bom-sabor.genixcatalog.app.br';

    // tamanhos sempre ativos; demais itens só se ligados hoje; feijoada fica fora da lista de feijões
    const ativos = (catId: string) =>
      (porCategoria[catId] || []).filter(
        (item) => (catId === 'tamanho' || disponiveis[item.id]) && !(catId === 'feijao' && ehFeijoada(item))
      );
    const feijoadas = dia.diaSemana === 6
      ? (porCategoria.feijao || []).filter((i) => disponiveis[i.id] && ehFeijoada(i))
      : [];

    const linhaItem = (item: ItemEstoque) => {
      const preco = item.preco > 0 ? ` — R$ ${item.preco.toFixed(2).replace('.', ',')}` : '';
      const veg = item.vegetariano ? ' 🌱' : '';
      return `${item.emoji || '•'} ${item.nome}${preco}${veg}`;
    };

    const linhas: string[] = [`*🍱 Cardápio de hoje — Cantina Bom Sabor*`, `_${dataFormatada}_`, ''];

    if (dia.especial) {
      linhas.push(`📲 *${dia.feriado ? `Hoje é feriado (${dia.feriado})` : 'Hoje é fim de semana'}: pedidos somente pelo site!*`);
      linhas.push(`👉 ${LINK}`);
      linhas.push('_Hoje não recebemos pedidos pelo WhatsApp._');
    } else {
      linhas.push('📝 *Como pedir:* pelo site ou aqui pelo WhatsApp, seguindo a numeração abaixo, na mesma ordem (1, 2, 3…). Se não quiser algum item, é só deixar em branco ou escrever *"sem"*.');
    }
    linhas.push('');

    // categorias do fluxo, com numeração fixa
    ORDEM_TEXTO.forEach((id, idx) => {
      const cat = categorias.find((c) => c.id === id);
      if (!cat) return;
      const itens = ativos(id);
      linhas.push(`*${idx + 1}. ${cat.nome.toUpperCase()}*${DICA_TEXTO[id] ?? ''}`);
      if (itens.length === 0) linhas.push('_sem opções hoje_');
      else itens.forEach((item) => linhas.push(linhaItem(item)));
      linhas.push('');

      if (id === 'tamanho' && feijoadas.length > 0) {
        linhas.push(`⭐ *Especial de sábado:* ${feijoadas.map((f) => f.nome).join(' / ')}, já com todos os acompanhamentos.`);
        linhas.push('');
      }
    });

    // categorias criadas pelo restaurante continuam a numeração (só se tiverem itens hoje)
    let n = ORDEM_TEXTO.length;
    categorias
      .filter((c) => !ORDEM_TEXTO.includes(c.id))
      .forEach((cat) => {
        const itens = ativos(cat.id);
        if (itens.length === 0) return;
        n += 1;
        linhas.push(`*${n}. ${cat.nome.toUpperCase()}* _(opcional)_`);
        itens.forEach((item) => linhas.push(linhaItem(item)));
        linhas.push('');
      });

    linhas.push('📌 Pedir os itens separados em potes individuais tem acréscimo a partir de R$ 2,00 (embalagem).');
    linhas.push(
      dia.especial
        ? '🛵 Taxa de entrega conforme o bairro, calculada automaticamente no site.'
        : '🛵 Taxa de entrega conforme o bairro. De segunda a sexta, entrega grátis no Centro e no Jardim dos Estados.'
    );
    linhas.push('');
    linhas.push(dia.especial ? `👉 Faça seu pedido pelo site: ${LINK}` : `👉 Prefere montar sozinho? Peça pelo cardápio online: ${LINK}`);

    return linhas.join('\n');
  }

  async function copiarCardapio() {
    const texto = gerarTextoCardapio();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoCardapio(true);
      setTimeout(() => setCopiadoCardapio(false), 2500);
    } catch {
      alert('Não foi possível copiar automaticamente. Tente novamente.');
    }
  }

  function enviarCardapioWhatsApp() {
    const texto = encodeURIComponent(gerarTextoCardapio());
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }
  const porCategoria = useMemo(() => {
    const agrupado: Record<string, ItemEstoque[]> = {};
    itens.forEach((i) => { agrupado[i.categoria_id] = agrupado[i.categoria_id] || []; agrupado[i.categoria_id].push(i); });
    Object.keys(agrupado).forEach((cat) => {
      if (cat !== 'tamanho') agrupado[cat].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    return agrupado;
  }, [itens]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-green-dark">Cardápio de hoje ({hoje.split('-').reverse().join('/')})</h1>
        {salvando && <span className="text-xs text-ink/40">salvando…</span>}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-red-800">
          <b>Lembrete:</b> essa alteração ainda não é replicada automaticamente no iFood.
          Depois de ajustar aqui, atualize também por lá.
        </p>
        <a
          href="https://portal.ifood.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl whitespace-nowrap flex-shrink-0 text-center"
        >
          🛵 Abrir iFood
        </a>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 text-sm text-green-800">
        🌱 Clique no ícone de folha pra marcar como vegetariano. O campo de preço aparece só nas categorias com preço (configuradas em Gerenciar cardápio).
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-5 text-sm text-blue-800">
        📏 Os <b>Tamanhos</b> ficam sempre disponíveis no cardápio — não precisam ser ativados dia a dia. Só o preço é editável.
      </div>

      {categorias.map((c) => {
  const cat = c.id;
        const itensCategoria = porCategoria[cat] || [];
        if (itensCategoria.length === 0) return null;
        const semAtivacaoDiaria = cat === 'tamanho';
        const temPreco = c.tem_preco;
        return (
          <div key={cat} className="bg-white rounded-2xl shadow p-4 mb-4">
            <h2 className="font-bold text-sm text-orange-dark mb-3 uppercase tracking-wide">{c.nome}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
                      <div className="w-full flex items-center justify-between px-3 py-2.5 text-left gap-2">
                        <span className="font-semibold pl-4">{item.emoji} {item.nome}</span>
                        <span className="text-[10px] font-bold text-green-dark uppercase whitespace-nowrap flex-shrink-0">Sempre ativo</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => alternar(item)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left gap-2"
                      >
                        <span className="font-semibold pl-4">{item.emoji} {item.nome}</span>
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${ativo ? 'bg-green border-green' : 'border-ink/20'}`} />
                      </button>
                    )}

                    {temPreco && (
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
                    )}

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

            <div className="bg-white rounded-2xl shadow p-4 mt-4 flex flex-col sm:flex-row gap-2">
        <button
          onClick={copiarCardapio}
          className={`flex-1 font-bold px-4 py-3 rounded-xl text-white transition ${copiadoCardapio ? 'bg-green-dark' : 'bg-green'}`}
        >
          {copiadoCardapio ? 'Copiado! ✓' : '📋 Copiar cardápio do dia (texto)'}
        </button>
        <button
          onClick={enviarCardapioWhatsApp}
          className="flex-1 bg-[#25D366] hover:brightness-95 text-white font-bold px-4 py-3 rounded-xl transition"
        >
          📲 Enviar por WhatsApp
        </button>
      </div>

      <p className="text-xs text-ink/40 mt-2">
        Itens desmarcados somem do cardápio público automaticamente — sem precisar editar código nem redeploy.
      </p>
    </div>
  );
}