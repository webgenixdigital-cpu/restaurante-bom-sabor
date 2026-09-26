'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CategoriaId, ItemEstoque, MarmitaConfig, ExtraCarneEscolha, ItemAvulsoEscolha } from '@/lib/types';
import Capa from '@/components/Capa';
import RodapeGenix from '@/components/RodapeGenix';

const ORDEM_CATEGORIAS: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra'];
const NOMES_CATEGORIAS: Record<CategoriaId, string> = {
  tamanho: 'Escolha o tamanho', arroz: 'Escolha o arroz', feijao: 'Escolha o feijão',
  guarnicao: 'Escolha até 3 guarnições', salada: 'Escolha a salada', carne: 'Escolha a carne',
  extra: 'Deseja adicionar carne extra?', massa: '', congelados: '', bebida: '', sobremesa: '',
};
const PULAVEL: Partial<Record<CategoriaId, boolean>> = { arroz: true, feijao: true, salada: true, carne: true };
const QTD_GUARNICOES = 3;
const PAGAMENTO_LABEL: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão (na entrega)' };

type Etapa =
  | 'nome' | 'tipoPedido' | 'modo' | 'endereco' | 'quantidade' | 'modoMarmitas'
  | CategoriaId | 'extraCarnes' | 'itensAvulsos' | 'bebidasSobremesas' | 'incluirMassa' | 'pagamento' | 'resumo';

