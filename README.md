# ✧ Glossy Money

> your money, your dreams ♡

Aplicação web de finanças pessoais com estética Y2K (rosa, lilás, cromado), feita em **React + TypeScript + Vite**, gráficos com **Recharts** e autenticação/banco remoto com **Supabase**. Funciona no celular e no computador.

## Funcionalidades

- **Dashboard**: saudação, seletor de mês, saldo total, receitas, despesas, pendentes, reservado em metas, % da renda poupada, gráfico receitas × despesas, gastos por categoria, histórico, transações recentes, próximos vencimentos, resumo de cartões, metas e a área **Money check ✧** (maior despesa, orçamento restante, evolução mensal, taxa de poupança, vencidos).
- **Transações**: criar/editar/excluir, receita/despesa/transferência, pesquisa, filtros (mês, período, tipo, categoria, conta/cartão, status), ordenação, paginação e exportação CSV. Status pago/pendente/vencido.
- **Contas**: corrente, digital, dinheiro, poupança, outras; saldo inicial + data de início; saldo calculado; extrato com saldo corrente; saldo em data anterior; arquivar.
- **Cartões**: visual de cartão digital com temas; limite usado/disponível, fatura atual e anterior, próximo vencimento, compras recentes, faturas por mês e pagamento de fatura.
- **Parcelamentos**: parcelas geradas automaticamente nas faturas corretas, andamento (paga/pendente/atual), correção manual da fatura.
- **Orçamento**: limite geral, por categoria e meta de economia; barras com alertas; copiar do mês anterior.
- **Metas**: valor desejado, data, prioridade, cor/ícone, contribuições e resgates com histórico.
- **Relatórios**: receitas/despesas, categorias, evolução dos saldos, fixas × variáveis, gastos por cartão, parcelas futuras, planejado × realizado, evolução das metas — todos com visão em tabela; intervalos 3/6/12 meses, ano ou personalizado.
- **Configurações**: nome, tema (Pérola, Lilás, Meia-noite), primeiro dia do mês financeiro, notificações, categorias editáveis (fixa/variável), exportar CSV, backup JSON, restaurar com validação, excluir dados, sair e excluir conta.
- Acessibilidade: mobile-first, alvos de toque ≥ 44 px, foco visível, diálogos com teclado, confirmação antes de ações destrutivas, gráficos com paleta testada para daltonismo + tabela, respeito a `prefers-reduced-motion`.

## Regras de contabilização

Documentadas também em `src/lib/finance.ts` e usadas igualmente no dashboard, orçamento e relatórios:

1. Receitas e despesas contam pela **data de competência**, pagas ou não.
2. **Transferências** movem saldo entre contas e nunca contam como receita/despesa.
3. **Compra no cartão** é despesa na data da compra. Parcelada em N vezes: a parcela *k* tem competência = data da compra + (k−1) meses e é cobrada na fatura (1ª fatura + k−1). Cada parcela conta **uma única vez**; centavos da divisão ficam na 1ª parcela.
4. **Fatura**: compras **antes** do dia de fechamento entram na fatura que fecha naquele mês; no dia do fechamento ou depois, na seguinte. A fatura é identificada pelo mês de **vencimento** (se vencimento ≤ fechamento, vence no mês seguinte ao fechamento). Pode ser corrigida manualmente por compra/parcela.
5. **Pagamento de fatura** é liquidação de obrigação: debita a conta e libera limite, mas **não** é despesa.
6. **Saldo** = saldo inicial + movimentos efetivados (pagos) até a data. Compras no cartão só afetam a conta quando a fatura é paga.
7. **Metas** reservam dinheiro já existente em uma conta: não mudam o saldo total nem viram despesa; não é possível reservar mais que o saldo livre.

## Rodando localmente

```bash
npm install
npm run dev          # http://localhost:5173
```

Sem as variáveis do Supabase o app abre e oferece apenas o **modo demonstração** (identificado em todas as telas), que salva os dados somente no navegador.

## Conectando o Supabase (login + sincronização entre dispositivos)

1. Crie um projeto gratuito em <https://supabase.com>.
2. No painel: **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**. Isso cria a tabela `glossy_user_data`, as regras **RLS** (cada usuário só acessa a própria linha), o controle de versão contra sobrescritas entre dispositivos e a função `delete_my_account`.
3. Em **Authentication → URL Configuration**, defina a *Site URL* com o endereço onde o app será publicado (ex.: `https://SEU-USUARIO.github.io/automecanica-lemos/`) e adicione-o também em *Redirect URLs*.
4. Em **Project Settings → API**, copie a *Project URL* e a *anon public key*.
5. Localmente: copie `.env.example` para `.env.local` e preencha. **Nunca** use a `service_role` key no frontend.

### Como a sincronização funciona

- Os dados do usuário ficam em uma linha (JSONB) protegida por RLS.
- Cada alteração confirmada é salva automaticamente (indicador "Salvando…/Sincronizado").
- Sem internet, as alterações ficam em fila no aparelho e são enviadas quando a conexão volta.
- Ao voltar para a aba (e a cada 30 s com ela visível), o app busca a versão mais recente — assim o celular vê o que foi feito no computador.
- Se dois aparelhos alterarem ao mesmo tempo, a gravação mais antiga é recusada e o app pergunta qual versão manter, sem sobrescrever em silêncio.

## Publicando (GitHub Pages)

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) testa, compila e publica a cada push na `main`.

1. No GitHub: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Faça merge na `main` (ou rode o workflow manualmente). O endereço aparece na execução do job `deploy`.

Também funciona em Netlify/Vercel/Cloudflare Pages: comando `npm run build`, pasta `dist`, mesmas variáveis de ambiente. O roteamento usa `#/rota`, então não é preciso configurar redirecionamentos.

## Testes

```bash
npm test             # unidade: cálculos financeiros, parcelas, faturas, metas, orçamento, backup/CSV, sincronização
npm run test:rls     # RLS no PostgreSQL local (precisa de createdb/psql com permissão)
npm run dev & npm run test:e2e   # fluxos completos no Chromium (celular e computador), modo demonstração
```

| # | Fluxo | Como foi verificado |
|---|-------|---------------------|
| 1 | Criar conta e entrar | Tela de login/cadastro implementada com Supabase Auth; **não testada contra um Supabase real** (requer seu projeto) |
| 2–10 | Receita, despesa, transferência, cartão, parcelas, pagamento de fatura, meta, orçamento, backup/restauração | Testes unitários + E2E no navegador |
| 11 | Sincronização entre dispositivos | Lógica de versão/conflito testada com cliente simulado; precisa de validação manual com o Supabase real |
| 12 | Isolamento entre usuários | `supabase/schema.sql` testado em PostgreSQL 16 com simulação de `auth.uid()` (leitura, escrita, exclusão, troca de dono, anônimo, exclusão de conta) |

## Estrutura

```
src/
  data/       tipos, valores padrão e operações (ops.ts)
  lib/        cálculos financeiros, datas, moeda, backup/CSV
  store/      persistência (demo local e Supabase) e contexto do app
  components/ layout, formulários, gráficos, UI
  pages/      Dashboard, Transações, Orçamento, Contas e cartões, Parcelamentos, Metas, Relatórios, Configurações, Login
supabase/     schema.sql e testes RLS
e2e/          teste ponta a ponta com Playwright
```
