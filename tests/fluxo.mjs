import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:8765';
const artefatos = '/opt/cursor/artifacts';
await mkdir(artefatos, { recursive: true });

const browser = await chromium.launch({ headless: true });
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const admin = await adminCtx.newPage();
const phone = await phoneCtx.newPage();
admin.setDefaultTimeout(20000);
phone.setDefaultTimeout(20000);

const email = `familia.${Date.now()}@exemplo.com`;

try {
    await admin.goto(base + '/painel.html');
    await admin.getByLabel('Nome da família').fill('Família Teste');
    await admin.getByLabel('E-mail do administrador').fill(email);
    await admin.getByLabel('Senha').fill('senha-teste-123');
    await admin.getByRole('button', { name: 'Criar conta' }).click();
    await admin.getByRole('link', { name: /Quiz/ }).waitFor();
    await admin.screenshot({ path: artefatos + '/painel.png' });

    await admin.getByRole('link', { name: /Quiz/ }).click();
    await admin.getByText('Qual é a capital do Brasil?').waitFor();
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const tvLink = admin.getByRole('link', { name: 'Abrir na TV' });
    await tvLink.waitFor();
    const tv = await adminCtx.newPage();
    await tv.goto(new URL(await tvLink.getAttribute('href'), admin.url()).href);
    await tv.locator('#link-celular').waitFor();
    await tv.screenshot({ path: artefatos + '/quiz-tv-sala.png' });
    const celular = await tv.locator('#link-celular').getAttribute('href');

    await phone.goto(celular);
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await phone.getByText('A TV ainda não soltou a pergunta').waitFor();
    await tv.getByText('Bia').waitFor();
    await tv.getByRole('button', { name: 'Começar' }).click();
    await phone.getByRole('button').first().waitFor();
    const pergunta = await phone.locator('h1').innerText();
    if (!pergunta) throw new Error('O celular não mostrou a pergunta.');
    await phone.getByRole('button').first().click();
    await tv.getByText('Placar').waitFor();
    await tv.screenshot({ path: artefatos + '/quiz-tv.png' });
    await phone.screenshot({ path: artefatos + '/quiz-celular.png' });
    console.log('quiz ok:', pergunta);

    await admin.goto(base + '/painel.html#/bingo');
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const bingoLink = admin.getByRole('link', { name: 'Abrir na TV' });
    await bingoLink.waitFor();
    const bingoTv = await adminCtx.newPage();
    await bingoTv.goto(new URL(await bingoLink.getAttribute('href'), admin.url()).href);
    const bingoCelular = await bingoTv.locator('#link-celular').getAttribute('href');
    await phone.goto(bingoCelular);
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByRole('button', { name: 'Pegar minha cartela' }).click();
    await bingoTv.getByText('Bia').waitFor();
    await bingoTv.getByRole('button', { name: 'Começar o sorteio' }).click();
    await bingoTv.getByRole('button', { name: 'Sortear bola' }).click();
    await phone.getByText(/Saiu /).waitFor();
    await bingoTv.screenshot({ path: artefatos + '/bingo-tv.png' });
    await phone.screenshot({ path: artefatos + '/bingo-celular.png' });
    console.log('bingo ok');

    await admin.goto(base + '/painel.html#/capsula');
    await admin.getByRole('button', { name: 'Natal' }).click();
    await admin.getByRole('button', { name: 'Criar cápsula' }).click();
    const capsulaLink = admin.getByRole('link', { name: 'Abrir na TV' });
    await capsulaLink.waitFor();
    const capsulaTv = await adminCtx.newPage();
    await capsulaTv.goto(new URL(await capsulaLink.getAttribute('href'), admin.url()).href);
    const capsulaCelular = await capsulaTv.locator('#link-celular').getAttribute('href');
    await phone.goto(capsulaCelular);
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByLabel('Carta').fill('Segredo do ensaio que ninguém pode ler.');
    await phone.getByRole('button', { name: 'Lacrar carta' }).click();
    await phone.getByText('Sua carta está lacrada').waitFor();
    await capsulaTv.getByText('Carta lacrada').waitFor();
    const tvTexto = await capsulaTv.locator('body').innerText();
    if (tvTexto.includes('Segredo do ensaio')) throw new Error('A TV mostrou a carta antes da hora.');
    await capsulaTv.screenshot({ path: artefatos + '/capsula-tv.png' });
    await phone.screenshot({ path: artefatos + '/capsula-celular.png' });
    console.log('cápsula ok');
} finally {
    await browser.close();
}