export default function CardapioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [itensPorCategoria, setItensPorCategoria] = useState<Record<string, ItemEstoque[]>>({});
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState('');
  const [tipoPedido, setTipoPedido] = useState<'marmita' | 'avulso' | null>(null);
  const [modo, setModo] = useState<'retirada' | 'entrega' | null>(null);
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [modoMarmitas, setModoMarmitas] = useState<'igual' | 'diferentes' | null>(null);
  const [pagamento, setPagamento] = useState<string | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  const [atual, setAtual] = useState<Partial<Record<CategoriaId, ItemEstoque | ItemEstoque[]>>>({});
  const [extraQuantidades, setExtraQuantidades] = useState<Record<string, number>>({});
  const [avulsoQuantidades, setAvulsoQuantidades] = useState<Record<string, number>>({});
  const [extrasQuantidades, setExtrasQuantidades] = useState<Record<string, number>>({});
  const [marmitas, setMarmitas] = useState<MarmitaConfig[]>([]);

  const [etapa, setEtapa] = useState<Etapa>('nome');
  const [enviando, setEnviando] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState<number | null>(null);

  const endereco = `${rua.trim()}, ${numero.trim()} - ${bairro.trim()}`;
  const enderecoValido = rua.trim().length >= 3 && numero.trim().length >= 1 && bairro.trim().length >= 2;

  useEffect(() => {
    async function carregar() {
      const hoje = new Date().toISOString().slice(0, 10);

      // Tamanhos sempre disponíveis — não dependem de ativação diária
      const { data: tamanhos } = await supabase
        .from('itens_estoque')
        .select('*')
        .eq('categoria_id', 'tamanho')
        .order('ordem');

      // Demais categorias dependem do que foi ativado para hoje
      const { data } = await supabase
        .from('itens_estoque')
        .select('*, disponibilidade_dia!inner(disponivel, data)')
        .neq('categoria_id', 'tamanho')
        .eq('disponibilidade_dia.data', hoje)
        .eq('disponibilidade_dia.disponivel', true);

      const agrupado: Record<string, ItemEstoque[]> = {};
      (data || []).forEach((item: any) => {
        agrupado[item.categoria_id] = agrupado[item.categoria_id] || [];
        agrupado[item.categoria_id].push(item);
      });
      // ordem alfabética em tudo, exceto tamanho (que segue a ordem crescente de preço/porte)
      Object.keys(agrupado).forEach((cat) => {
        agrupado[cat].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      });
      agrupado.tamanho = tamanhos || [];

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
    if (cat === 'extra') return true;
    if (cat === 'guarnicao') return true;
    return !!atual[cat];
  }

  function pularEtapa(cat: CategoriaId) {
    setAtual((prev) => ({ ...prev, [cat]: undefined }));
    setEtapa(proximaCategoria(cat));
  }

  function ajustarQtdExtra(carneId: string, delta: number) {
    setExtraQuantidades((prev) => {
      const atualQtd = prev[carneId] || 0;
      const nova = Math.max(0, Math.min(20, atualQtd + delta));
      const copia = { ...prev, [carneId]: nova };
      if (nova === 0) delete copia[carneId];
      return copia;
    });
  }

  function ajustarQtdAvulso(itemId: string, delta: number) {
    setAvulsoQuantidades((prev) => {
      const atualQtd = prev[itemId] || 0;
      const nova = Math.max(0, Math.min(50, atualQtd + delta));
      const copia = { ...prev, [itemId]: nova };
      if (nova === 0) delete copia[itemId];
      return copia;
    });
  }

  function ajustarQtdExtraItem(itemId: string, delta: number) {
    setExtrasQuantidades((prev) => {
      const atualQtd = prev[itemId] || 0;
      const nova = Math.max(0, Math.min(20, atualQtd + delta));
      const copia = { ...prev, [itemId]: nova };
      if (nova === 0) delete copia[itemId];
      return copia;
    });
  }

  function totalUnidadesExtra() {
    return Object.values(extraQuantidades).reduce((s, q) => s + q, 0);
  }

  function totalUnidadesAvulso() {
    return Object.values(avulsoQuantidades).reduce((s, q) => s + q, 0);
  }

  function itensAvulsosDisponiveis(): ItemEstoque[] {
    return [...(itensPorCategoria.massa || []), ...(itensPorCategoria.congelados || [])];
  }

  function escolhasAvulsas(): ItemAvulsoEscolha[] {
    const disponiveis = itensAvulsosDisponiveis();
    return Object.entries(avulsoQuantidades)
      .map(([itemId, quantidade]) => ({ item: disponiveis.find((i) => i.id === itemId)!, quantidade }))
      .filter((e) => e.item && e.quantidade > 0);
  }

    function itensExtrasDisponiveis(): ItemEstoque[] {
    return [...(itensPorCategoria.bebida || []), ...(itensPorCategoria.sobremesa || []), ...(itensPorCategoria.massa || [])];
  }

  function escolhasExtrasItens(): ItemAvulsoEscolha[] {
    const disponiveis = itensExtrasDisponiveis();
    return Object.entries(extrasQuantidades)
      .map(([itemId, quantidade]) => ({ item: disponiveis.find((i) => i.id === itemId)!, quantidade }))
      .filter((e) => e.item && e.quantidade > 0);
  }

  function finalizarMarmitaAtual() {
    const tipoExtra = atual.extra as ItemEstoque | undefined;
    const carnesDisponiveis = itensPorCategoria.carne || [];
    const escolhasExtra: ExtraCarneEscolha[] = Object.entries(extraQuantidades)
      .map(([carneId, quantidade]) => ({
        carne: carnesDisponiveis.find((c) => c.id === carneId)!,
        quantidade,
      }))
      .filter((e) => e.carne && e.quantidade > 0);

    const config: MarmitaConfig = {
      numero: marmitas.length + 1,
      tamanho: atual.tamanho as ItemEstoque,
      arroz: (atual.arroz as ItemEstoque) || null,
      feijao: (atual.feijao as ItemEstoque) || null,
      guarnicoes: (atual.guarnicao as ItemEstoque[]) || [],
      salada: (atual.salada as ItemEstoque) || null,
      carne: (atual.carne as ItemEstoque) || null,
      extra: tipoExtra && tipoExtra.preco > 0 && escolhasExtra.length > 0
        ? { tipo: tipoExtra, escolhas: escolhasExtra }
        : null,
    };
    const novasMarmitas = [...marmitas, config];
    setMarmitas(novasMarmitas);

    if (modoMarmitas === 'diferentes' && novasMarmitas.length < quantidade) {
      setAtual({});
      setExtraQuantidades({});
      setEtapa('tamanho');
    } else {
      if (modoMarmitas === 'igual') {
        for (let i = 1; i < quantidade; i++) novasMarmitas.push(config);
        setMarmitas(novasMarmitas);
      }
      setEtapa('bebidasSobremesas');
    }
  }
    const total = useMemo(() => {
    const baseTotal = tipoPedido === 'avulso'
      ? escolhasAvulsas().reduce((s, e) => s + e.item.preco * e.quantidade, 0)
      : marmitas.reduce((soma, m) => {
          const precoExtra = m.extra ? m.extra.tipo.preco * m.extra.escolhas.reduce((s, e) => s + e.quantidade, 0) : 0;
          const precoCarne = m.carne?.preco || 0;
          return soma + m.tamanho.preco + precoCarne + precoExtra;
        }, 0);
    const extrasTotal = escolhasExtrasItens().reduce((s, e) => s + e.item.preco * e.quantidade, 0);
    return baseTotal + extrasTotal;
  }, [marmitas, avulsoQuantidades, extrasQuantidades, tipoPedido]);

  function descreverMarmita(m: MarmitaConfig): string {
    const partes = [
      m.arroz?.nome,
      m.feijao?.nome,
      m.guarnicoes.length ? m.guarnicoes.map((g) => g.nome).join(' / ') : null,
      m.salada?.nome,
      m.carne?.nome,
    ].filter(Boolean);
    let txt = partes.length ? partes.join(', ') : 'sem acompanhamentos escolhidos';
    if (m.extra) {
      const extraTxt = m.extra.escolhas.map((e) => `${e.quantidade}x ${e.carne.nome}`).join(', ');
      txt += ` + ${m.extra.tipo.nome}: ${extraTxt}`;
    }
    return txt;
  }

  // Versão detalhada, linha a linha, para a mensagem do WhatsApp
  function detalharMarmitaWhats(m: MarmitaConfig): string {
    const linhas: string[] = [];
    if (m.arroz) linhas.push(`• Arroz: ${m.arroz.nome}`);
    if (m.feijao) linhas.push(`• Feijão: ${m.feijao.nome}`);
    if (m.guarnicoes.length) linhas.push(`• Guarnições: ${m.guarnicoes.map((g) => g.nome).join(', ')}`);
    if (m.salada) linhas.push(`• Salada: ${m.salada.nome}`);
    if (m.carne) linhas.push(`• Carne: ${m.carne.nome}`);
    if (m.extra) linhas.push(`• ${m.extra.tipo.nome}: ${m.extra.escolhas.map((e) => `${e.quantidade}x ${e.carne.nome}`).join(', ')}`);
    if (!linhas.length) linhas.push('• Sem acompanhamentos escolhidos');
    return linhas.join('\n');
  }

  async function copiarPix() {
    const chave = '86449840000151';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(chave);
      } else {
        throw new Error('clipboard indisponível');
      }
      setPixCopiado(true);
    } catch {
      const input = document.createElement('input');
      input.value = chave;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        setPixCopiado(true);
      } catch {
        setPixCopiado(false);
        alert('Não foi possível copiar automaticamente. Chave Pix: ' + chave);
      }
      document.body.removeChild(input);
    }
    setTimeout(() => setPixCopiado(false), 2500);
  }

  async function enviarPedido() {
    setEnviando(true);
    try {
      const itensAvulsosPayload = [
        ...(tipoPedido === 'avulso' ? escolhasAvulsas() : []),
        ...escolhasExtrasItens(),
      ];

      const resp = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_cliente: nome,
          modo,
          endereco: modo === 'entrega' ? endereco : null,
          forma_pagamento: PAGAMENTO_LABEL[pagamento || ''] || pagamento,
          total,
          observacoes: observacoes.trim() || undefined,
          marmitas: tipoPedido === 'marmita' ? marmitas : [],
          itensAvulsos: itensAvulsosPayload,
        }),
      });
      const data = await resp.json();
      if (data.codigo) {
        setCodigoPedido(data.codigo);
        const numeroWhats = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

        let itensTxt = '';
        if (tipoPedido === 'avulso') {
          itensTxt = `*Massas / Congelados:*\n` + escolhasAvulsas().map((e) => `• ${e.quantidade}x ${e.item.nome}`).join('\n');
        } else if (modoMarmitas === 'diferentes') {
          itensTxt = marmitas.map((m) => `*Marmita ${m.numero} — ${m.tamanho.nome}*\n${detalharMarmitaWhats(m)}`).join('\n\n');
        } else if (marmitas[0]) {
          itensTxt = `*${quantidade}x Marmita ${marmitas[0].tamanho.nome}*${quantidade > 1 ? ' (todas iguais)' : ''}\n${detalharMarmitaWhats(marmitas[0])}`;
        }

        const escolhasExtras = escolhasExtrasItens();
        const extrasTxt = escolhasExtras.length
          ? `\n\n*Itens adicionais:*\n` + escolhasExtras.map((e) => `• ${e.quantidade}x ${e.item.nome}`).join('\n')
        : '';

        const blocoEntrega = modo === 'entrega'
          ? `*Tipo:* 🛵 Entrega\n*Rua:* ${rua.trim()}\n*Número:* ${numero.trim()}\n*Bairro:* ${bairro.trim()}\n_Taxa de entrega a confirmar._`
          : `*Tipo:* 🏠 Retirada no restaurante`;

        const texto = encodeURIComponent(
          `*Pedido #${data.codigo} — Cantina Bom Sabor* 🍱\n\n` +
          `*Cliente:* ${nome.trim()}\n` +
          `${blocoEntrega}\n` +
          `*Pagamento:* ${PAGAMENTO_LABEL[pagamento || ''] || pagamento}\n` +
          (observacoes.trim() ? `*Observações:* ${observacoes.trim()}\n` : '') +
          `\n${itensTxt}${extrasTxt}\n\n` +
          `Já enviado pelo site — só confirmando por aqui!`
        );
        window.open(`https://wa.me/${numeroWhats}?text=${texto}`, '_blank');
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
    <>
      <Capa />
      <main className="max-w-lg mx-auto px-4 pb-8 pt-16 sm:pt-20">
        <h1 className="text-2xl font-bold text-green-dark mb-6 text-center">Cantina Bom Sabor</h1>

        <div className="bg-white rounded-2xl shadow p-5">

        {etapa === 'nome' && (
          <Step titulo="Qual é o seu nome?">
            <div className="bg-cream-2 rounded-xl p-3 mb-4 text-xs text-ink/70 leading-relaxed">
              💡 <b>Como funciona:</b> monte sua marmita passo a passo — tamanho, arroz, feijão,
              guarnições, salada e carne. Se não quiser escolher algo em alguma etapa, é só usar
              "Pular etapa". No final você vê o resumo completo antes de confirmar.
              <br /><br />
              🌱 Itens com essa folhinha são opções vegetarianas (sem carne).
            </div>
            <div className="bg-orange/10 border border-orange/20 rounded-xl p-3 mb-4 text-xs text-ink/70 leading-relaxed">
              📌 <b>Bom saber:</b> pedir os itens da marmita separados em potes individuais tem
              acréscimo a partir de R$ 2,00 (valor da embalagem). Temos também marmitex só de
              massa, com valor diferenciado — consulte pelo WhatsApp.
            </div>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            <Botoes onNext={() => setEtapa('tipoPedido')} disabled={nome.trim().length < 2} />
          </Step>
        )}

        {etapa === 'tipoPedido' && (
          <Step titulo="O que você quer pedir?">
            <Opcoes
              itens={[
                { id: 'marmita', nome: '🍱 Marmita completa' } as any,
                { id: 'avulso', nome: '🍝 Massas / Congelados avulsos' } as any,
              ]}
              selecionado={tipoPedido ? [{ id: tipoPedido } as any] : []}
              onSelect={(i) => setTipoPedido(i.id as any)}
            />
            <Botoes onBack={() => setEtapa('nome')} onNext={() => setEtapa('modo')} disabled={!tipoPedido} />
          </Step>
        )}

        {etapa === 'modo' && (
          <Step titulo="Retirada ou entrega?">
            <Opcoes
              itens={[{ id: 'retirada', nome: '🏠 Retirar no restaurante' } as any, { id: 'entrega', nome: '🛵 Entrega no endereço' } as any]}
              selecionado={modo ? [{ id: modo } as any] : []}
              onSelect={(i) => setModo(i.id as any)}
            />
            <Botoes
              onBack={() => setEtapa('tipoPedido')}
              onNext={() => setEtapa(modo === 'entrega' ? 'endereco' : (tipoPedido === 'avulso' ? 'itensAvulsos' : 'quantidade'))}
              disabled={!modo}
            />
          </Step>
        )}

        {etapa === 'endereco' && (
          <Step titulo="Endereço de entrega">
            <div className="flex flex-col gap-2">
              <input className="input" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua" autoComplete="address-line1" />
              <div className="flex gap-2">
                <input
                  className="input"
                  style={{ width: '35%' }}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Número"
                  inputMode="numeric"
                />
                <input className="input flex-1" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
              </div>
            </div>
            <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mt-3">
              🛵 A taxa de entrega varia conforme a localidade e será somada ao total, confirmada pelo WhatsApp.
              Aos domingos e feriados a entrega é terceirizada e o valor pode ser diferente — também confirmado por lá.
            </p>
            <Botoes
              onBack={() => setEtapa('modo')}
              onNext={() => setEtapa(tipoPedido === 'avulso' ? 'itensAvulsos' : 'quantidade')}
              disabled={!enderecoValido}
            />
          </Step>
        )}

        {etapa === 'itensAvulsos' && (
          <Step titulo="Escolha as massas/congelados">
            {['massa', 'congelados'].map((cat) => {
              const itens = itensPorCategoria[cat] || [];
              if (itens.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-bold text-orange-dark uppercase tracking-wide mb-2">
                    {cat === 'massa' ? 'Massas' : 'Congelados'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {itens.map((item) => {
                      const qtd = avulsoQuantidades[item.id] || 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-cream">
                          <span className="font-semibold text-sm flex items-center gap-1.5">
                            {item.emoji} {item.nome}
                            {item.vegetariano && <span title="Vegetariano">🌱</span>}
                            {item.preco > 0 && <span className="text-green-dark font-bold text-xs">R$ {item.preco.toFixed(2)}</span>}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <button className="qtybtn-sm" onClick={() => ajustarQtdAvulso(item.id, -1)}>−</button>
                            <span className="w-5 text-center font-bold">{qtd}</span>
                            <button className="qtybtn-sm" onClick={() => ajustarQtdAvulso(item.id, 1)}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {itensAvulsosDisponiveis().length === 0 && (
              <p className="text-sm text-ink/60">Nenhuma massa ou congelado disponível hoje.</p>
            )}
            {totalUnidadesAvulso() > 0 && (
              <p className="text-sm font-bold text-green-dark mt-1 text-right">Subtotal: R$ {total.toFixed(2)}</p>
            )}
            <Botoes
              onBack={() => setEtapa(modo === 'entrega' ? 'endereco' : 'modo')}
              onNext={() => setEtapa('bebidasSobremesas')}
              disabled={totalUnidadesAvulso() === 0}
            />
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
                mostrarPreco={cat === 'tamanho' || cat === 'extra' || cat === 'carne'}
              />
              {isMulti && <p className="text-xs font-bold text-orange-dark mt-2">{((atual.guarnicao as ItemEstoque[]) || []).length} de {QTD_GUARNICOES} selecionadas (não é obrigatório escolher todas)</p>}
              {cat === 'guarnicao' && (itensPorCategoria.massa || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setEtapa('incluirMassa')}
                  className="w-full mt-3 border-2 border-dashed border-orange text-orange-dark font-bold py-2.5 rounded-xl text-sm hover:bg-orange/5 transition flex items-center justify-center gap-2"
                >
                  🍝 Incluir massa
                  {escolhasExtrasItens().filter((e) => e.item.categoria_id === 'massa').length > 0 && (
                    <span className="bg-orange text-white text-xs rounded-full px-2 py-0.5">
                      {escolhasExtrasItens().filter((e) => e.item.categoria_id === 'massa').reduce((s, e) => s + e.quantidade, 0)}
                    </span>
                  )}
                </button>
              )}
              <Botoes
                onBack={() => {
                  const idx = ORDEM_CATEGORIAS.indexOf(cat);
                  if (idx === 0) setEtapa(quantidade > 1 ? 'modoMarmitas' : 'quantidade');
                  else setEtapa(ORDEM_CATEGORIAS[idx - 1] as Etapa);
                }}
                onSkip={PULAVEL[cat] ? () => pularEtapa(cat) : undefined}
                onNext={() => {
                  if (cat === 'extra') {
                    const sel = atual.extra as ItemEstoque | undefined;
                    if (sel && sel.preco > 0) setEtapa('extraCarnes');
                    else finalizarMarmitaAtual();
                    return;
                  }
                  if (cat === 'feijao') {
                    const selFeijao = atual.feijao as ItemEstoque | undefined;
                    if (selFeijao && selFeijao.nome.toLowerCase().includes('feijoada')) {
                      finalizarMarmitaAtual();
                      return;
                    }
                  }
                  setEtapa(proximaCategoria(cat));
                }}
                disabled={!podeAvancar(cat)}
              />
            </Step>
          );
        })()}
                {etapa === 'incluirMassa' && (
          <Step titulo="Incluir massa no pedido">
            <p className="text-xs text-ink/60 mb-3">Adicione quantas quiser — o valor entra à parte, somado ao total.</p>
                        <div className="flex flex-col gap-2">
              {(itensPorCategoria.massa || []).map((item) => {
                const selecionada = (extrasQuantidades[item.id] || 0) > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExtrasQuantidades((prev) => {
                      const copia = { ...prev };
                      if (selecionada) delete copia[item.id];
                      else copia[item.id] = 1;
                      return copia;
                    })}
                    className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border-2 text-left ${selecionada ? 'border-green bg-cream-2' : 'border-transparent bg-cream'}`}
                  >
                    <span className="font-semibold text-sm">{item.emoji} {item.nome}</span>
                    <span className="text-green-dark font-bold text-sm">R$ {item.preco.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
            {(itensPorCategoria.massa || []).length === 0 && (
              <p className="text-sm text-ink/60">Nenhuma massa disponível hoje.</p>
            )}
            <Botoes onBack={() => setEtapa('guarnicao')} onNext={() => setEtapa('guarnicao')} />
          </Step>
        )}

        {etapa === 'extraCarnes' && (() => {
              
          const tipoExtra = atual.extra as ItemEstoque;
          const carnes = itensPorCategoria.carne || [];
          return (
            <Step titulo={`Quais carnes? (${tipoExtra?.nome})`}>
              <p className="text-xs text-ink/60 mb-3">
                Cada unidade sai por {tipoExtra ? `R$ ${tipoExtra.preco.toFixed(2)}` : ''}. Escolha uma ou mais carnes e a quantidade de cada.
              </p>
              <div className="flex flex-col gap-2">
                {carnes.map((c) => {
                  const qtd = extraQuantidades[c.id] || 0;
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-cream">
                      <span className="font-semibold text-sm">{c.emoji} {c.nome}</span>
                      <div className="flex items-center gap-3">
                        <button className="qtybtn-sm" onClick={() => ajustarQtdExtra(c.id, -1)}>−</button>
                        <span className="w-5 text-center font-bold">{qtd}</span>
                        <button className="qtybtn-sm" onClick={() => ajustarQtdExtra(c.id, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalUnidadesExtra() > 0 && tipoExtra && (
                <p className="text-sm font-bold text-green-dark mt-3 text-right">
                  Subtotal extra: R$ {(tipoExtra.preco * totalUnidadesExtra()).toFixed(2)}
                </p>
              )}
              <Botoes
                onBack={() => setEtapa('extra')}
                onSkip={() => { setExtraQuantidades({}); finalizarMarmitaAtual(); }}
                onNext={finalizarMarmitaAtual}
                disabled={totalUnidadesExtra() === 0}
              />
            </Step>
          );
        })()}

        {etapa === 'bebidasSobremesas' && (
          <Step titulo="Quer bebida ou sobremesa?">
            <p className="text-xs text-ink/60 mb-3">Opcional — só some ao total se você escolher algo.</p>
            {['bebida', 'sobremesa'].map((cat) => {
              const itens = itensPorCategoria[cat] || [];
              if (itens.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-bold text-orange-dark uppercase tracking-wide mb-2">
                    {cat === 'bebida' ? 'Bebidas' : 'Sobremesas'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {itens.map((item) => {
                      const qtd = extrasQuantidades[item.id] || 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-cream">
                          <span className="font-semibold text-sm flex items-center gap-1.5">
                            {item.emoji} {item.nome}
                            <span className="text-green-dark font-bold text-xs">R$ {item.preco.toFixed(2)}</span>
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <button className="qtybtn-sm" onClick={() => ajustarQtdExtraItem(item.id, -1)}>−</button>
                            <span className="w-5 text-center font-bold">{qtd}</span>
                            <button className="qtybtn-sm" onClick={() => ajustarQtdExtraItem(item.id, 1)}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {itensExtrasDisponiveis().length === 0 && (
              <p className="text-sm text-ink/60">Nenhuma bebida ou sobremesa disponível hoje.</p>
            )}
            {escolhasExtrasItens().length > 0 && (
              <p className="text-sm font-bold text-green-dark mt-1 text-right">
                Subtotal bebidas/sobremesas: R$ {escolhasExtrasItens().reduce((s, e) => s + e.item.preco * e.quantidade, 0).toFixed(2)}
              </p>
            )}
            <Botoes onNext={() => setEtapa('pagamento')} />
          </Step>
        )}

        {etapa === 'pagamento' && (
          <Step titulo="Forma de pagamento">
            <Opcoes
              itens={[{ id: 'pix', nome: '💠 Pix' } as any, { id: 'dinheiro', nome: '💵 Dinheiro' } as any, { id: 'cartao', nome: '💳 Cartão (na entrega)' } as any]}
              selecionado={pagamento ? [{ id: pagamento } as any] : []}
              onSelect={(i) => setPagamento(i.id)}
            />
            {pagamento === 'pix' && (
              <div className="bg-cream-2 rounded-xl p-3 mt-3 text-sm">
                <div className="font-bold mb-1">Chave Pix (CNPJ) — Gabriel e Danziger e Cia Ltda</div>
                <div className="flex gap-2">
                  <input className="input flex-1" readOnly value="86449840000151" />
                  <button
                    type="button"
                    className={`rounded-lg px-3 font-bold text-white transition ${pixCopiado ? 'bg-green-dark' : 'bg-green'}`}
                    onClick={copiarPix}
                  >
                    {pixCopiado ? 'Copiado! ✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
            <Botoes
              onBack={() => setEtapa('bebidasSobremesas')}
              onNext={() => setEtapa('resumo')}
              disabled={!pagamento}
            />
          </Step>
        )}

        {etapa === 'resumo' && (
          <Step titulo="Resumo do pedido">
            <div className="text-sm space-y-1 mb-4">
              <SummaryLine k="Nome" v={nome} />
              <SummaryLine k="Tipo" v={modo === 'entrega' ? 'Entrega' : 'Retirada no restaurante'} />
              {modo === 'entrega' && <SummaryLine k="Rua" v={rua} />}
              {modo === 'entrega' && <SummaryLine k="Número" v={numero} />}
              {modo === 'entrega' && <SummaryLine k="Bairro" v={bairro} />}
              {tipoPedido === 'marmita' && <SummaryLine k="Quantidade" v={`${quantidade} marmita(s)`} />}
              <SummaryLine k="Pagamento" v={PAGAMENTO_LABEL[pagamento || ''] || ''} />
            </div>

            <div className="bg-cream rounded-xl p-3 mb-4 space-y-3">
              {tipoPedido === 'avulso'
                ? escolhasAvulsas().map((e) => (
                    <div key={e.item.id} className="flex justify-between text-sm">
                      <span className="font-bold text-green-dark">{e.quantidade}x {e.item.nome}</span>
                      {e.item.preco > 0 && <span className="text-ink/60">R$ {(e.item.preco * e.quantidade).toFixed(2)}</span>}
                    </div>
                  ))
                : modoMarmitas === 'diferentes'
                  ? marmitas.map((m) => (
                      <div key={m.numero} className="text-sm">
                        <div className="font-bold text-green-dark">Marmita {m.numero} — {m.tamanho.nome}</div>
                        <div className="text-ink/70 text-xs mt-0.5">{descreverMarmita(m)}</div>
                      </div>
                    ))
                  : marmitas[0] && (
                      <div className="text-sm">
                        <div className="font-bold text-green-dark">{marmitas[0].tamanho.nome} × {quantidade}</div>
                        <div className="text-ink/70 text-xs mt-0.5">{descreverMarmita(marmitas[0])}</div>
                      </div>
                    )}
              {escolhasExtrasItens().length > 0 && (
                <div className="pt-2 border-t border-dashed border-ink/10">
                  <div className="text-xs font-bold text-orange-dark uppercase tracking-wide mb-1">Itens adicionais</div>
                  {escolhasExtrasItens().map((e) => (
                    <div key={e.item.id} className="flex justify-between text-sm">
                      <span className="font-semibold">{e.quantidade}x {e.item.nome}</span>
                      <span className="text-ink/60">R$ {(e.item.preco * e.quantidade).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-ink/50 uppercase tracking-wide block mb-1">
                Observações (opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: sem cebola, ponto da carne, entregar na portaria..."
                rows={3}
                className="input resize-none"
              />
            </div>
            <div className="flex justify-between items-center border-t-2 border-ink pt-3 mb-4">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-extrabold text-green-dark">R$ {total.toFixed(2)}</span>
            </div>
            {modo === 'entrega' && (
              <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mb-4">
                🛵 Este total ainda não inclui a taxa de entrega — ela varia conforme a localidade e será confirmada pelo WhatsApp antes da preparação.
              </p>
            )}
            <button disabled={enviando} onClick={enviarPedido} className="w-full bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Confirmar pedido ✅'}
            </button>
            <button onClick={() => setEtapa('pagamento')} className="w-full mt-2 border rounded-xl py-2 text-sm">Voltar</button>
          </Step>
        )}
      </div>

      <RodapeGenix />
      </main>
    </>
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
            <span className="font-semibold text-sm flex items-center gap-1.5">
              {(item as any).emoji} {item.nome}
              {item.vegetariano && <span title="Vegetariano">🌱</span>}
            </span>
            {mostrarPreco && item.preco > 0 && <span className="text-green-dark font-bold text-sm">R$ {item.preco.toFixed(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Botoes({
  onBack, onNext, onNextExtra, onSkip, disabled,
}: { onBack?: () => void; onNext: () => void; onNextExtra?: () => void; onSkip?: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2 mt-5">
      <div className="flex gap-2">
        {onBack && <button onClick={onBack} className="px-4 py-3 rounded-xl border font-bold text-sm">Voltar</button>}
        <button
          onClick={() => { onNextExtra?.(); onNext(); }}
          disabled={disabled}
          className="flex-1 bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
      {onSkip && (
        <button onClick={onSkip} className="text-xs text-ink/40 underline hover:text-ink/70 self-center">
          Pular etapa
        </button>
      )}
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