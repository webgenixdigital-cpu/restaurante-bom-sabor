export type CategoriaId = 'tamanho' | 'arroz' | 'feijao' | 'guarnicao' | 'salada' | 'carne' | 'extra';

export interface ItemEstoque {
  id: string;
  categoria_id: CategoriaId;
  nome: string;
  emoji: string | null;
  preco: number;
  ativo_cadastro: boolean;
  ordem: number;
  vegetariano: boolean;
}

export interface DisponibilidadeDia {
  id: string;
  item_id: string;
  data: string;
  disponivel: boolean;
}

export interface ItemDisponivel extends ItemEstoque {
  disponivel: boolean;
}

export interface ExtraCarneEscolha {
  carne: ItemEstoque;
  quantidade: number;
}

export interface ExtraConfig {
  tipo: ItemEstoque; // "Carne extra" ou "Carne extra à parmegiana"
  escolhas: ExtraCarneEscolha[];
}

export interface MarmitaConfig {
  numero: number;
  tamanho: ItemEstoque;
  arroz: ItemEstoque | null;
  feijao: ItemEstoque | null;
  guarnicoes: ItemEstoque[];
  salada: ItemEstoque | null;
  carne: ItemEstoque | null;
  extra: ExtraConfig | null;
}

export interface NovoPedidoPayload {
  nome_cliente: string;
  modo: 'retirada' | 'entrega';
  endereco?: string;
  forma_pagamento: string;
  total: number;
  observacoes?: string;
  marmitas: MarmitaConfig[];
}

export interface Pedido {
  id: string;
  codigo: number;
  nome_cliente: string;
  modo: 'retirada' | 'entrega';
  endereco: string | null;
  forma_pagamento: string;
  status: 'novo' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';
  total: number;
  origem: 'site' | 'ifood';
  observacoes: string | null;
  impresso: boolean;
  created_at: string;
}