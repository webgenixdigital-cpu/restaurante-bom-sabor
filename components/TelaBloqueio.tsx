import LogoutButton from '@/components/LogoutButton';
import PagamentoPix from '@/components/PagamentoPix';
import type { EstadoMensalidade } from '@/lib/mensalidade';

export default function TelaBloqueio({ mensalidade }: { mensalidade: EstadoMensalidade }) {
  const [a, m, d] = mensalidade.vencimento.split('-');

  const suporte = (process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP || '').replace(/\D/g, '');
  const texto = encodeURIComponent(
    `Olá! Sou da Cantina Bom Sabor e preciso de ajuda com o pagamento da mensalidade do sistema (vencimento ${d}/${m}/${a}).`
  );

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-green-dark mb-2">Mensalidade em aberto</h1>
        <p className="text-sm text-ink/60 mb-4">
          O acesso ao painel está bloqueado até a confirmação do pagamento da mensalidade do sistema.
          O cardápio e os pedidos dos clientes no site continuam funcionando normalmente.
        </p>
        <div className="bg-cream rounded-xl p-3 mb-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-ink/60">Vencimento</span>
            <b>{d}/{m}/{a}</b>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink/60">Valor</span>
            <b>R$ {mensalidade.valor.toFixed(2).replace('.', ',')}</b>
          </div>
        </div>
        <div className="mb-4">
          <PagamentoPix />
        </div>
        {suporte && (
          <a
            href={`https://wa.me/${suporte}?text=${texto}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-3 border-2 border-[#25D366] text-[#128C4A] font-bold text-sm py-2.5 rounded-xl hover:bg-[#25D366]/10 transition"
          >
            💬 Problemas com o pagamento? Fale com o suporte
          </a>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}