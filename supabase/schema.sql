-- ============================================================
-- CANTINA BOM SABOR — Schema Supabase
-- ============================================================
-- Rode este arquivo no SQL Editor do seu projeto Supabase.

-- ---------- 1. CATEGORIAS ----------
-- Ex: tamanho, arroz, feijao, guarnicao, salada, carne, extra
create table categorias (
  id text primary key,          -- 'tamanho', 'arroz', 'feijao', 'guarnicao', 'salada', 'carne', 'extra'
  nome text not null,
  tipo_selecao text not null check (tipo_selecao in ('unica','multipla')),
  qtd_obrigatoria int default 1,  -- ex: guarnicoes = 3
  ordem int not null default 0
);

-- ---------- 2. ITENS DO ESTOQUE (banco completo da semana) ----------
create table itens_estoque (
  id uuid primary key default gen_random_uuid(),
  categoria_id text not null references categorias(id),
  nome text not null,
  emoji text,
  preco numeric(10,2) not null default 0,
  ativo_cadastro boolean not null default true, -- existe no catálogo geral (não é o "do dia")
  ordem int default 0,
  created_at timestamptz default now()
);

-- ---------- 3. DISPONIBILIDADE DO DIA ----------
-- Uma linha por item por dia — o admin liga/desliga aqui.
create table disponibilidade_dia (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens_estoque(id) on delete cascade,
  data date not null default current_date,
  disponivel boolean not null default true,
  unique (item_id, data)
);

-- ---------- 4. PEDIDOS ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo serial,                         -- número sequencial curto pra exibir/imprimir
  nome_cliente text not null,
  modo text not null check (modo in ('retirada','entrega')),
  endereco text,
  forma_pagamento text not null,
  status text not null default 'novo' check (status in ('novo','preparando','pronto','entregue','cancelado')),
  total numeric(10,2) not null default 0,
  origem text not null default 'site' check (origem in ('site','ifood')),
  observacoes text,
  impresso boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- 5. MARMITAS DO PEDIDO ----------
-- Um pedido pode ter N marmitas (iguais ou diferentes)
create table pedido_marmitas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  numero int not null,           -- marmita 1, 2, 3...
  tamanho_id uuid references itens_estoque(id),
  arroz_id uuid references itens_estoque(id),
  feijao_id uuid references itens_estoque(id),
  salada_id uuid references itens_estoque(id),
  carne_id uuid references itens_estoque(id),
  extra_id uuid references itens_estoque(id)
);

-- ---------- 6. GUARNIÇÕES POR MARMITA (multi-seleção) ----------
create table pedido_marmita_guarnicoes (
  id uuid primary key default gen_random_uuid(),
  pedido_marmita_id uuid not null references pedido_marmitas(id) on delete cascade,
  item_id uuid not null references itens_estoque(id)
);

-- ---------- 7. ADMIN USERS ----------
-- Usa o Supabase Auth (auth.users). Esta tabela só guarda o vínculo/perfil.
create table admin_perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  created_at timestamptz default now()
);

-- ============================================================
-- SEED — categorias fixas
-- ============================================================
insert into categorias (id, nome, tipo_selecao, qtd_obrigatoria, ordem) values
  ('tamanho',   'Tamanho',    'unica',    1, 1),
  ('arroz',     'Arroz',      'unica',    1, 2),
  ('feijao',    'Feijão',     'unica',    1, 3),
  ('guarnicao', 'Guarnições', 'multipla', 3, 4),
  ('salada',    'Salada',     'unica',    1, 5),
  ('carne',     'Carne',      'unica',    1, 6),
  ('extra',     'Adicional',  'unica',    1, 7);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table itens_estoque enable row level security;
alter table disponibilidade_dia enable row level security;
alter table pedidos enable row level security;
alter table pedido_marmitas enable row level security;
alter table pedido_marmita_guarnicoes enable row level security;
alter table admin_perfis enable row level security;

-- Leitura pública do estoque e disponibilidade (o cardápio do site precisa ler sem login)
create policy "public read itens_estoque" on itens_estoque for select using (true);
create policy "public read disponibilidade_dia" on disponibilidade_dia for select using (true);

-- Qualquer pessoa pode CRIAR um pedido (cliente fazendo o pedido pelo site)
create policy "public insert pedidos" on pedidos for insert with check (true);
create policy "public insert pedido_marmitas" on pedido_marmitas for insert with check (true);
create policy "public insert pedido_marmita_guarnicoes" on pedido_marmita_guarnicoes for insert with check (true);

-- Só admin autenticado pode LER pedidos e ALTERAR estoque/disponibilidade/status
create policy "admin read pedidos" on pedidos for select using (auth.role() = 'authenticated');
create policy "admin update pedidos" on pedidos for update using (auth.role() = 'authenticated');
create policy "admin read pedido_marmitas" on pedido_marmitas for select using (auth.role() = 'authenticated');
create policy "admin read pedido_marmita_guarnicoes" on pedido_marmita_guarnicoes for select using (auth.role() = 'authenticated');

create policy "admin write itens_estoque" on itens_estoque for all using (auth.role() = 'authenticated');
create policy "admin write disponibilidade_dia" on disponibilidade_dia for all using (auth.role() = 'authenticated');

create policy "admin read admin_perfis" on admin_perfis for select using (auth.uid() = id);

-- Realtime (pra lista de pedidos atualizar sozinha no admin)
alter publication supabase_realtime add table pedidos;
