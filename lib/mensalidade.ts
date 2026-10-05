import { createAdminClient } from '@/lib/supabase/admin';
import { verificarEMarcarPago } from '@/lib/mensalidade-pagamento';

export const VALOR_MENSALIDADE = 136.9;
const DIA_VENCIMENTO = 25;
const DIAS_AVISO = 5;

export type EstadoMensalidade = {
  bloqueado: boolean;
  aviso: boolean;
  diasRestantes: number;
  competencia: string;
  vencimento: string; // AAAA-MM-DD
  valor: number;
};

// Data de hoje no horário de Brasília (AAAA-MM-DD).
// MENSALIDADE_DATA_TESTE só deve existir no .env.local, para simular datas.
function hojeBR(): string {
  return (
    process.env.MENSALIDADE_DATA_TESTE ||
    new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  );
}

function diasEntre(de: string, ate: string): number {
  const [ay, am, ad] = de.split('-').map(Number);
  const [by, bm, bd] = ate.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// Se der erro ao consultar o banco, NÃO bloqueia o restaurante (retorna null).
export async function estadoMensalidade(): Promise<EstadoMensalidade | null> {
  try {
    const supabase = createAdminClient();
    const hoje = hojeBR();
    const competencia = hoje.slice(0, 7);
    const vencimento = `${competencia}-${DIA_VENCIMENTO}`;

    // garante o registro do mês atual
    await supabase
      .from('mensalidades')
      .upsert(
        { competencia, vencimento, valor: VALOR_MENSALIDADE },
        { onConflict: 'competencia', ignoreDuplicates: true }
      );

    const { data, error } = await supabase
      .from('mensalidades')
      .select('id, status, competencia, vencimento, valor, pagbank_order_id')
      .eq('status', 'pendente')
      .order('vencimento');
    if (error) throw error;

    let pendentes = data || [];

    // Se já existe cobrança gerada, confere no PagBank se foi paga (o webhook é só reforço)
    for (const m of pendentes.filter((x) => x.pagbank_order_id)) {
      let pago = false;
      try {
        pago = await verificarEMarcarPago(m);
      } catch {
        pago = false;
      }
      if (pago) pendentes = pendentes.filter((x) => x.id !== m.id);
    }

    // qualquer mensalidade pendente já vencida bloqueia
    const vencida = pendentes.find((m) => m.vencimento <= hoje);
    if (vencida) {
      return {
        bloqueado: true, aviso: false, diasRestantes: 0,
        competencia: vencida.competencia, vencimento: vencida.vencimento, valor: Number(vencida.valor),
      };
    }

    // mês atual pendente e dentro da janela de aviso
    const atual = pendentes.find((m) => m.competencia === competencia);
    if (atual) {
      const dias = diasEntre(hoje, atual.vencimento);
      return {
        bloqueado: false, aviso: dias <= DIAS_AVISO, diasRestantes: dias,
        competencia: atual.competencia, vencimento: atual.vencimento, valor: Number(atual.valor),
      };
    }

    return null; // tudo pago
  } catch (e) {
    console.error('estadoMensalidade:', e);
    return null;
  }
}