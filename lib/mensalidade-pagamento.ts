import { createAdminClient } from '@/lib/supabase/admin';
import { asaas } from '@/lib/asaas';

type Linha = { id: string; status: string; valor: number | string; asaas_payment_id: string | null };

const PAGO_ASAAS = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];

// Consulta a cobrança direto no Asaas e, se estiver paga, marca a mensalidade como paga.
// A confirmação vem sempre desta consulta autenticada, nunca do corpo do webhook.
export async function verificarEMarcarPago(m: Linha): Promise<boolean> {
  if (m.status === 'pago') return true;
  if (!m.asaas_payment_id) return false;

  const p = await asaas<{ status: string; value: number; paymentDate?: string; clientPaymentDate?: string }>(
    `/payments/${m.asaas_payment_id}`
  );
  if (!PAGO_ASAAS.includes(p.status)) return false;

  // confere o valor pago
  if (Math.round(Number(p.value) * 100) < Math.round(Number(m.valor) * 100)) {
    console.error('Valor pago menor que o esperado:', p.value, m.valor);
    return false;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('mensalidades')
    .update({ status: 'pago', pago_em: p.paymentDate || p.clientPaymentDate || new Date().toISOString() })
    .eq('id', m.id)
    .eq('status', 'pendente');
  if (error) {
    console.error('Erro ao marcar mensalidade como paga:', error.message);
    return false;
  }
  return true;
}