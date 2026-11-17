import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';
import { asaas } from '@/lib/asaas';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const dynamic = 'force-dynamic';

type QrAsaas = { encodedImage: string; payload: string; expirationDate?: string };

function hojeBR() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function respostaQr(qr: QrAsaas, valor: number) {
  return NextResponse.json({
    copiaECola: qr.payload,
    qrImagem: `data:image/png;base64,${qr.encodedImage}`,
    expira: qr.expirationDate ?? null,
    valor,
  });
}

export async function POST() {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const faltando = ['ASAAS_API_URL', 'ASAAS_API_KEY', 'MENSALIDADE_PAGADOR_NOME', 'MENSALIDADE_PAGADOR_EMAIL', 'MENSALIDADE_PAGADOR_TAX_ID']
    .filter((k) => !process.env[k]);
  if (faltando.length) {
    return NextResponse.json({ error: `Variáveis ausentes no servidor: ${faltando.join(', ')}` }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: pendentes } = await supabase
    .from('mensalidades').select('*').eq('status', 'pendente').order('vencimento').limit(1);
  const m = pendentes?.[0];
  if (!m) return NextResponse.json({ pago: true });

  const valor = Number(m.valor);

  try {
    if (m.asaas_payment_id) {
      // se já foi pago, libera em vez de mostrar o QR
      if (await verificarEMarcarPago(m)) return NextResponse.json({ pago: true });

      // reaproveita a cobrança ainda em aberto
      const p = await asaas<{ status: string }>(`/payments/${m.asaas_payment_id}`);
      if (p.status === 'PENDING' || p.status === 'OVERDUE') {
        const qr = await asaas<QrAsaas>(`/payments/${m.asaas_payment_id}/pixQrCode`);
        return respostaQr(qr, valor);
      }
    }

    // cliente do restaurante no Asaas (criado uma vez só)
    const { data: cfg } = await supabase.from('configuracoes').select('valor').eq('chave', 'asaas_customer_id').maybeSingle();
    let customerId = cfg?.valor as string | undefined;
    if (!customerId) {
      const c = await asaas<{ id: string }>('/customers', {
        method: 'POST',
        body: {
          name: process.env.MENSALIDADE_PAGADOR_NOME,
          email: process.env.MENSALIDADE_PAGADOR_EMAIL,
          cpfCnpj: String(process.env.MENSALIDADE_PAGADOR_TAX_ID).replace(/\D/g, ''),
          externalReference: 'bomsabor',
        },
      });
      customerId = c.id;
      await supabase.from('configuracoes').upsert({ chave: 'asaas_customer_id', valor: customerId });
    }

    // o Asaas não aceita vencimento no passado: se já venceu, usa hoje
    const hoje = hojeBR();
    const dueDate = m.vencimento < hoje ? hoje : m.vencimento;

    const p = await asaas<{ id: string; invoiceUrl: string }>('/payments', {
      method: 'POST',
      body: {
        customer: customerId,
        billingType: 'PIX',
        value: valor,
        dueDate,
        description: `Mensalidade do sistema ${m.competencia}`,
        externalReference: `bomsabor:${m.competencia}`,
      },
    });
    const qr = await asaas<QrAsaas>(`/payments/${p.id}/pixQrCode`);

    await supabase
      .from('mensalidades')
      .update({ asaas_payment_id: p.id, invoice_url: p.invoiceUrl, pix_payload: qr.payload, pix_qrcode: qr.encodedImage })
      .eq('id', m.id);

     return respostaQr(qr, valor);
  } catch (e: any) {
    console.error('Asaas mensalidade:', e);
    return NextResponse.json(
      { error: 'Não foi possível gerar o QR Code agora.', detalhe: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}