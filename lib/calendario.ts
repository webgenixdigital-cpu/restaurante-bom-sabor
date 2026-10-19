// Calendário da Cantina Bom Sabor (horário de Brasília).
// Dia "especial" = sábado, domingo ou feriado: taxa cheia e pedido só pelo site.

export type InfoDia = {
  data: string;            // AAAA-MM-DD
  diaSemana: number;       // 0 = domingo ... 6 = sábado
  feriado: string | null;  // nome do feriado, se houver
  especial: boolean;
};

// Hoje no horário de Brasília. NEXT_PUBLIC_DATA_TESTE só funciona fora da produção.
export function hojeBR(): string {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DATA_TESTE) {
    return process.env.NEXT_PUBLIC_DATA_TESTE;
  }
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function somarDias(data: string, dias: number): string {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Domingo de Páscoa (algoritmo gregoriano)
function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Feriados nacionais + Poços de Caldas + Carnaval e Corpus Christi
export function feriadosDoAno(ano: number): Record<string, string> {
  const fixos: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['05-13', 'São Benedito (Poços de Caldas)'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-06', 'Aniversário de Poços de Caldas'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  const lista: Record<string, string> = {};
  for (const [md, nome] of fixos) lista[`${ano}-${md}`] = nome;

  const p = pascoa(ano);
  lista[somarDias(p, -48)] = 'Carnaval';
  lista[somarDias(p, -47)] = 'Carnaval';
  lista[somarDias(p, -2)] = 'Sexta-feira Santa';
  lista[somarDias(p, 60)] = 'Corpus Christi';
  return lista;
}

export function infoDia(data: string = hojeBR()): InfoDia {
  const [y, m, d] = data.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const feriado = feriadosDoAno(y)[data] ?? null;
  return { data, diaSemana, feriado, especial: diaSemana === 0 || diaSemana === 6 || !!feriado };
}