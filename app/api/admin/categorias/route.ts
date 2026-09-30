import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usuarioAdmin } from '@/lib/supabase/usuario-admin';

function gerarSlug(nome: string) {
  return (
    nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'categoria'
  );
}

// Lista categorias ativas
export async function GET() {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('categorias').select('*').eq('ativo', true).order('ordem');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Cria categoria nova (sempre avulsa, aparece na etapa final do pedido)
export async function POST(req: Request) {
  if (!(await usuarioAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const nome = String(body.nome || '').trim();
  if (nome.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: existentes } = await supabase.from('categorias').select('id, ordem');

  const ids = new Set((existentes || []).map((c) => c.id));
  const base = gerarSlug(nome);
  let id = base;
  let n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;

  const ordem = Math.max(0, ...(existentes || []).map((c) => c.ordem)) + 1;

  const { data, error } = await supabase
    .from('categorias')
    .insert({
      id, nome, ordem,
      tipo_selecao: 'multipla',
      qtd_obrigatoria: null,
      ativo: true,
      sistema: false,
      contexto: 'avulso',
      tem_preco: body.tem_preco !== false,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}