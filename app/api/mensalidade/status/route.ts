import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('mensalidades').select('*').eq('status', 'pendente').order('vencimento').limit(1);
  const m = data?.[0];
  if (!m) return NextResponse.json({ pago: true });

  return NextResponse.json({ pago: await verificarEMarcarPago(m) });
}