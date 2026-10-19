import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true });
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const admin = await adminCtx.newPage();
const phone = await phoneCtx.newPage();
admin.setDefaultTimeout(20000);
phone.setDefaultTimeout(20000);
const email = `resto.${Date.now()}@exemplo.com`;

async function abrirTv(nome) {
    const link = admin.getByRole('link', { name: 'Abrir na TV' }).last();
    await link.waitFor();
    const tv = await adminCtx.newPage();
    await tv.goto(new URL(await link.getAttribute('href'), admin.url()).href);
    const href = await tv.locator('#link-celular').getAttribute('href');
    return { tv, href };
}

try {
    await admin.goto(base + '/painel.html');
    await admin.getByLabel('Nome da família').fill('Família Resto');
    await admin.getByLabel('E-mail do administrador').fill(email);
    await admin.getByLabel('Senha').fill('senha-teste-123');
    await admin.getByRole('button', { name: 'Criar conta' }).click();
    await admin.getByRole('link', { name: /Karaokê/ }).click();
    await admin.getByText('Aquarela').waitFor();
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const karaoke = await abrirTv();
    await phone.goto(karaoke.href);
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByRole('button', { name: 'Entrar na fila' }).click();
    await phone.getByLabel('Ou escreva outra música').fill('Parabéns da casa');
    await phone.getByRole('button', { name: 'Entrar na fila' }).click();
    await karaoke.tv.getByText('Bia · Parabéns da casa').waitFor();
    await karaoke.tv.getByRole('button', { name: 'Chamar o próximo' }).click();
    await karaoke.tv.getByText('Bia canta').waitFor();
    await karaoke.tv.getByRole('button', { name: 'Abrir votação' }).click();
    await phone.getByRole('button', { name: '5 ★' }).click();
    await phone.getByText('Sua nota já foi.').waitFor();
    await karaoke.tv.getByRole('button', { name: 'Fechar votação' }).click();
    await karaoke.tv.getByText('Notas somadas: 5').waitFor();
    console.log('karaokê ok');

    await admin.goto(base + '/painel.html#/memoria');
    await admin.getByRole('button', { name: 'Nova partida' }).click();
    const memoria = await abrirTv();
    await phone.goto(memoria.href);
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await memoria.tv.getByText('Bia').waitFor();
    await memoria.tv.getByRole('button', { name: 'Começar' }).click();
    await phone.getByText('Sua vez').waitFor();
    const cartas = phone.locator('.carta');
    await cartas.nth(0).click();
    await cartas.nth(1).click();
    await memoria.tv.locator('.carta.aberta').first().waitFor();
    const aviso = await phone.locator('#aviso-flutuante.visivel').count();
    if (aviso) throw new Error(await phone.locator('#aviso-flutuante').innerText());
    console.log('memória ok');
} finally {
    await browser.close();
}
