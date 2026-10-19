import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const admin = await ctx.newPage();
admin.setDefaultTimeout(20000);
const email = `semclique.${Date.now()}@exemplo.com`;
const logs = [];
try {
    await admin.goto(base + '/painel.html');
    await admin.getByLabel('Nome da família').fill('Família Sem Clique');
    await admin.getByLabel('E-mail do administrador').fill(email);
    await admin.getByLabel('Senha').fill('senha-teste-123');
    await admin.getByRole('button', { name: 'Criar conta' }).click();
    await admin.getByRole('link', { name: /Quiz/ }).click();
    await admin.getByText('Qual é a capital do Brasil?').waitFor();
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const tvLink = admin.getByRole('link', { name: 'Abrir na TV' });
    await tvLink.waitFor();
    const tv = await ctx.newPage();
    tv.on('pageerror', (e) => logs.push('tv ' + e.message));
    await tv.goto(new URL(await tvLink.getAttribute('href'), admin.url()).href);
    const phone = await ctx.newPage();
    phone.on('pageerror', (e) => logs.push('phone ' + e.message));
    phone.on('console', (msg) => { if (msg.type() === 'error') logs.push('console ' + msg.text()); });
    await phone.goto(await tv.locator('#link-celular').getAttribute('href'));
    await phone.getByLabel('Seu nome').fill('Caio');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await tv.getByText('Caio', { exact: true }).waitFor();
    await tv.getByRole('button', { name: 'Começar' }).click();
    await phone.locator('.opcao').first().waitFor();
    await phone.waitForTimeout(2500);
    const status = await tv.locator('body').innerText();
    console.log(status.includes('Placar') ? 'REVELOU CEDO' : 'AINDA NA PERGUNTA');
    console.log(status.split('\n').slice(0, 12).join(' | '));
    console.log('erros', logs);
} finally {
    await browser.close();
}
