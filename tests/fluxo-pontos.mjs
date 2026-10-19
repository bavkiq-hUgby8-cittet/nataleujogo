import { chromium } from 'playwright';

const perguntas = [
    { texto: 'Qual é a capital do Brasil?', correta: 'Brasília' },
    { texto: 'Quantos jogadores de um time de futebol ficam em campo?', correta: '11' },
    { texto: 'Que cor nasce da mistura de azul e amarelo?', correta: 'Verde' },
    { texto: 'Qual é o menor planeta do Sistema Solar?', correta: 'Mercúrio' },
    { texto: 'Quantos dias tem uma semana?', correta: '7' },
    { texto: 'Qual animal é famoso pelo miado?', correta: 'Gato' },
    { texto: 'O que usamos para medir a temperatura do corpo?', correta: 'Termômetro' },
    { texto: 'Qual é o maior país da América do Sul?', correta: 'Brasil' }
];

const base = 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const admin = await ctx.newPage();
admin.setDefaultTimeout(20000);
const email = `pontos.${Date.now()}@exemplo.com`;

try {
    await admin.goto(base + '/painel.html');
    await admin.getByLabel('Nome da família').fill('Família Pontos');
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
    const phone = await ctx.newPage();
    await phone.goto(await tv.locator('#link-celular').getAttribute('href'));
    await phone.getByLabel('Seu nome').fill('Bia');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await tv.getByText('Bia', { exact: true }).waitFor();
    await tv.getByRole('button', { name: 'Começar' }).click();
    await phone.locator('.opcao').first().waitFor();
    const enunciado = (await phone.locator('h1').innerText()).trim();
    const item = perguntas.find((p) => p.texto === enunciado);
    if (!item) throw new Error('Pergunta desconhecida: ' + enunciado);
    await phone.getByRole('button', { name: item.correta, exact: true }).click();
    await tv.getByText('Placar').waitFor();
    await phone.getByText('Placar atualizado na TV.').waitFor();
    const placar = await tv.locator('.ranking').innerText();
    console.log('enunciado:', enunciado);
    console.log('placar:', placar.replaceAll('\n', ' | '));
    if (!placar.includes('10')) throw new Error('Pontuação não foi 10');
    console.log('pontos ok');
} finally {
    await browser.close();
}
