import PagamentoPix from '@/components/PagamentoPix';
import type { EstadoMensalidade } from '@/lib/mensalidade';

export default function AvisoMensalidade({ mensalidade }: { mensalidade: EstadoMensalidade }) {
  const [a, m, d] = mensalidade.vencimento.split('-');
  const dias = mensalidade.diasRestantes;
  const quando = dias === 1 ? 'amanhã' : `em ${dias} dias`;

  return (
    <div className="no-print max-w-4xl mx-auto mb-4 bg-orange/10 border-2 border-orange rounded-2xl p-4 text-sm text-ink">
      <b>⚠️ A mensalidade do sistema vence {quando} ({d}/{m}/{a}).</b>{' '}
      Valor: R$ {mensalidade.valor.toFixed(2).replace('.', ',')}. Após o vencimento, o painel é
      bloqueado até a confirmação do pagamento.
      <details className="mt-2">
        <summary className="cursor-pointer font-bold text-orange-dark">Pagar agora (Pix)</summary>
        <div className="mt-3 max-w-sm">
          <PagamentoPix />
        </div>
      </details>
    </div>
  );
}