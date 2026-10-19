'use client';

import { useState } from 'react';

// Perguntas frequentes do pedido. Para mudar um texto, edite só esta lista.
const PERGUNTAS: { p: string; r: string }[] = [
  {
    p: 'Como faço meu pedido?',
    r: 'É só seguir as etapas: tamanho, massa (opcional), arroz, feijão, até 3 guarnições, salada, carne e adicional. Se não quiser algum item, toque em "Pular etapa". No final você vê o resumo completo, com o total, antes de confirmar.',
  },
  {
    p: 'Posso pedir pelo WhatsApp?',
    r: 'De segunda a sexta, você pode pedir por aqui ou pelo WhatsApp. Aos sábados, domingos e feriados, os pedidos são feitos somente por aqui, pelo site, e chegam direto na cozinha.',
  },
  {
    p: 'Quanto custa a entrega?',
    r: 'Depende do bairro. Ao escolher o bairro, o valor aparece logo abaixo e já entra no total do pedido. De segunda a sexta, a entrega é grátis no Centro e no Jardim dos Estados. Aos sábados, domingos e feriados, vale a tabela para todos os bairros. Se o seu bairro não estiver na lista, o restaurante confirma a taxa com você.',
  },
  {
    p: 'Tem feijoada?',
    r: 'A feijoada completa é servida aos sábados e já vem pronta, com todos os acompanhamentos. Escolhendo a feijoada, você não precisa montar o restante da marmita.',
  },
  {
    p: 'Posso pedir os itens separados?',
    r: 'Sim. Pedir os itens da marmita em potes individuais tem acréscimo a partir de R$ 2,00 (valor da embalagem). Avise no campo de observações, no final do pedido.',
  },
  {
    p: 'Tem marmitex só de massa?',
    r: 'Temos, com valor diferenciado. Consulte pelo WhatsApp de segunda a sexta.',
  },
  {
    p: 'O que significa a folhinha 🌱?',
    r: 'Itens com a folhinha são opções vegetarianas, sem carne.',
  },
  {
    p: 'Quais as formas de pagamento?',
    r: 'Pix (a chave aparece na etapa de pagamento, com botão para copiar), dinheiro ou cartão na entrega.',
  },
  {
    p: 'Meus dados ficam salvos?',
    r: 'Se a opção "Lembrar meus dados neste aparelho" estiver marcada, seu nome, telefone e endereço ficam guardados só neste celular e aparecem preenchidos no próximo pedido. O celular também pode sugerir seu telefone automaticamente. Para apagar, toque em "Não é você? Limpar dados" ou desmarque a opção.',
  },
];

export default function FaqPedido() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed z-40 right-4 bg-green text-white font-bold text-sm px-4 py-2.5 rounded-full shadow-lg"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        ❓ Dúvidas
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setAberto(false)}>
          <div
            className="bg-white w-full sm:max-w-lg max-h-[85vh] overflow-auto rounded-t-2xl sm:rounded-2xl p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-green-dark">Dúvidas frequentes</h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="w-9 h-9 rounded-full bg-cream text-ink/60 font-bold"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {PERGUNTAS.map((item) => (
                <details key={item.p} className="bg-cream rounded-xl px-4 py-3 group">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex justify-between gap-2">
                    {item.p}
                    <span className="text-ink/40 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="text-sm text-ink/70 mt-2 leading-relaxed">{item.r}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
