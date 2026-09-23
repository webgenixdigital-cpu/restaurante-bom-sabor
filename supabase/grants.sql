-- ============================================================
-- GRANTS — permissões da API de Dados (exigidas pelo Supabase
-- para tabelas criadas a partir de 30/10/2026).
-- Rode logo após o schema.sql e as migrações, em projetos novos.
-- As políticas RLS continuam controlando o acesso linha a linha.
-- ============================================================

grant select on public.categorias, public.itens_estoque, public.disponibilidade_dia to anon;

grant select, insert, update, delete on
  public.categorias, public.itens_estoque, public.disponibilidade_dia,
  public.pedidos, public.pedido_marmitas, public.pedido_marmita_guarnicoes,
  public.pedido_marmita_extra_carnes, public.pedido_itens_avulsos, public.admin_perfis
to authenticated, service_role;