import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';
import { pagbankFetch } from '@/lib/pagbank';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const dynamic = 'force-dynamic';

function resumo(order: any) {
  const charge = order?.charges?.[0];
  return {
    status: charge?.status as string | undefined,
    texto: charge?.qr_code?.text as string | undefined,
    expira: (charge?.payment_method?.pix?.expiration_date as string | undefined) ?? null,
    chargeId: charge?.id as string | undefined,
  };
}

async function respostaQr(texto: string, expira: string | null, valor: number) {
  const qrImagem = await QRCode.toDataURL(texto, { margin: 1, width: 320 });
  return NextResponse.json({ copiaECola: texto, qrImagem, expira, valor });
}

export async function POST() {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  if (!process.env.PAGBANK_TOKEN) {
    return NextResponse.json({ error: 'PAGBANK_TOKEN não configurado no servidor.' }, { status: 500 });
  }
  const faltando = ['MENSALIDADE_PAGADOR_NOME', 'MENSALIDADE_PAGADOR_EMAIL', 'MENSALIDADE_PAGADOR_TAX_ID']
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
  const valorCentavos = Math.round(valor * 100);

  if (m.pagbank_order_id) {
    // se já foi pago, libera em vez de gerar outro QR
    if (await verificarEMarcarPago(m)) return NextResponse.json({ pago: true });

    // reaproveita o QR ainda válido
    const r = await pagbankFetch(`/orders/${m.pagbank_order_id}`, { method: 'GET' });
    if (r.ok) {
      const s = resumo(r.corpo);
      const valido = !s.expira || new Date(s.expira).getTime() > Date.now();
      if (s.status === 'WAITING' && s.texto && valido) return respostaQr(s.texto, s.expira, valor);
    }
  }

  // cria uma cobrança nova (validade de 24 horas)
  const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const referencia = `mens-${m.competencia}-${Date.now().toString(36)}`;
  const descricao = `Mensalidade do sistema ${m.competencia}`;
  const appUrl = process.env.APP_URL;

  const body = {
    reference_id: referencia,
    customer: {
      name: process.env.MENSALIDADE_PAGADOR_NOME,
      email: process.env.MENSALIDADE_PAGADOR_EMAIL,
      tax_id: String(process.env.MENSALIDADE_PAGADOR_TAX_ID).replace(/\D/g, ''),
    },
    items: [{ reference_id: referencia, name: descricao, quantity: 1, unit_amount: valorCentavos }],
    charges: [
      {
        reference_id: referencia,
        description: descricao,
        amount: { value: valorCentavos, currency: 'BRL' },
        payment_method: { type: 'PIX', pix: { expiration_date: expiracao } },
      },
    ],
    ...(appUrl && !appUrl.includes('localhost')
      ? { notification_urls: [`${appUrl.replace(/\/$/, '')}/api/mensalidade/webhook`] }
      : {}),
  };

  const r = await pagbankFetch('/orders', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) {
    console.error('PagBank criar pedido:', r.status, JSON.stringify(r.corpo));
    return NextResponse.json(
      { error: 'Não foi possível gerar o QR Code agora.', detalhe: `PagBank ${r.status}: ${JSON.stringify(r.corpo)}` },
      { status: 502 }
    );
  }

  const s = resumo(r.corpo);
  if (s.status === 'DECLINED' || !s.texto) {
    console.error('PagBank cobrança sem QR:', JSON.stringify(r.corpo));
    return NextResponse.json(
      { error: 'O PagBank não gerou o QR Code.', detalhe: `Status: ${s.status ?? 'desconhecido'}` },
      { status: 502 }
    );
  }

  await supabase
    .from('mensalidades')
    .update({ pagbank_order_id: r.corpo.id, pagbank_charge_id: s.chargeId ?? null })
    .eq('id', m.id);

  return respostaQr(s.texto, s.expira, valor);
}