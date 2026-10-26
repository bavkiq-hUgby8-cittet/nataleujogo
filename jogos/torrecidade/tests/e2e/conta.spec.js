import {test,expect} from '@playwright/test';
import {room,root} from './helpers.js';
test('conta da família entra pela interface e cria sala', async({page})=>{
 const r=await room(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'conta.html');
 await page.getByLabel('E-mail',{exact:true}).fill(r.email);
 await page.getByLabel('Senha',{exact:true}).fill(r.password);
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.locator('#signed')).toBeVisible();
 await page.getByRole('link',{name:'Criar sala ou abrir Nossa Cidade'}).click();
 await page.locator('#create').click();
 await expect(page.locator('#join')).toBeVisible();
 expect(new URL(page.url()).searchParams.get('familia')).toBe(r.family);
 expect(errors).toEqual([]);
});
