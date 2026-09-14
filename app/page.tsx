'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CategoriaId, ItemEstoque, MarmitaConfig } from '@/lib/types';

const ORDEM_CATEGORIAS: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra'];
const NOMES_CATEGORIAS: Record<CategoriaId, string> = {
  tamanho: 'Escolha o tamanho', arroz: 'Escolha o arroz', feijao: 'Escolha o feijão',
  guarnicao: 'Escolha as guarnições', salada: 'Escolha a salada', carne: 'Escolha a carne',
  extra: 'Deseja adicionar carne extra?',
};
const OBRIGATORIAS: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne']; // extra é opcional
const QTD_GUARNICOES = 3;

type Etapa =
  | 'nome' | 'modo' | 'endereco' | 'quantidade' | 'modoMarmitas'
  | CategoriaId | 'pagamento' | 'resumo';

export default function CardapioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [itensPorCategoria, setItensPorCategoria] = useState<Record<string, ItemEstoque[]>>({});
  const [carregando, setCarregando] = useState(true);

  // estado do pedido
  const [nome, setNome] = useState('');
  const [modo, setModo] = useState<'retirada' | 'entrega' | null>(null);
  const [endereco, setEndereco] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [modoMarmitas, setModoMarmitas] = useState<'igual' | 'diferentes' | null>(null);
  const [pagamento, setPagamento] = useState<string | null>(null);

  const [atual, setAtual] = useState<Partial<Record<CategoriaId, ItemEstoque | ItemEstoque[]>>>({});
  const [marmitas, setMarmitas] = useState<MarmitaConfig[]>([]);
  const [indiceItem, setIndiceItem] = useState(0);

  const [etapa, setEtapa] = useState<Etapa>('nome');
  const [enviando, setEnviando] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState<number | null>(null);

  useEffect(() => {
    async function carregar() {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('itens_estoque')
        .select('*, disponibilidade_dia!inner(disponivel, data)')
        .eq('disponibilidade_dia.data', hoje)
        .eq('disponibilidade_dia.disponivel', true)
        .order('ordem');

      const agrupado: Record<string, ItemEstoque[]> = {};
      (data || []).forEach((item: any) => {
        agrupado[item.categoria_id] = agrupado[item.categoria_id] || [];
        agrupado[item.categoria_id].push(item);
      });
      setItensPorCategoria(agrupado);
      setCarregando(false);
    }
    carregar();
  }, [supabase]);

  function selecionarUnica(cat: CategoriaId, item: ItemEstoque) {
    setAtual((prev) => ({ ...prev, [cat]: item }));
  }

  function alternarMulti(cat: CategoriaId, item: ItemEstoque) {
    setAtual((prev) => {
      const lista = (prev[cat] as ItemEstoque[]) || [];
      const existe = lista.find((i) => i.id === item.id);
      let nova: ItemEstoque[];
      if (existe) nova = lista.filter((i) => i.id !== item.id);
      else if (lista.length < QTD_GUARNICOES) nova = [...lista, item];
      else return prev;
      return { ...prev, [cat]: nova };
    });
  }

  function proximaCategoria(catual: CategoriaId): Etapa {
    const idx = ORDEM_CATEGORIAS.indexOf(catual);
    return (ORDEM_CATEGORIAS[idx + 1] as Etapa) || 'pagamento';
  }

  function podeAvancar(cat: CategoriaId): boolean {
    if (cat === 'extra') return true; // opcional
    if (cat === 'guarnicao') return ((atual.guarnicao as ItemEstoque[]) || []).length === QTD_GUARNICOES;
    return !!atual[cat];
  }

  function finalizarMarmitaAtual() {
    const config: MarmitaConfig = {
      numero: marmitas.length + 1,
      tamanho: atual.tamanho as ItemEstoque,
      arroz: atual.arroz as ItemEstoque,
      feijao: atual.feijao as ItemEstoque,
      guarnicoes: (atual.guarnicao as ItemEstoque[]) || [],
      salada: atual.salada as ItemEstoque,
      carne: atual.carne as ItemEstoque,
      extra: (atual.extra as ItemEstoque) || null,
    };
    const novasMarmitas = [...marmitas, config];
    setMarmitas(novasMarmitas);

    if (modoMarmitas === 'diferentes' && novasMarmitas.length < quantidade) {
      setAtual({});
      setEtapa('tamanho');
    } else {
      if (modoMarmitas === 'igual') {
        for (let i = 1; i < quantidade; i++) novasMarmitas.push(config);
        setMarmitas(novasMarmitas);
      }
      setEtapa('pagamento');
    }
  }

  const total = useMemo(
    () => marmitas.reduce((soma, m) => soma + m.tamanho.preco + (m.extra?.preco || 0), 0),
    [marmitas]
  );

  async function enviarPedido() {
    setEnviando(true);
    try {
      const resp = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_cliente: nome,
          modo,
          endereco: modo === 'entrega' ? endereco : null,
          forma_pagamento: pagamento,
          total,
          marmitas,
        }),
      });
      const data = await resp.json();
      if (data.codigo) {
        setCodigoPedido(data.codigo);
        // abre o WhatsApp também, como canal extra de confirmação
        const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
        const texto = encodeURIComponent(
          `*Pedido #${data.codigo} — Bom Sabor* 🍱\n\n*Nome:* ${nome}\n*Modo:* ${modo}\n*Total:* R$ ${total.toFixed(2)}\n\nJá enviado pelo site — só confirmando por aqui!`
        );
        window.open(`https://wa.me/${numero}?text=${texto}`, '_blank');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <div className="p-10 text-center text-ink/60">Carregando cardápio do dia…</div>;

  if (codigoPedido) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 text-center bg-white rounded-2xl shadow">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-bold text-green-dark mb-2">Pedido #{codigoPedido} recebido!</h1>
        <p className="text-ink/60">Acompanhe pelo WhatsApp — já avisamos a cozinha.</p>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-green-dark mb-6 text-center">Monte sua marmita — Bom Sabor</h1>

      <div className="bg-white rounded-2xl shadow p-5">

        {etapa === 'nome' && (
          <Step titulo="Qual é o seu nome?">
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            <Botoes onNext={() => setEtapa('modo')} disabled={nome.trim().length < 2} />
          </Step>
        )}

        {etapa === 'modo' && (
          <Step titulo="Retirada ou entrega?">
            <Opcoes
              itens={[{ id: 'retirada', nome: '🏠 Retirar no restaurante' } as any, { id: 'entrega', nome: '🛵 Entrega no endereço' } as any]}
              selecionado={modo ? [{ id: modo } as any] : []}
              onSelect={(i) => setModo(i.id as any)}
            />
            <Botoes onBack={() => setEtapa('nome')} onNext={() => setEtapa(modo === 'entrega' ? 'endereco' : 'quantidade')} disabled={!modo} />
          </Step>
        )}

        {etapa === 'endereco' && (
          <Step titulo="Endereço de entrega">
            <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
            <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mt-3">
              🛵 A taxa de entrega varia conforme a localidade e será somada ao total, confirmada pelo WhatsApp.
            </p>
            <Botoes onBack={() => setEtapa('modo')} onNext={() => setEtapa('quantidade')} disabled={endereco.trim().length < 5} />
          </Step>
        )}

        {etapa === 'quantidade' && (
          <Step titulo="Quantas marmitas?">
            <div className="flex items-center justify-center gap-6 my-6">
              <button className="qtybtn" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>−</button>
              <span className="text-3xl font-bold text-green-dark">{quantidade}</span>
              <button className="qtybtn" onClick={() => setQuantidade((q) => Math.min(20, q + 1))}>+</button>
            </div>
            <Botoes
              onBack={() => setEtapa(modo === 'entrega' ? 'endereco' : 'modo')}
              onNext={() => setEtapa(quantidade > 1 ? 'modoMarmitas' : ('tamanho' as Etapa))}
              onNextExtra={() => { if (quantidade <= 1) setModoMarmitas('igual'); }}
            />
          </Step>
        )}

        {etapa === 'modoMarmitas' && (
          <Step titulo={`As ${quantidade} marmitas serão iguais?`}>
            <Opcoes
              itens={[{ id: 'igual', nome: '🍱 Sim, todas iguais' } as any, { id: 'diferentes', nome: '🎛️ Não, quero montar cada uma' } as any]}
              selecionado={modoMarmitas ? [{ id: modoMarmitas } as any] : []}
              onSelect={(i) => setModoMarmitas(i.id as any)}
            />
            <Botoes onBack={() => setEtapa('quantidade')} onNext={() => setEtapa('tamanho')} disabled={!modoMarmitas} />
          </Step>
        )}

        {ORDEM_CATEGORIAS.includes(etapa as CategoriaId) && (() => {
          const cat = etapa as CategoriaId;
          const itens = itensPorCategoria[cat] || [];
          const isMulti = cat === 'guarnicao';
          return (
            <Step titulo={NOMES_CATEGORIAS[cat]}>
              {modoMarmitas === 'diferentes' && quantidade > 1 && (
                <p className="text-xs font-bold text-orange-dark mb-2">Marmita {marmitas.length + 1} de {quantidade}</p>
              )}
              {itens.length === 0 && <p className="text-sm text-ink/60">Nenhum item disponível nessa categoria hoje.</p>}
              <Opcoes
                itens={itens}
                selecionado={isMulti ? ((atual.guarnicao as ItemEstoque[]) || []) : (atual[cat] ? [atual[cat] as ItemEstoque] : [])}
                onSelect={(i) => (isMulti ? alternarMulti(cat, i) : selecionarUnica(cat, i))}
                mostrarPreco={cat === 'tamanho' || cat === 'extra'}
              />
              {isMulti && <p className="text-xs font-bold text-orange-dark mt-2">{((atual.guarnicao as ItemEstoque[]) || []).length} de {QTD_GUARNICOES} selecionadas</p>}
              <Botoes
                onBack={() => {
                  const idx = ORDEM_CATEGORIAS.indexOf(cat);
                  if (idx === 0) setEtapa(quantidade > 1 ? 'modoMarmitas' : 'quantidade');
                  else setEtapa(ORDEM_CATEGORIAS[idx - 1] as Etapa);
                }}
                onNext={() => (cat === 'extra' ? finalizarMarmitaAtual() : setEtapa(proximaCategoria(cat)))}
                disabled={!podeAvancar(cat)}
              />
            </Step>
          );
        })()}

        {etapa === 'pagamento' && (
          <Step titulo="Forma de pagamento">
            <Opcoes
              itens={[{ id: 'pix', nome: '💠 Pix' } as any, { id: 'dinheiro', nome: '💵 Dinheiro' } as any, { id: 'cartao', nome: '💳 Cartão (na entrega)' } as any]}
              selecionado={pagamento ? [{ id: pagamento } as any] : []}
              onSelect={(i) => setPagamento(i.id)}
            />
            {pagamento === 'pix' && (
              <div className="bg-cream-2 rounded-xl p-3 mt-3 text-sm">
                <div className="font-bold mb-1">Chave Pix (celular)</div>
                <div className="flex gap-2">
                  <input className="input flex-1" readOnly value="35987096476" />
                  <button className="bg-green text-white rounded-lg px-3 font-bold" onClick={() => navigator.clipboard.writeText('35987096476')}>Copiar</button>
                </div>
              </div>
            )}
            <Botoes onBack={() => setEtapa('extra')} onNext={() => setEtapa('resumo')} disabled={!pagamento} />
          </Step>
        )}

        {etapa === 'resumo' && (
          <Step titulo="Resumo do pedido">
            <div className="text-sm space-y-1 mb-4">
              <SummaryLine k="Nome" v={nome} />
              <SummaryLine k="Modo" v={modo === 'entrega' ? 'Entrega' : 'Retirada'} />
              {modo === 'entrega' && <SummaryLine k="Endereço" v={endereco} />}
              <SummaryLine k="Quantidade" v={`${quantidade} marmita(s)`} />
              <SummaryLine k="Pagamento" v={pagamento || ''} />
            </div>
            <div className="flex justify-between items-center border-t-2 border-ink pt-3 mb-4">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-extrabold text-green-dark">R$ {total.toFixed(2)}</span>
            </div>
            <button disabled={enviando} onClick={enviarPedido} className="w-full bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Confirmar pedido ✅'}
            </button>
            <button onClick={() => setEtapa('pagamento')} className="w-full mt-2 border rounded-xl py-2 text-sm">Voltar</button>
          </Step>
        )}
      </div>

    </main>
  );
}

