import { infoDia } from './calendario';

export type Bairro = {
  id: string;
  nome: string;
  tipo: 'bairro' | 'faculdade' | 'empresa' | 'hospital' | 'hotel';
  taxa: number;
  a_partir_de: boolean;
  gratis_dias_uteis: boolean;
};

// Taxa de entrega do bairro na data informada (padrão: hoje, horário de Brasília).
// Bairros marcados como grátis em dias úteis só pagam em fim de semana e feriado.
export function taxaDoBairro(b: Bairro, data?: string): number {
  if (b.gratis_dias_uteis && !infoDia(data).especial) return 0;
  return Number(b.taxa);
}