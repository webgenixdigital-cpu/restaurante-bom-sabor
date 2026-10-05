import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const dynamic = 'force-dynamic';

// Rota pública (o PagBank chama sem login). É segura porque o conteúdo recebido só serve
// para localizar a mensalidade: quem confirma o pagamento é a consulta autenticada ao PagBank.
export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const candidatos: string[] = [
    body?.id,
    ...(body?.charges || []).flatMap((c: any) => [c?.id, c?.metadata?.ps_order_id]),
  ].filter((x: any) => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x));

  if (candidatos.length === 0) return NextResponse.json({ ok: true });

  const lista = candidatos.join(',');
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('mensalidades')
    .select('*')
    .eq('status', 'pendente')
    .or(`pagbank_order_id.in.(${lista}),pagbank_charge_id.in.(${lista})`);

  for (const m of data || []) await verificarEMarcarPago(m);

  return NextResponse.json({ ok: true });
}