function Step({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-green-dark mb-3">{titulo}</h2>
      {children}
    </div>
  );
}

function Opcoes({
  itens, selecionado, onSelect, mostrarPreco,
}: { itens: ItemEstoque[]; selecionado: ItemEstoque[]; onSelect: (i: ItemEstoque) => void; mostrarPreco?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {itens.map((item) => {
        const ativo = selecionado.some((s) => s.id === item.id);
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`flex justify-between items-center px-4 py-3 rounded-xl border-2 text-left ${ativo ? 'border-green bg-cream-2' : 'border-transparent bg-cream'}`}
          >
            <span className="font-semibold text-sm">{(item as any).emoji} {item.nome}</span>
            {mostrarPreco && item.preco > 0 && <span className="text-green-dark font-bold text-sm">R$ {item.preco.toFixed(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Botoes({
  onBack, onNext, onNextExtra, disabled,
}: { onBack?: () => void; onNext: () => void; onNextExtra?: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2 mt-5">
      {onBack && <button onClick={onBack} className="px-4 py-3 rounded-xl border font-bold text-sm">Voltar</button>}
      <button
        onClick={() => { onNextExtra?.(); onNext(); }}
        disabled={disabled}
        className="flex-1 bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
      >
        Continuar
      </button>
    </div>
  );
}

function SummaryLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-ink/10 py-1.5">
      <span className="text-ink/60">{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
