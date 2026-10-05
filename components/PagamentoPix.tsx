'use client';

import { useEffect, useState } from 'react';

type Cobranca = { copiaECola: string; qrImagem: string; expira: string | null; valor: number };

export default function PagamentoPix() {
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pago, setPago] = useState(false);

  function liberar() {
    setPago(true);
    setTimeout(() => window.location.reload(), 1500);
  }

  async function gerar() {
    setCarregando(true);
    setErro(null);
    setDetalhe(null);
    try {
      const resp = await fetch('/api/mensalidade/cobranca', { method: 'POST' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(data.error || `Erro ${resp.status}`);
        setDetalhe(data.detalhe || null);
        return;
      }
      if (data.pago) {
        liberar();
        return;
      }
      setCobranca(data);
    } catch (e: any) {
      setErro(e.message || 'Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  // Enquanto o QR está na tela, confere o pagamento a cada 5 segundos
  useEffect(() => {
    if (!cobranca || pago) return;
    const t = setInterval(async () => {
      try {
        const resp = await fetch('/api/mensalidade/status', { cache: 'no-store' });
        const data = await resp.json();
        if (data.pago) liberar();
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 5000);
    return () => clearInterval(t);
  }, [cobranca, pago]);

  async function copiar() {
    if (!cobranca) return;
    try {
      await navigator.clipboard.writeText(cobranca.copiaECola);
      setCopiado(true);
    } catch {
      window.prompt('Copie o código Pix:', cobranca.copiaECola);
    }
    setTimeout(() => setCopiado(false), 2500);
  }

  if (pago) {
    return (
      <div className="bg-green/10 border border-green rounded-xl p-4 text-center text-sm text-green-dark font-bold">
        ✅ Pagamento confirmado! Liberando o painel…
      </div>
    );
  }

  return (
    <div className="text-left">
      {!cobranca && (
        <button
          onClick={gerar}
          disabled={carregando}
          className="w-full bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {carregando ? 'Gerando QR Code…' : 'Gerar QR Code Pix'}
        </button>
      )}

      {erro && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 break-words">
          <b>{erro}</b>
          {detalhe && <div className="mt-1 opacity-80">{detalhe}</div>}
        </div>
      )}

      {cobranca && (
        <div className="text-center">
          <img src={cobranca.qrImagem} alt="QR Code Pix" className="w-48 h-48 mx-auto" />
          <p className="text-xs text-ink/60 mt-2">Aponte a câmera do app do seu banco ou use o Pix copia e cola.</p>
          <div className="flex gap-2 mt-3">
            <input className="input flex-1 text-xs" readOnly value={cobranca.copiaECola} />
            <button
              type="button"
              onClick={copiar}
              className={`rounded-lg px-3 font-bold text-white text-sm ${copiado ? 'bg-green-dark' : 'bg-green'}`}
            >
              {copiado ? 'Copiado! ✓' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-orange-dark font-semibold mt-3">⏳ Aguardando o pagamento… a tela libera sozinha.</p>
          {cobranca.expira && (
            <p className="text-[11px] text-ink/40 mt-1">
              Válido até {new Date(cobranca.expira).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          )}
          <button onClick={gerar} disabled={carregando} className="mt-2 text-xs text-ink/50 underline">
            Gerar novamente
          </button>
        </div>
      )}
    </div>
  );
}