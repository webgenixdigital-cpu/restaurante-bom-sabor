import { createClient } from '@/lib/supabase/server';
import ImprimirClient from './ImprimirClient';

export default async function ImprimirPedido({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: pedido } = await supabase.from('pedidos').select('*').eq('id', params.id).single();

  const { data: marmitas } = await supabase
    .from('pedido_marmitas')
    .select(`
      numero,
      tamanho:tamanho_id ( nome, preco ),
      arroz:arroz_id ( nome ),
      feijao:feijao_id ( nome ),
      salada:salada_id ( nome ),
      carne:carne_id ( nome ),
      extra:extra_id ( nome, preco ),
      pedido_marmita_guarnicoes ( item_id, itens_estoque ( nome ) ),
      pedido_marmita_extra_carnes ( quantidade, itens_estoque ( nome ) )
    `)
    .eq('pedido_id', params.id)
    .order('numero');

  if (!pedido) return <div className="p-8">Pedido não encontrado.</div>;

  return <ImprimirClient pedido={pedido} marmitas={marmitas || []} />;
}