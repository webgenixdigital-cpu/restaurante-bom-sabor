'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Categoria, CategoriaId, ItemEstoque, MarmitaConfig, ExtraCarneEscolha, ItemAvulsoEscolha } from '@/lib/types';
import Capa from '@/components/Capa';
import RodapeGenix from '@/components/RodapeGenix';
import FaqPedido from '@/components/FaqPedido';
import { infoDia } from '@/lib/calendario';
import { taxaDoBairro, type Bairro } from '@/lib/entrega';


const ORDEM_CATEGORIAS: CategoriaId[] = ['tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra'];
const NOMES_CATEGORIAS: Record<CategoriaId, string> = {
  tamanho: 'Escolha o tamanho', arroz: 'Escolha o arroz', feijao: 'Escolha o feijão',
  guarnicao: 'Escolha as guarnições', salada: 'Escolha a salada', carne: 'Escolha a carne',
  extra: 'Deseja adicionar carne extra?', massa: '', bebida: '', sobremesa: '',
};
const PULAVEL: Partial<Record<CategoriaId, boolean>> = { arroz: true, feijao: true, salada: true, carne: true };
const QTD_GUARNICOES = 3;
const CHAVE_CLIENTE = 'bomsabor:cliente'; // dados lembrados no aparelho do cliente
// Feijoada completa: prato pronto, já inclui todos os acompanhamentos
const ehFeijoada = (i?: ItemEstoque | null) => !!i && i.nome.toLowerCase().includes('feijoada');
// Feijoada completa só é servida aos sábados (horário de Brasília)
const ehSabadoBR = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Sao_Paulo' }) === 'Sat';
const PAGAMENTO_LABEL: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão (na entrega)' };

