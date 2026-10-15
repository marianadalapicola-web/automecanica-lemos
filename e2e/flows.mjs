// Teste ponta a ponta dos fluxos principais sem login, com dados salvos no navegador (navegador real).
// Uso: npm run dev (em outro terminal) e depois: node e2e/flows.mjs [url] [pasta-screenshots]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:5173/';
const SHOTS = process.argv[3] ?? 'e2e/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

const nb = (s) => s.replace(/\u00a0/g, ' ');
const browser = await chromium.launch();
const errors = [];

async function run(viewport, tag) {
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] console: ${m.text()}`));
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${tag}-${n}.png`, fullPage: true });
  const step = (s) => console.log(`  [${tag}] ${s}`);
  const modal = () => page.locator('.modal').last();
  const toastSeen = (re) => page.locator('.toast', { hasText: re }).first().waitFor();
  const stat = (label) => page.locator('.stat', { hasText: label }).locator('.value');
  const nav = async (name) => {
    if (viewport.width >= 960) return page.locator('.sidebar').getByRole('link', { name }).click();
    const bottom = page.locator('.bottom-nav').getByRole('link', { name });
    if (await bottom.count()) return bottom.click();
    await page.getByRole('button', { name: 'Mais seções' }).click();
    await modal().getByRole('link', { name }).click();
  };
  const addTx = async ({ type = 'Despesa', desc, amount, category, from, to, card, parcels, pending }) => {
    if (viewport.width >= 960) await page.locator('.sidebar').getByRole('button', { name: 'Novo lançamento' }).click();
    else await page.getByRole('button', { name: 'Adicionar receita ou despesa' }).click();
    const m = modal();
    await m.getByRole('button', { name: type, exact: true }).click();
    await m.getByLabel('Descrição').fill(desc);
    await m.getByLabel(/Valor/).first().fill(amount);
    if (category) await m.getByLabel('Categoria').selectOption({ label: category });
    if (from) await m.getByLabel(/Pago com|Recebido em|De \(origem\)/).selectOption({ label: from });
    if (card) await m.getByLabel('Pago com').selectOption({ label: card });
    if (to) await m.getByLabel('Para (destino)').selectOption({ label: to });
    if (parcels) await m.getByLabel('Parcelas').selectOption({ label: `${parcels}x` });
    if (pending) await m.getByRole('button', { name: /A pagar|A receber/ }).click();
    await m.getByRole('button', { name: 'Salvar', exact: true }).click();
    await m.waitFor({ state: 'detached' });
  };

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  step('1. abre direto, sem login, salvando neste aparelho');
  await page.getByText(/Boas-vindas ao Glossy Money/).waitFor();
  await page.locator('.sync:visible', { hasText: 'Salvo neste aparelho' }).waitFor();
  await shot('02-welcome');

  step('contas: Corrente R$ 1.000 e Poupança R$ 500');
  await page.getByRole('link', { name: 'Criar conta' }).click();
  await modal().getByLabel('Nome').fill('Corrente');
  await modal().getByLabel('Saldo inicial').fill('1000');
  await modal().getByRole('button', { name: 'Salvar' }).click();
  await toastSeen(/Conta criada/);
  await page.getByRole('button', { name: 'Nova conta' }).click();
  await modal().getByLabel('Nome').fill('Poupança');
  await modal().getByLabel('Tipo').selectOption({ label: 'Poupança' });
  await modal().getByLabel('Saldo inicial').fill('500,00');
  await modal().getByRole('button', { name: 'Salvar' }).click();
  await toastSeen(/Conta criada/);

  step('2. receita de R$ 5.000 → saldo total R$ 6.500');
  await nav(/Dashboard|Início/);
  await addTx({ type: 'Receita', desc: 'Salário', amount: '5.000,00', category: '💼 Salário', from: 'Corrente' });
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 6.500,00');
  assert.equal(await stat('Receitas').innerText().then(nb), 'R$ 5.000,00');

  step('3. despesa paga R$ 200 + despesa pendente R$ 100');
  await addTx({ desc: 'Mercado', amount: '200', category: '🍓 Alimentação', from: 'Corrente' });
  await addTx({ desc: 'Academia', amount: '100', category: '🩺 Saúde', from: 'Corrente', pending: true });
  assert.equal(await stat('Despesas').innerText().then(nb), 'R$ 300,00');
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 6.300,00');
  assert.equal(await stat('Pendentes').innerText().then(nb), 'R$ 100,00');

  step('4. transferência R$ 300 Corrente → Poupança (saldo total igual, sem receita/despesa)');
  await addTx({ type: 'Transferência', desc: 'Guardar', amount: '300', from: 'Corrente', to: 'Poupança' });
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 6.300,00');
  assert.equal(await stat('Despesas').innerText().then(nb), 'R$ 300,00');
  assert.equal(await stat('Receitas').innerText().then(nb), 'R$ 5.000,00');
  await nav(/^Contas/);
  const accCard = (n) => page.locator('article', { has: page.getByRole('heading', { name: n, exact: true }) });
  assert.match(await accCard('Corrente').innerText().then(nb), /R\$ 5\.500,00/);
  assert.match(await accCard('Poupança').innerText().then(nb), /R\$ 800,00/);

  step('5. cartão (fecha 3, vence 10, limite R$ 3.000) e compra à vista R$ 150');
  await page.getByRole('tab', { name: /Cartões de crédito/ }).click();
  await page.getByRole('button', { name: 'Novo cartão' }).click();
  await modal().getByLabel('Nome do cartão').fill('Nubank');
  await modal().getByLabel('Apelido').fill('Roxinho');
  await modal().getByLabel('Limite total').fill('3000');
  await modal().getByLabel('Dia de fechamento').selectOption('3');
  await modal().getByLabel('Dia de vencimento').selectOption('10');
  await modal().getByRole('button', { name: 'Holográfico' }).click();
  await modal().getByRole('button', { name: 'Salvar' }).click();
  await toastSeen(/Cartão criado/);
  await addTx({ desc: 'Batom', amount: '150', category: '👛 Compras', card: '💳 Roxinho' });

  step('6. compra parcelada R$ 1.200 em 3x');
  await addTx({ desc: 'Fone', amount: '1200', category: '👛 Compras', card: '💳 Roxinho', parcels: 3 });
  const cardText = await page.locator('article', { hasText: 'Roxinho' }).first().innerText().then(nb);
  assert.match(cardText, /Limite utilizado\s*R\$ 1\.350,00/);
  assert.match(cardText, /Limite disponível\s*R\$ 1\.650,00/);
  await shot('03-cards');
  await nav(/Parcela/);
  await page.getByRole('heading', { name: 'Fone' }).waitFor();
  await page.getByRole('button', { name: 'Ver parcelas' }).click();
  const rows = page.locator('article', { hasText: 'Fone' }).locator('tbody tr');
  assert.equal(await rows.count(), 3);
  assert.match(await rows.nth(0).innerText().then(nb), /1\/3/);
  assert.match(await page.locator('article', { hasText: 'Fone' }).innerText().then(nb), /Parcela 1\/3/);
  await shot('04-installments');

  step('dashboard: despesas = 200 + 100 + 150 + 400 (1ª parcela) = 850');
  await nav(/Dashboard|Início/);
  assert.equal(await stat('Despesas').innerText().then(nb), 'R$ 850,00');

  step('7. pagar a fatura atual (nov) sem duplicar despesas');
  await nav(/^Contas/);
  await page.getByRole('tab', { name: /Cartões de crédito/ }).click();
  await page.getByRole('button', { name: 'Faturas' }).click();
  const inv = modal();
  assert.match(await inv.innerText().then(nb), /Total\s*R\$ 550,00/);
  await inv.getByRole('button', { name: 'Registrar pagamento' }).click();
  await toastSeen(/Pagamento de fatura registrado/);
  assert.match(await inv.innerText().then(nb), /Paga/);
  await inv.getByRole('button', { name: 'Fechar' }).click();
  await nav(/Dashboard|Início/);
  assert.equal(await stat('Despesas').innerText().then(nb), 'R$ 850,00', 'pagamento de fatura não pode virar despesa');
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 5.750,00');

  step('8. meta Viagem R$ 5.000 + contribuição R$ 1.000 (saldo total não muda)');
  await nav(/Metas/);
  await page.getByRole('button', { name: 'Nova meta' }).click();
  await modal().getByLabel('Nome').fill('Viagem');
  await modal().getByLabel('Valor desejado').fill('5000');
  await modal().getByRole('button', { name: 'Salvar' }).click();
  await toastSeen(/Meta criada/);
  await page.getByRole('button', { name: 'Contribuir' }).click();
  await modal().getByLabel('Valor').fill('1000');
  await modal().getByRole('button', { name: 'Confirmar' }).click();
  await toastSeen(/reservados para Viagem/);
  assert.match(await page.locator('.goal-card').innerText().then(nb), /R\$ 1\.000,00[\s\S]*20%/);
  await page.getByRole('button', { name: 'Contribuir' }).click();
  await modal().getByLabel('Valor').fill('99999');
  await modal().getByText(/Saldo livre insuficiente/).waitFor();
  await modal().getByRole('button', { name: 'Cancelar' }).click();
  await shot('05-goals');
  await nav(/Dashboard|Início/);
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 5.750,00');
  assert.equal(await stat('Reservado em metas').innerText().then(nb), 'R$ 1.000,00');

  step('9. orçamento: Compras R$ 500 → excedido (150 + 400 = 550)');
  await nav(/Orçamento/);
  await page.getByRole('button', { name: 'Definir orçamento' }).click();
  await page.getByLabel('👛 Compras').fill('500');
  await page.getByLabel('Limite geral de despesas (opcional)').fill('2000');
  await page.getByRole('button', { name: 'Salvar orçamento' }).click();
  await toastSeen(/Orçamento salvo/);
  assert.match(await page.locator('.card', { hasText: 'Por categoria' }).innerText().then(nb), /Excedeu R\$ 50,00/);
  assert.match(await page.locator('.card', { hasText: 'Limite geral' }).innerText().then(nb), /Restam R\$ 1\.150,00/);
  await page.getByRole('button', { name: 'Ajustar limites' }).click();
  await page.getByLabel('👛 Compras').fill('800');
  await page.getByRole('button', { name: 'Salvar orçamento' }).click();
  assert.match(await page.locator('.card', { hasText: 'Por categoria' }).innerText().then(nb), /Restam R\$ 250,00/);
  await shot('06-budget');

  step('relatórios e transações (filtros + CSV)');
  await nav(/Relatórios/);
  await page.getByRole('heading', { name: 'Parcelas futuras' }).waitFor();
  await shot('07-reports');
  await nav(/Transações|Lançamentos/);
  await page.getByPlaceholder(/Pesquisar/).fill('fone');
  assert.equal(await page.locator('.tx-row').count(), 1);
  await page.getByPlaceholder(/Pesquisar/).fill('');
  await page.getByLabel('Status').selectOption('pending');
  assert.ok((await page.locator('.tx-row').count()) >= 1);
  await page.getByLabel('Status').selectOption('');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  assert.match(csvText, /descricao;valor;tipo/);
  assert.match(csvText, /Salário;5000,00;Receita/);

  step('10. backup → excluir tudo → restaurar');
  await nav(/Configurações|Ajustes/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Backup completo/ }).click()]);
  const backupPath = `${SHOTS}/${tag}-backup.json`;
  await dl.saveAs(backupPath);
  await page.getByRole('button', { name: 'Excluir todos os dados' }).click();
  await modal().getByLabel(/Digite EXCLUIR/).fill('EXCLUIR');
  await modal().getByRole('button', { name: 'Excluir tudo' }).click();
  await toastSeen(/foram excluídos/);
  await nav(/Dashboard|Início/);
  await page.getByText(/Boas-vindas ao Glossy Money/).waitFor();
  await nav(/Configurações|Ajustes/);
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await modal().getByText(/8 transações, 2 contas, 1 cartões, 1 metas/).waitFor();
  await modal().getByLabel(/Digite RESTAURAR/).fill('RESTAURAR');
  await modal().getByRole('button', { name: 'Restaurar' }).click();
  await toastSeen(/Backup restaurado/);
  await nav(/Dashboard|Início/);
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 5.750,00');

  step('persistência: recarregar a página mantém os dados');
  await page.reload();
  assert.equal(await stat('Saldo total').innerText().then(nb), 'R$ 5.750,00');
  await shot('08-dashboard');

  step('tema Meia-noite');
  await nav(/Configurações|Ajustes/);
  await page.getByRole('button', { name: 'Meia-noite' }).click();
  await page.getByRole('button', { name: 'Salvar preferências' }).click();
  await nav(/Dashboard|Início/);
  await shot('09-dark');
  await ctx.close();
}

try {
  console.log('Celular (390×844)');
  await run({ width: 390, height: 844 }, 'mobile');
  console.log('Computador (1366×900)');
  await run({ width: 1366, height: 900 }, 'desktop');
} finally {
  await browser.close();
}
if (errors.length) {
  console.error('Erros no navegador:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('✓ Todos os fluxos E2E passaram');
