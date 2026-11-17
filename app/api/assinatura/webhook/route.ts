// POST /api/assinatura/webhook — aviso do Asaas repassado pelo webhook do Genix Agenda
import { timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const dynamic = 'force-dynamic';
const PAGO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'];

function tokenOk(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ received: true }); }

  const pay = body?.payment;
  if (!pay?.externalReference?.startsWith('bomsabor:')) return NextResponse.json({ received: true, ignored: true });

  const admin = createAdminClient();
  const eventoId = body.id ?? `${body.event}:${pay.id}`;
  const { error: dup } = await admin.from('asaas_eventos').insert({ id: eventoId, evento: body.event, payment_id: pay.id });
  if (dup) return NextResponse.json({ received: true, duplicate: true });

  try {
    const { data: m } = await admin
      .from('mensalidades')
      .select('id, status, valor, asaas_payment_id')
      .eq('asaas_payment_id', pay.id)
      .maybeSingle();

    let resultado = 'ignorado';
    if (!m) resultado = 'mensalidade não encontrada';
    else if (PAGO.includes(body.event)) resultado = (await verificarEMarcarPago(m)) ? 'pago' : 'não confirmado';
    else if (body.event === 'PAYMENT_DELETED' && m.status === 'pendente') {
      // cobrança apagada no Asaas: libera para gerar outra
      await admin
        .from('mensalidades')
        .update({ asaas_payment_id: null, invoice_url: null, pix_payload: null, pix_qrcode: null })
        .eq('id', m.id);
      resultado = 'cobrança removida';
    }

    await admin.from('asaas_eventos').update({ resultado }).eq('id', eventoId);
    return NextResponse.json({ received: true, resultado });
  } catch (e) {
    await admin.from('asaas_eventos').delete().eq('id', eventoId); // Asaas tenta de novo
    console.error('Webhook Asaas Bom Sabor:', e);
    return NextResponse.json({ error: 'retry' }, { status: 500 });
  }
}