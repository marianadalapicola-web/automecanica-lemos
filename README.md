# Automecânica Lemos — Sistema de Gestão

Sistema web completo de gestão para a **Automecânica Lemos**: notas fiscais, cotações
de peças e serviços, clientes, veículos, fornecedores, relatórios e configurações da
oficina. Construído com React + TypeScript + Tailwind CSS no front-end e Supabase
(PostgreSQL + Auth) como banco de dados e autenticação.

> Este sistema **não emite documentos fiscais oficiais pela SEFAZ**. Os PDFs gerados
> são documentos internos da oficina (nota de serviço e cotação), sem valor fiscal.

## Stack

- **Front-end:** React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Banco de dados / Auth:** Supabase (PostgreSQL + Row Level Security)
- **PDF:** jsPDF + jspdf-autotable (documentos próprios, com identidade visual vermelho/preto)
- **Gráficos:** Recharts

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor** do projeto, cole e execute todo o conteúdo do arquivo
   [`supabase/schema.sql`](./supabase/schema.sql). Ele cria todas as tabelas,
   relacionamentos, numeração automática de cotações, políticas de segurança
   (RLS) e a linha inicial de configurações com o nome "AUTOMECÂNICA LEMOS".
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

## 2. Configurar o projeto local

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-ANON-PUBLICA
```

Instale as dependências e rode o projeto:

```bash
npm install
npm run dev
```

## 3. Criar o primeiro usuário (administrador)

O primeiro usuário criado no sistema é automaticamente promovido a
**Administrador** (os seguintes entram como Funcionário). Duas formas de criar:

- **Pela tela de login:** ainda não existe um usuário? No Supabase, vá em
  **Authentication → Users → Add user**, cadastre e-mail/senha e confirme o
  e-mail manualmente (ou desative a confirmação de e-mail em
  **Authentication → Providers → Email** para testes). Depois faça login
  normalmente no sistema.
- **Pelo próprio sistema:** após o primeiro admin existir, use
  **Configurações → Usuários do Sistema → Novo Usuário** para cadastrar a
  equipe, definindo o nível de acesso (Administrador ou Funcionário).

## 4. Níveis de acesso

- **Administrador:** acesso completo, incluindo exclusão de registros,
  Configurações da oficina e gestão de usuários.
- **Funcionário:** cadastra e consulta notas, clientes, veículos, fornecedores
  e cotações; não acessa Configurações nem exclui registros.

## 5. Fluxo principal do sistema

```
Login → Dashboard → Cliente → Veículo → Cotação → Fornecedor (comparação de preços)
     → Aprovação da Cotação → Conversão em Nota Fiscal → PDF
```

- Cotações têm numeração automática (`COT-AAAA-NNNN`) e status
  (rascunho, enviada, aprovada, recusada, expirada).
- Ao aprovar uma cotação, o botão **Converter em Nota** cria uma nova nota
  fiscal copiando cliente, veículo, itens, quantidades e valores — a cotação
  original é preservada e fica vinculada à nota gerada.
- Os PDFs (nota e cotação) usam sempre os dados cadastrados em
  **Configurações** (nome, CNPJ, contatos, endereço) e têm layouts distintos
  entre si, com cabeçalho, rodapé com "Página X de Y" e suporte a múltiplas
  páginas.

## 6. Scripts

```bash
npm run dev        # ambiente de desenvolvimento
npm run build       # build de produção (verifica tipos + gera dist/)
npm run preview     # pré-visualiza o build de produção
npm run lint         # ESLint
npm run typecheck   # apenas checagem de tipos
```

## 7. Deploy (Vercel ou Netlify)

O repositório já vem com `vercel.json` e `netlify.toml` prontos (build,
diretório de saída e rewrite para SPA — necessário porque o React Router usa
rotas no navegador).

**Vercel:**
1. Em [vercel.com/new](https://vercel.com/new), importe o repositório
   `automecanica-lemos` (branch `claude/automecamica-lemos-system-bjxiyu`
   ou a branch principal, conforme onde o código estiver).
2. O framework "Vite" é detectado automaticamente (build `npm run build`,
   output `dist`).
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. A cada novo push na branch conectada, o Vercel republica
   automaticamente.

**Netlify:** mesmo fluxo — "Add new site → Import an existing project",
selecione o repositório, confirme build `npm run build` / publish `dist`
(já configurado em `netlify.toml`) e adicione as mesmas duas variáveis de
ambiente em **Site settings → Environment variables**.

> As mesmas duas variáveis (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
> do seu `.env` local são as que devem ser cadastradas na plataforma de
> deploy — são valores públicos (chave anônima, protegida por RLS), não
> segredos de servidor.

## 8. Estrutura do projeto

```
src/
  components/     Layout, formulários reutilizáveis, seletores (cliente/veículo), UI base
  contexts/       Autenticação (AuthContext) e notificações (ToastContext)
  lib/api/        Camada de acesso ao Supabase por domínio (clients, vehicles, quotes, notes...)
  lib/            Cálculos (subtotal/desconto/total), formatação (moeda, data, máscaras)
  pdf/            Geração dos PDFs de Nota Fiscal e Cotação
  pages/          Telas do sistema, organizadas por módulo
supabase/
  schema.sql      Schema completo do banco (tabelas, RLS, numeração automática)
```
