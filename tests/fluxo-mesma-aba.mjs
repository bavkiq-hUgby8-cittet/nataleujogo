import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const admin = await ctx.newPage();
admin.setDefaultTimeout(20000);
const email = `mesma.${Date.now()}@exemplo.com`;

try {
    await admin.goto(base + '/painel.html');
    await admin.getByLabel('Nome da família').fill('Família Mesma');
    await admin.getByLabel('E-mail do administrador').fill(email);
    await admin.getByLabel('Senha').fill('senha-teste-123');
    await admin.getByRole('button', { name: 'Criar conta' }).click();
    await admin.getByRole('link', { name: /Quiz/ }).click();
    await admin.getByText('Qual é a capital do Brasil?').waitFor();
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const tvLink = admin.getByRole('link', { name: 'Abrir na TV' });
    await tvLink.waitFor();
    const tv = await ctx.newPage();
    await tv.goto(new URL(await tvLink.getAttribute('href'), admin.url()).href);
    const href = await tv.locator('#link-celular').getAttribute('href');
    const phone = await ctx.newPage();
    await phone.goto(href);
    await phone.getByLabel('Seu nome').fill('Lia');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await phone.getByText('A TV ainda não soltou a pergunta').waitFor();
    await tv.getByText('Lia', { exact: true }).waitFor();
    await tv.getByRole('button', { name: 'Começar' }).click();
    await phone.locator('.opcao').first().click();
    await tv.getByText('Placar').waitFor();
    if (tv.url().includes('painel.html')) throw new Error('A TV perdeu o login.');
    console.log('mesma sessão ok');
} finally {
    await browser.close();
}
