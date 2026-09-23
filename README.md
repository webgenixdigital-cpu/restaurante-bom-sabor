# Cantina Bom Sabor — Cardápio + Admin

Evolução do projeto Marmitesse: agora com banco de dados, área administrativa
e gestão de pedidos em tempo real.

## O que tem aqui

- **`/`** — cardápio público. Mostra só os itens marcados como disponíveis
  para o dia atual (lidos do Supabase).
- **`/admin/login`** — login do admin (Supabase Auth).
- **`/admin/estoque`** — liga/desliga os itens disponíveis **hoje**, a partir
  do banco completo de itens da semana.
- **`/admin/pedidos`** — lista de pedidos em tempo real, com status e botão
  de impressão térmica.
- **`/admin/pedidos/[id]/imprimir`** — recibo formatado para bobina 80mm,
  dispara a impressão automaticamente ao abrir.

## Setup

### 1. Crie o projeto no Supabase
Em [supabase.com](https://supabase.com) → New Project.

### 2. Rode o schema
No **SQL Editor** do projeto, rode nesta ordem:
1. `supabase/schema.sql`
2. `supabase/seed.sql` (ajuste nomes/preços antes, se necessário)

### 3. Crie o usuário admin
No Supabase: **Authentication → Users → Add user** (e-mail + senha do
restaurante). Não existe cadastro público — só você cria os acessos.

### 4. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha com a URL e a `anon key` do seu projeto
(**Project Settings → API** no Supabase).

### 5. Rode local
```bash
npm install
npm run dev
```

## Deploy na Vercel

Igual ao que já fizemos com o Marmitesse — importe o repositório do GitHub
na Vercel. A única diferença é que agora **precisa configurar as variáveis
de ambiente lá também**: Settings → Environment Variables → adicione as
mesmas do `.env.local`.

## Sobre a integração com iFood

O iFood tem uma **Partner API** oficial que permite:
- Sincronizar cardápio (o admin daqui atualizaria o iFood automaticamente)
- Receber pedidos do iFood direto nesta mesma tela de `/admin/pedidos`
  (a coluna `origem` na tabela `pedidos` já está preparada pra isso —
  pedidos do iFood chegariam com `origem = 'ifood'`)

**O que falta pra isso funcionar:** o restaurante precisa ser aprovado
como parceiro de integração pelo iFood e receber `client_id` /
`client_secret`. Isso é um processo comercial do lado do iFood, fora do
nosso controle. Assim que tiverem essas credenciais, a integração se
resume a:
1. Um endpoint (`/api/ifood/webhook`) que recebe os pedidos do iFood e
   grava na mesma tabela `pedidos` — aparecem automaticamente na lista.
2. Uma rotina que, ao salvar em `disponibilidade_dia`, também chama a
   API de catálogo do iFood pra espelhar a mudança.

Posso construir essas duas peças assim que tiverem o acesso liberado.

## Impressão térmica

A tela de impressão usa o diálogo de impressão nativo do navegador,
formatado para 80mm. Funciona com qualquer impressora térmica que tenha
driver instalado no Windows/computador do restaurante — sem precisar de
software adicional. Se no dia a dia quiserem impressão 100% automática
(sem precisar clicar em nada), dá pra evoluir depois com um pequeno
agente local (ex: QZ Tray) — é um passo à parte, opcional.

## O que ainda falta adaptar

- **Visual**: esta versão prioriza a arquitetura (banco, admin, pedidos).
  O estilo visual do cardápio público pode ser portado de volta do HTML
  original do Marmitesse — cores, fontes e o rodapé Genix Catalog.
- **Nome "Cantina Bom Sabor" nos textos**: ajustar rodapé, mensagens de WhatsApp
  e branding conforme o material final do restaurante.
