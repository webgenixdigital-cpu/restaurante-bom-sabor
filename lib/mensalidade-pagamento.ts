import { createAdminClient } from '@/lib/supabase/admin';
import { pagbankFetch } from '@/lib/pagbank';

type Linha = { id: string; status: string; valor: number | string; pagbank_order_id: string | null };

// Consulta o pedido direto no PagBank e, se estiver pago, marca a mensalidade como paga.
// Nunca confia em dados recebidos de fora: a confirmação vem sempre desta consulta autenticada.
export async function verificarEMarcarPago(m: Linha): Promise<boolean> {
  if (m.status === 'pago') return true;
  if (!m.pagbank_order_id) return false;

  const r = await pagbankFetch(`/orders/${m.pagbank_order_id}`, { method: 'GET' });
  if (!r.ok) {
    console.error('PagBank consultar pedido:', r.status, JSON.stringify(r.corpo));
    return false;
  }

  const charge = (r.corpo?.charges || []).find((c: any) => c?.status === 'PAID');
  if (!charge) return false;

  // confere o valor pago
  const esperado = Math.round(Number(m.valor) * 100);
  const pago = Number(charge.amount?.summary?.paid ?? charge.amount?.value ?? 0);
  if (pago < esperado) {
    console.error('Valor pago menor que o esperado:', pago, esperado);
    return false;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('mensalidades')
    .update({ status: 'pago', pago_em: charge.paid_at ?? new Date().toISOString() })
    .eq('id', m.id)
    .eq('status', 'pendente');
  if (error) {
    console.error('Erro ao marcar mensalidade como paga:', error.message);
    return false;
  }
  return true;
}