const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// Telefone no formato (35) 99999-9999; aceita o +55 do preenchimento automático do celular
function formatarTelefone(v: string) {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Rótulo da taxa de entrega de um bairro, para hoje
function rotuloTaxa(b: Bairro) {
  const t = taxaDoBairro(b);
  if (t === 0) return 'Grátis hoje';
  return b.a_partir_de ? `a partir de ${reais(t)}` : reais(t);
}

type Etapa =
  | 'nome' | 'tipoPedido' | 'modo' | 'endereco' | 'quantidade' | 'modoMarmitas'
  | CategoriaId | 'desejaMassa' | 'escolherMassa' | 'extraCarnes' | 'itensAvulsos' | 'bebidasSobremesas' | 'pagamento' | 'resumo';

export default function CardapioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [itensPorCategoria, setItensPorCategoria] = useState<Record<string, ItemEstoque[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [categoriasExtras, setCategoriasExtras] = useState<Categoria[]>([]);

  const [nome, setNome] = useState('');
  const [tipoPedido, setTipoPedido] = useState<'marmita' | 'avulso' | null>('marmita');
  const [modo, setModo] = useState<'retirada' | 'entrega' | null>(null);
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [bairroSel, setBairroSel] = useState<Bairro | null>(null);
  const [bairroForaLista, setBairroForaLista] = useState(false);
  const [bairroIdSalvo, setBairroIdSalvo] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [modoMarmitas, setModoMarmitas] = useState<'igual' | 'diferentes' | null>(null);
  const [pagamento, setPagamento] = useState<string | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [observacoes, setObservacoes] = useState('');
    const [lembrar, setLembrar] = useState(true);
  const [dadosLembrados, setDadosLembrados] = useState(false);
  const [desejaMassa, setDesejaMassa] = useState<'sim' | 'nao' | null>(null);
  const [escolhaPrato, setEscolhaPrato] = useState<string | null>(null);

  const [atual, setAtual] = useState<Partial<Record<CategoriaId, ItemEstoque | ItemEstoque[]>>>({});
  const [extraQuantidades, setExtraQuantidades] = useState<Record<string, number>>({});
  const [avulsoQuantidades, setAvulsoQuantidades] = useState<Record<string, number>>({});
  const [extrasQuantidades, setExtrasQuantidades] = useState<Record<string, number>>({});
  const [marmitas, setMarmitas] = useState<MarmitaConfig[]>([]);

  const [etapa, setEtapa] = useState<Etapa>('nome');
  const [enviando, setEnviando] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState<number | null>(null);

  const endereco = `${rua.trim()}, ${numero.trim()} - ${bairro.trim()}`;
  const enderecoValido =
    rua.trim().length >= 3 &&
    numero.trim().length >= 1 &&
    (!!bairroSel || (bairroForaLista && bairro.trim().length >= 2));

  const telefoneDigitos = telefone.replace(/\D/g, '');
  const telefoneValido = telefoneDigitos.length >= 10 && telefoneDigitos.length <= 11;

  // Sábado, domingo ou feriado: taxa cheia e pedido só pelo site (sem WhatsApp)
  const dia = useMemo(() => infoDia(), []);

  // null = bairro fora da tabela (taxa confirmada pelo restaurante)
  const taxaEntrega: number | null =
    modo !== 'entrega' ? 0 : bairroSel ? taxaDoBairro(bairroSel) : null;

    // preenche com os dados lembrados neste aparelho, se houver
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_CLIENTE);
      if (!salvo) return;
      const d = JSON.parse(salvo);
      if (d.nome) setNome(d.nome);
      if (d.telefone) setTelefone(formatarTelefone(d.telefone));
      if (d.rua) setRua(d.rua);
      if (d.numero) setNumero(d.numero);
      if (d.bairro) setBairro(d.bairro);
      if (d.bairro_id) setBairroIdSalvo(d.bairro_id);
      else if (d.bairro) setBairroForaLista(true);
      setDadosLembrados(true);
    } catch {
      // navegador sem acesso ao armazenamento: segue sem preencher
    }
  }, []);

  function limparDadosLembrados() {
    try { localStorage.removeItem(CHAVE_CLIENTE); } catch {}
    setNome(''); setTelefone(''); setRua(''); setNumero(''); setBairro('');
    setBairroSel(null); setBairroForaLista(false); setBairroIdSalvo(null);
    setDadosLembrados(false);
  }

  // quando a lista de bairros chega, reconhece o bairro lembrado no aparelho
  useEffect(() => {
    if (!bairroIdSalvo || bairros.length === 0) return;
    const b = bairros.find((x) => x.id === bairroIdSalvo);
    if (b) {
      setBairroSel(b);
      setBairro(b.nome);
      setBairroForaLista(false);
    }
  }, [bairros, bairroIdSalvo]);
    useEffect(() => {
    async function carregar() {
      const hoje = new Date().toISOString().slice(0, 10);

      const { data: tamanhos } = await supabase
        .from('itens_estoque')
        .select('*')
        .eq('ativo_cadastro', true)
        .eq('categoria_id', 'tamanho')
        .order('ordem');

      const { data } = await supabase
        .from('itens_estoque')
        .select('*, disponibilidade_dia!inner(disponivel, data)')
        .eq('ativo_cadastro', true)
        .neq('categoria_id', 'tamanho')
        .eq('disponibilidade_dia.data', hoje)
        .eq('disponibilidade_dia.disponivel', true);

      const agrupado: Record<string, ItemEstoque[]> = {};
      (data || []).forEach((item: any) => {
        agrupado[item.categoria_id] = agrupado[item.categoria_id] || [];
        agrupado[item.categoria_id].push(item);
      });
      Object.keys(agrupado).forEach((cat) => {
        agrupado[cat].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      });
            // de segunda a sexta a feijoada completa não é oferecida
      if (!ehSabadoBR()) {
        agrupado.feijao = (agrupado.feijao || []).filter((i) => !ehFeijoada(i));
      }
      agrupado.tamanho = tamanhos || [];

      const respCats = await fetch('/api/categorias');
      const cats: Categoria[] = respCats.ok ? await respCats.json() : [];
      setCategoriasExtras(cats.filter((c) => c.contexto === 'avulso' && c.id !== 'massa'));

      const { data: listaBairros } = await supabase
        .from('bairros')
        .select('id, nome, tipo, taxa, a_partir_de, gratis_dias_uteis')
        .eq('ativo', true)
        .order('nome');
      setBairros((listaBairros || []).map((b: any) => ({ ...b, taxa: Number(b.taxa) })));

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
  return itensPorCategoria.massa || [];
}

  function escolhasAvulsas(): ItemAvulsoEscolha[] {
    const disponiveis = itensAvulsosDisponiveis();
    return Object.entries(avulsoQuantidades)
      .map(([itemId, quantidade]) => ({ item: disponiveis.find((i) => i.id === itemId)!, quantidade }))
      .filter((e) => e.item && e.quantidade > 0);
  }

  function itensExtrasDisponiveis(): ItemEstoque[] {
  return categoriasExtras.flatMap((c) => itensPorCategoria[c.id] || []);
}

  function escolhasExtrasItens(): ItemAvulsoEscolha[] {
    const disponiveis = itensExtrasDisponiveis();
    return Object.entries(extrasQuantidades)
      .map(([itemId, quantidade]) => ({ item: disponiveis.find((i) => i.id === itemId)!, quantidade }))
      .filter((e) => e.item && e.quantidade > 0);
  }

   function finalizarMarmitaAtual(override?: Partial<Record<string, ItemEstoque | ItemEstoque[]>>) {
    // override: usado pela feijoada, para ignorar escolhas antigas guardadas
    const a = override ?? atual;
    const tipoExtra = a.extra as ItemEstoque | undefined;
    const carnesDisponiveis = itensPorCategoria.carne || [];
    const escolhasExtra: ExtraCarneEscolha[] = Object.entries(extraQuantidades)
      .map(([carneId, quantidade]) => ({
        carne: carnesDisponiveis.find((c) => c.id === carneId)!,
        quantidade,
      }))
      .filter((e) => e.carne && e.quantidade > 0);

    const config: MarmitaConfig = {
      numero: marmitas.length + 1,
      tamanho: a.tamanho as ItemEstoque,
      arroz: (a.arroz as ItemEstoque) || null,
      feijao: (a.feijao as ItemEstoque) || null,
      massas: a.massa ? [a.massa as ItemEstoque] : [],
      guarnicoes: (a.guarnicao as ItemEstoque[]) || [],
      salada: (a.salada as ItemEstoque) || null,
      carne: (a.carne as ItemEstoque) || null,
      extra: tipoExtra && tipoExtra.preco > 0 && escolhasExtra.length > 0
        ? { tipo: tipoExtra, escolhas: escolhasExtra }
        : null,
    };
    const novasMarmitas = [...marmitas, config];
    setMarmitas(novasMarmitas);
    setEscolhaPrato(null);

    if (modoMarmitas === 'diferentes' && novasMarmitas.length < quantidade) {
      setAtual({});
      setExtraQuantidades({});
      setDesejaMassa(null);
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
          const precoMassas = (m.massas || []).reduce((s, msa) => s + msa.preco, 0);
          return soma + m.tamanho.preco + precoCarne + precoExtra + precoMassas;
        }, 0);
    const extrasTotal = escolhasExtrasItens().reduce((s, e) => s + e.item.preco * e.quantidade, 0);
    return baseTotal + extrasTotal;
  }, [marmitas, avulsoQuantidades, extrasQuantidades, tipoPedido]);

  function descreverMarmita(m: MarmitaConfig): string {
    const partes = [
      m.arroz?.nome,
      m.feijao?.nome,
      m.massas && m.massas.length ? `Massa: ${m.massas.map((x) => x.nome).join(' / ')}` : null,
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
    if (m.massas?.length) linhas.push(`• Massa: ${m.massas.map((x) => x.nome).join(', ')}`);
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
          telefone: telefoneDigitos,
          modo,
          bairro_id: modo === 'entrega' && bairroSel ? bairroSel.id : null,
          taxa_entrega: modo === 'entrega' ? taxaEntrega : null,
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
                // lembra (ou esquece) os dados neste aparelho
        try {
          if (lembrar) {
            const anterior = JSON.parse(localStorage.getItem(CHAVE_CLIENTE) || '{}');
            localStorage.setItem(CHAVE_CLIENTE, JSON.stringify({
              ...anterior,
              nome: nome.trim(),
              telefone: telefoneDigitos,
              ...(modo === 'entrega'
                ? { rua: rua.trim(), numero: numero.trim(), bairro: bairro.trim(), bairro_id: bairroSel?.id ?? null }
                : {}),
            }));
          } else {
            localStorage.removeItem(CHAVE_CLIENTE);
          }
        } catch {}
        // Sábado, domingo e feriado: pedido só pelo site, sem abrir o WhatsApp
        if (dia.especial) return;

        const numeroWhats = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

        let itensTxt = '';
        if (tipoPedido === 'avulso') {
          itensTxt = `*Massas:*\n` + escolhasAvulsas().map((e) => `• ${e.quantidade}x ${e.item.nome}`).join('\n');
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
          ? `*Tipo:* 🛵 Entrega\n*Rua:* ${rua.trim()}\n*Número:* ${numero.trim()}\n*Bairro:* ${bairro.trim()}\n` +
            (taxaEntrega === null
              ? `_Taxa de entrega a confirmar (bairro fora da tabela)._`
              : `*Taxa de entrega:* ${taxaEntrega === 0 ? 'grátis' : reais(taxaEntrega)}`)
          : `*Tipo:* 🏠 Retirada no restaurante`;

        const texto = encodeURIComponent(
          `*Pedido #${data.codigo} — Cantina Bom Sabor* 🍱\n\n` +
          `*Cliente:* ${nome.trim()}\n` +
          `*Telefone:* ${telefone}\n` +
          `${blocoEntrega}\n` +
          `*Pagamento:* ${PAGAMENTO_LABEL[pagamento || ''] || pagamento}\n` +
          (observacoes.trim() ? `*Observações:* ${observacoes.trim()}\n` : '') +
          `\n${itensTxt}${extrasTxt}\n\n` +
          `*Total:* ${reais(total + (taxaEntrega ?? 0))}${taxaEntrega === null ? ' + taxa de entrega' : ''}\n\n` +
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
        {dia.especial ? (
          <p className="text-ink/60">
            Seu pedido já chegou na cozinha pelo sistema. Hoje os pedidos são atendidos somente pelo site,
            não é preciso enviar mensagem. Se precisarmos confirmar algo, ligamos para {telefone}.
          </p>
        ) : (
          <p className="text-ink/60">Acompanhe pelo WhatsApp — já avisamos a cozinha.</p>
        )}
        <FaqPedido />
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
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              name="name"
              autoComplete="name"
            />
            <input
              className="input mt-2"
              type="tel"
              inputMode="tel"
              name="tel"
              autoComplete="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="Telefone / WhatsApp com DDD"
            />
            {telefone.length > 0 && !telefoneValido && (
              <p className="text-xs text-red-600 mt-1">Informe o telefone com DDD, ex.: (35) 99999-9999</p>
            )}
                        <label className="flex items-center gap-2 text-xs text-ink/60 mt-3">
              <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
              Lembrar meus dados neste aparelho
            </label>

            {dadosLembrados && (
              <button type="button" onClick={limparDadosLembrados} className="text-xs text-ink/40 underline mt-1">
                Não é você? Limpar dados
              </button>
            )}
            <Botoes onNext={() => setEtapa('modo')} disabled={nome.trim().length < 2 || !telefoneValido} />
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
              onBack={() => setEtapa('nome')}
              onNext={() => setEtapa(modo === 'entrega' ? 'endereco' : 'quantidade')}
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
                <div className="flex-1">
                  <CampoBairro
                    bairros={bairros}
                    texto={bairro}
                    selecionado={bairroSel}
                    onTexto={(v) => { setBairro(v); setBairroSel(null); }}
                    onSelecionar={(b) => { setBairroSel(b); setBairro(b.nome); setBairroForaLista(false); }}
                    onForaDaLista={() => { setBairroForaLista(true); setBairroSel(null); }}
                  />
                </div>
              </div>
            </div>
            {bairroSel && (
              <div className="text-sm bg-cream-2 rounded-lg p-3 mt-3">
                🛵 <b>Taxa de entrega:</b>{' '}
                {taxaEntrega === 0 ? (
                  <span className="text-green-dark font-bold">grátis hoje</span>
                ) : (
                  <span className="text-green-dark font-bold">{rotuloTaxa(bairroSel)}</span>
                )}
                {bairroSel.a_partir_de && taxaEntrega !== 0 && (
                  <span className="block text-xs text-ink/50 mt-1">Valor mínimo; o restaurante confirma o valor final.</span>
                )}
              </div>
            )}
            {!bairroSel && bairroForaLista && (
              <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mt-3">
                📍 Bairro fora da tabela: a taxa de entrega será confirmada pelo restaurante.
              </p>
            )}
            {!bairroSel && !bairroForaLista && bairro.trim().length >= 2 && (
              <p className="text-xs text-orange-dark mt-2">Escolha o bairro na lista para ver a taxa de entrega.</p>
            )}
            <Botoes
              onBack={() => setEtapa('modo')}
              onNext={() => setEtapa('quantidade')}
              disabled={!enderecoValido}
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
        {etapa === 'escolhaPrato' && (() => {
          const feijoadas = (itensPorCategoria.feijao || []).filter(ehFeijoada);
          const opcaoMontar = { id: 'montar', nome: '🍱 Montar minha marmita' } as any;
          const selecionado = escolhaPrato === 'montar' ? [opcaoMontar] : feijoadas.filter((f) => f.id === escolhaPrato);
          return (
            <Step titulo="Como você quer sua marmita?">
              {modoMarmitas === 'diferentes' && quantidade > 1 && (
                <p className="text-xs font-bold text-orange-dark mb-2">Marmita {marmitas.length + 1} de {quantidade}</p>
              )}
              <Opcoes
                itens={[opcaoMontar, ...feijoadas]}
                selecionado={selecionado}
                onSelect={(i) => setEscolhaPrato(i.id)}
              />
              <Botoes
                onBack={() => setEtapa('tamanho')}
                onNext={() => {
                  if (escolhaPrato === 'montar') {
                    setEtapa('desejaMassa');
                    return;
                  }
                  const f = feijoadas.find((x) => x.id === escolhaPrato);
                  if (f) finalizarMarmitaAtual({ tamanho: atual.tamanho as ItemEstoque, feijao: f });
                }}
                disabled={!escolhaPrato}
              />
            </Step>
          );
        })()}
        {etapa === 'desejaMassa' && (
          <Step titulo="Deseja incluir massa nesta marmita?">
            {modoMarmitas === 'diferentes' && quantidade > 1 && (
              <p className="text-xs font-bold text-orange-dark mb-2">Marmita {marmitas.length + 1} de {quantidade}</p>
            )}
            <Opcoes
              itens={[{ id: 'sim', nome: '🍝 Sim, quero massa' } as any, { id: 'nao', nome: '➡️ Não, seguir sem massa' } as any]}
              selecionado={desejaMassa ? [{ id: desejaMassa } as any] : []}
              onSelect={(i) => setDesejaMassa(i.id as any)}
            />
            <Botoes
                           onBack={() => setEtapa((itensPorCategoria.feijao || []).some(ehFeijoada) ? 'escolhaPrato' : 'tamanho')}
                           
              onNext={() => setEtapa(desejaMassa === 'sim' ? 'escolherMassa' : 'arroz')}
              disabled={!desejaMassa}
            />
          </Step>
        )}

                {etapa === 'escolherMassa' && (
          <Step titulo="Qual massa?">
            <Opcoes
              itens={itensPorCategoria.massa || []}
              selecionado={atual.massa ? [atual.massa as ItemEstoque] : []}
              onSelect={(i) => selecionarUnica('massa', i)}
              mostrarPreco
            />
            {(itensPorCategoria.massa || []).length === 0 && (
              <p className="text-sm text-ink/60">Nenhuma massa disponível hoje.</p>
            )}
            <Botoes
              onBack={() => setEtapa('desejaMassa')}
              onNext={() => setEtapa('arroz')}
              disabled={!atual.massa}
            />
          </Step>
        )}
        {ORDEM_CATEGORIAS.includes(etapa as CategoriaId) && (() => {
          const cat = etapa as CategoriaId;
          const itens = (itensPorCategoria[cat] || []).filter((i) => cat !== 'feijao' || !ehFeijoada(i));
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
                            {isMulti && (
                <p className="text-xs font-bold text-orange-dark mt-2">
                  {((atual.guarnicao as ItemEstoque[]) || []).length} de {QTD_GUARNICOES} selecionadas (não é obrigatório escolher todas)
                </p>
              )}
              <Botoes
                onBack={() => {
                  const idx = ORDEM_CATEGORIAS.indexOf(cat);
                  if (idx === 0) setEtapa(quantidade > 1 ? 'modoMarmitas' : 'quantidade');
                  else if (cat === 'arroz') setEtapa('desejaMassa');
                  else setEtapa(ORDEM_CATEGORIAS[idx - 1] as Etapa);
                }}
                onSkip={PULAVEL[cat] ? () => pularEtapa(cat) : undefined}
                onNext={() => {
                                    if (cat === 'tamanho') {
                    const temFeijoada = (itensPorCategoria.feijao || []).some(ehFeijoada);
                    setEscolhaPrato(null);
                    setEtapa(temFeijoada ? 'escolhaPrato' : 'desejaMassa');
                    return;
                  }
                  if (cat === 'extra') {
                    const sel = atual.extra as ItemEstoque | undefined;
                    if (sel && sel.preco > 0) setEtapa('extraCarnes');
                    else finalizarMarmitaAtual();
                    return;
                  }
                  
                  setEtapa(proximaCategoria(cat));
                }}
                disabled={!podeAvancar(cat)}
              />
            </Step>
          );
        })()}

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
          <Step titulo="Quer adicionar algo mais?">
            {categoriasExtras.map((c) => {
  const itens = itensPorCategoria[c.id] || [];
  if (itens.length === 0) return null;
  return (
    <div key={c.id} className="mb-4">
      <p className="text-xs font-bold text-orange-dark uppercase tracking-wide mb-2">
        {c.nome}
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
              <p className="text-sm text-ink/60">Nenhum item adicional disponível hoje.</p>
            )}
            {escolhasExtrasItens().length > 0 && (
              <p className="text-sm font-bold text-green-dark mt-1 text-right">
                Subtotal adicionais: R$ {escolhasExtrasItens().reduce((s, e) => s + e.item.preco * e.quantidade, 0).toFixed(2)}
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
              <SummaryLine k="Telefone" v={telefone} />
              <SummaryLine k="Tipo" v={modo === 'entrega' ? 'Entrega' : 'Retirada no restaurante'} />
              {modo === 'entrega' && <SummaryLine k="Rua" v={rua} />}
              {modo === 'entrega' && <SummaryLine k="Número" v={numero} />}
              {modo === 'entrega' && <SummaryLine k="Bairro" v={bairro} />}
              <SummaryLine k="Quantidade" v={`${quantidade} marmita(s)`} />
              <SummaryLine k="Pagamento" v={PAGAMENTO_LABEL[pagamento || ''] || ''} />
            </div>

            <div className="bg-cream rounded-xl p-3 mb-4 space-y-3">
              {modoMarmitas === 'diferentes'
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
            {modo === 'entrega' && (
              <div className="text-sm space-y-1 mb-2">
                <SummaryLine k="Subtotal" v={reais(total)} />
                <SummaryLine
                  k="Taxa de entrega"
                  v={taxaEntrega === null ? 'a confirmar' : taxaEntrega === 0 ? 'Grátis' : reais(taxaEntrega)}
                />
              </div>
            )}
            <div className="flex justify-between items-center border-t-2 border-ink pt-3 mb-4">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-extrabold text-green-dark">{reais(total + (taxaEntrega ?? 0))}</span>
            </div>
            {modo === 'entrega' && taxaEntrega === null && (
              <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mb-4">
                📍 Seu bairro não está na tabela: a taxa de entrega será confirmada pelo restaurante e somada a este total.
              </p>
            )}
            {modo === 'entrega' && bairroSel?.a_partir_de && taxaEntrega !== 0 && (
              <p className="text-xs text-ink/60 bg-cream-2 rounded-lg p-3 mb-4">
                🛵 A taxa do seu bairro é um valor mínimo; o restaurante confirma o valor final.
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
      <div className="h-16" />
      </main>
      <FaqPedido />
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

// ---------- Campo de bairro com sugestões da tabela ----------
const TIPO_LABEL: Record<string, string> = { faculdade: 'Faculdade', empresa: 'Empresa', hospital: 'Hospital', hotel: 'Hotel' };
const ABREVIACOES: Record<string, string> = {
  jd: 'jardim', res: 'residencial', pq: 'parque', chac: 'chacara', vl: 'vila', sta: 'santa', sto: 'santo',
};

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
}

function buscarBairros(lista: Bairro[], texto: string): Bairro[] {
  const tokens = normalizar(texto).split(/\s+/).filter(Boolean).map((t) => ABREVIACOES[t] ?? t);
  if (tokens.length === 0) return [];
  return lista
    .filter((b) => {
      const alvo = normalizar(`${b.nome} ${TIPO_LABEL[b.tipo] ?? ''}`);
      return tokens.every((t) => alvo.includes(t));
    })
    .slice(0, 8);
}

function CampoBairro({
  bairros, texto, selecionado, onTexto, onSelecionar, onForaDaLista,
}: {
  bairros: Bairro[];
  texto: string;
  selecionado: Bairro | null;
  onTexto: (v: string) => void;
  onSelecionar: (b: Bairro) => void;
  onForaDaLista: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const sugestoes = buscarBairros(bairros, texto);

  return (
    <div className="relative">
      <input
        className="input w-full"
        value={texto}
        placeholder="Bairro (comece a digitar)"
        autoComplete="off"
        onChange={(e) => { onTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && !selecionado && texto.trim().length >= 2 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-ink/10 max-h-64 overflow-auto">
          {sugestoes.map((b) => (
            <button
              key={b.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelecionar(b); setAberto(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-cream flex justify-between gap-2"
            >
              <span>
                {b.nome}
                {TIPO_LABEL[b.tipo] && <span className="text-ink/40"> · {TIPO_LABEL[b.tipo]}</span>}
              </span>
              <span className="text-green-dark font-bold whitespace-nowrap">{rotuloTaxa(b)}</span>
            </button>
          ))}
          {sugestoes.length === 0 && (
            <p className="px-3 py-2 text-xs text-ink/50">Nenhum bairro encontrado com esse nome.</p>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onForaDaLista(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs text-ink/50 underline border-t border-ink/5"
          >
            Meu bairro não está na lista
          </button>
        </div>
      )}
    </div>
  );
}
