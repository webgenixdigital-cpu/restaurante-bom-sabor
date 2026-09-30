'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Categoria, ItemEstoque } from '@/lib/types';

type CamposItem = { nome: string; emoji: string; preco: string };
const VAZIO: CamposItem = { nome: '', emoji: '', preco: '' };

// ---------- helper de chamadas à API ----------
async function api(url: string, method: string, body?: unknown) {
  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `Erro ${resp.status}`);
  return data;
}

export default function GerenciarCardapioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novaCatNome, setNovaCatNome] = useState('');
  const [novaCatPreco, setNovaCatPreco] = useState(true);
  const [catEditando, setCatEditando] = useState<string | null>(null);
  const [catNomeEdit, setCatNomeEdit] = useState('');
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [itemEdit, setItemEdit] = useState<CamposItem>(VAZIO);
  const [novoItem, setNovoItem] = useState<Record<string, CamposItem>>({});

  // ---------- carregamento ----------
  async function carregar() {
    try {
      const cats = await api('/api/admin/categorias', 'GET');
      const { data, error } = await supabase
        .from('itens_estoque').select('*').eq('ativo_cadastro', true).order('ordem');
      if (error) throw new Error(error.message);
      setCategorias(cats);
      setItens(data || []);
      setErro(null);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    try { await acao(); await carregar(); }
    catch (e: any) { alert(e.message); }
    finally { setOcupado(false); }
  }

  const porCategoria = useMemo(() => {
    const g: Record<string, ItemEstoque[]> = {};
    itens.forEach((i) => { (g[i.categoria_id] ||= []).push(i); });
    Object.keys(g).forEach((c) => {
      if (c !== 'tamanho') g[c].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    return g;
  }, [itens]);

  // ---------- ações de categoria ----------
  function criarCategoria() {
    executar(async () => {
      await api('/api/admin/categorias', 'POST', { nome: novaCatNome, tem_preco: novaCatPreco });
      setNovaCatNome('');
    });
  }

  function salvarNomeCategoria(cat: Categoria) {
    executar(async () => {
      await api(`/api/admin/categorias/${cat.id}`, 'PATCH', { nome: catNomeEdit });
      setCatEditando(null);
    });
  }

  function moverCategoria(idx: number, dir: -1 | 1) {
    const a = categorias[idx];
    const b = categorias[idx + dir];
    if (!b) return;
    executar(async () => {
      await api(`/api/admin/categorias/${a.id}`, 'PATCH', { ordem: b.ordem });
      await api(`/api/admin/categorias/${b.id}`, 'PATCH', { ordem: a.ordem });
    });
  }

  function alternarPrecoCategoria(cat: Categoria) {
    executar(() => api(`/api/admin/categorias/${cat.id}`, 'PATCH', { tem_preco: !cat.tem_preco }));
  }

  function excluirCategoria(cat: Categoria) {
    if (!confirm(`Excluir a categoria "${cat.nome}" e todos os itens dela?`)) return;
    executar(async () => {
      const r = await api(`/api/admin/categorias/${cat.id}`, 'DELETE');
      if (r.modo === 'oculta') alert('A categoria tinha itens em pedidos antigos, então foi ocultada (o histórico foi mantido).');
    });
  }

  // ---------- ações de item ----------
  function criarItem(cat: Categoria) {
    const n = novoItem[cat.id] || VAZIO;
    executar(async () => {
      await api('/api/admin/itens', 'POST', {
        categoria_id: cat.id, nome: n.nome, emoji: n.emoji, preco: cat.tem_preco ? n.preco || 0 : 0,
      });
      setNovoItem((p) => ({ ...p, [cat.id]: VAZIO }));
    });
  }

  function iniciarEdicaoItem(item: ItemEstoque) {
    setItemEditando(item.id);
    setItemEdit({ nome: item.nome, emoji: item.emoji || '', preco: item.preco.toFixed(2) });
  }

  function salvarItem(item: ItemEstoque, cat: Categoria) {
    executar(async () => {
      await api(`/api/admin/itens/${item.id}`, 'PATCH', {
        nome: itemEdit.nome, emoji: itemEdit.emoji, ...(cat.tem_preco ? { preco: itemEdit.preco } : {}),
      });
      setItemEditando(null);
    });
  }

  function alternarVeg(item: ItemEstoque) {
    executar(() => api(`/api/admin/itens/${item.id}`, 'PATCH', { vegetariano: !item.vegetariano }));
  }

  function excluirItem(item: ItemEstoque) {
    if (!confirm(`Excluir "${item.nome}"?`)) return;
    executar(async () => {
      const r = await api(`/api/admin/itens/${item.id}`, 'DELETE');
      if (r.modo === 'oculto') alert('Este item já apareceu em pedidos, então foi ocultado (o histórico foi mantido).');
    });
  }

  // ---------- tela ----------
  const btn = 'text-xs px-2 py-1 rounded-lg border border-ink/10 hover:bg-ink/5 disabled:opacity-30';
  const input = 'border rounded-lg px-2 py-1.5 text-sm bg-white text-ink';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-green-dark">Gerenciar cardápio</h1>
        {ocupado && <span className="text-xs text-ink/40">salvando…</span>}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-5 text-sm text-blue-800">
        Aqui você cadastra, edita e exclui categorias e itens. Para ligar ou desligar o que tem <b>hoje</b>,
        use <b>Cardápio do dia</b>. Categorias com 🔒 fazem parte da montagem da marmita: podem ser
        renomeadas, mas não excluídas.
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-5 text-sm text-red-800">
          Erro ao carregar: {erro}
        </div>
      )}

      {carregando ? (
        <p className="text-ink/50 text-sm">Carregando…</p>
      ) : (
        categorias.map((cat, idx) => {
          const lista = porCategoria[cat.id] || [];
          const novo = novoItem[cat.id] || VAZIO;
          return (
            <div key={cat.id} className="bg-white rounded-2xl shadow p-4 mb-4">
              {/* cabeçalho da categoria */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                {catEditando === cat.id ? (
                  <div className="flex gap-2 flex-1">
                    <input className={`${input} flex-1`} value={catNomeEdit} onChange={(e) => setCatNomeEdit(e.target.value)} />
                    <button className="bg-green text-white text-xs font-bold px-3 rounded-lg" onClick={() => salvarNomeCategoria(cat)}>Salvar</button>
                    <button className={btn} onClick={() => setCatEditando(null)}>Cancelar</button>
                  </div>
                ) : (
                  <h2 className="font-bold text-sm text-orange-dark uppercase tracking-wide">
                    {cat.sistema && '🔒 '}{cat.nome} <span className="text-ink/30 normal-case">({lista.length})</span>
                  </h2>
                )}
                {catEditando !== cat.id && (
                  <div className="flex gap-1">
                    <button className={btn} disabled={idx === 0 || ocupado} onClick={() => moverCategoria(idx, -1)} title="Subir">↑</button>
                    <button className={btn} disabled={idx === categorias.length - 1 || ocupado} onClick={() => moverCategoria(idx, 1)} title="Descer">↓</button>
                    <button className={btn} onClick={() => { setCatEditando(cat.id); setCatNomeEdit(cat.nome); }} title="Renomear">✏️</button>
                    {!cat.sistema && <button className={btn} onClick={() => excluirCategoria(cat)} title="Excluir">🗑️</button>}
                  </div>
                )}
              </div>

              {!cat.sistema && (
                <label className="flex items-center gap-2 text-xs text-ink/60 mb-3">
                  <input type="checkbox" checked={cat.tem_preco} onChange={() => alternarPrecoCategoria(cat)} />
                  Itens desta categoria têm preço
                </label>
              )}

              {/* itens */}
              <div className="flex flex-col gap-1.5">
                {lista.map((item) =>
                  itemEditando === item.id ? (
                    <div key={item.id} className="flex flex-wrap gap-2 p-2 rounded-xl bg-cream-2">
                      <input className={`${input} w-12 text-center`} value={itemEdit.emoji} onChange={(e) => setItemEdit((p) => ({ ...p, emoji: e.target.value }))} placeholder="🍝" />
                      <input className={`${input} flex-1 min-w-[140px]`} value={itemEdit.nome} onChange={(e) => setItemEdit((p) => ({ ...p, nome: e.target.value }))} />
                      {cat.tem_preco && (
                        <input className={`${input} w-20`} inputMode="decimal" value={itemEdit.preco} onChange={(e) => setItemEdit((p) => ({ ...p, preco: e.target.value }))} />
                      )}
                      <button className="bg-green text-white text-xs font-bold px-3 rounded-lg" onClick={() => salvarItem(item, cat)}>Salvar</button>
                      <button className={btn} onClick={() => setItemEditando(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream text-sm">
                      <button
                        onClick={() => alternarVeg(item)}
                        title="Vegetariano"
                        className={`w-6 h-6 rounded-full text-xs flex-shrink-0 ${item.vegetariano ? 'bg-green text-white' : 'bg-white border border-ink/10 opacity-40'}`}
                      >🌱</button>
                      <span className="flex-1 font-semibold">{item.emoji} {item.nome}</span>
                      {cat.tem_preco && <span className="text-green-dark font-bold text-xs">R$ {item.preco.toFixed(2)}</span>}
                      <button className={btn} onClick={() => iniciarEdicaoItem(item)} title="Editar">✏️</button>
                      <button className={btn} onClick={() => excluirItem(item)} title="Excluir">🗑️</button>
                    </div>
                  )
                )}
                {lista.length === 0 && <p className="text-xs text-ink/40">Nenhum item nesta categoria.</p>}
              </div>

              {/* adicionar item */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dashed border-ink/10">
                <input className={`${input} w-12 text-center`} value={novo.emoji} onChange={(e) => setNovoItem((p) => ({ ...p, [cat.id]: { ...novo, emoji: e.target.value } }))} placeholder="🍽️" />
                <input
                  className={`${input} flex-1 min-w-[140px]`}
                  value={novo.nome}
                  onChange={(e) => setNovoItem((p) => ({ ...p, [cat.id]: { ...novo, nome: e.target.value } }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && novo.nome.trim().length >= 2) criarItem(cat); }}
                  placeholder="Novo item…"
                />
                {cat.tem_preco && (
                  <input className={`${input} w-20`} inputMode="decimal" value={novo.preco} onChange={(e) => setNovoItem((p) => ({ ...p, [cat.id]: { ...novo, preco: e.target.value } }))} placeholder="0,00" />
                )}
                <button
                  className="bg-orange text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
                  disabled={novo.nome.trim().length < 2 || ocupado}
                  onClick={() => criarItem(cat)}
                >+ Adicionar</button>
              </div>
            </div>
          );
        })
      )}

      {/* nova categoria */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 border-2 border-dashed border-orange/30">
        <h2 className="font-bold text-sm text-orange-dark uppercase tracking-wide mb-3">Nova categoria</h2>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} flex-1 min-w-[180px]`} value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Ex.: Porções, Salgados…" />
          <button
            className="bg-green text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            disabled={novaCatNome.trim().length < 2 || ocupado}
            onClick={criarCategoria}
          >Criar categoria</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink/60 mt-2">
          <input type="checkbox" checked={novaCatPreco} onChange={(e) => setNovaCatPreco(e.target.checked)} />
          Itens desta categoria têm preço
        </label>
      </div>
    </div>
  );
}