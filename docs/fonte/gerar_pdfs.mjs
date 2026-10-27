// Gera os dois manuais em PDF a partir dos HTML desta pasta.
// Uso (na raiz do repositório): node docs/fonte/gerar_pdfs.mjs
// Requer o Playwright com o Chromium instalado (npx playwright install chromium).
// Funciona sem internet: fontes, logo e capturas são lidas do próprio repositório.
import { createRequire } from 'node:module';
import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright não encontrado. Instale com: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');

const documentos = [
  { fonte: 'manual.html', saida: 'Manual-Cesto.pdf', titulo: 'Cesto: manual técnico' },
  { fonte: 'banco-de-dados.html', saida: 'Banco-de-Dados-Cesto.pdf', titulo: 'Cesto: banco de dados' }
];

// Lê os destinos nomeados (âncoras) de um PDF do Chromium e devolve id -> número da página.
function paginasDasAncoras(buffer) {
  const texto = buffer.toString('latin1');
  const objetos = new Map();
  const reObj = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m;
  while ((m = reObj.exec(texto))) objetos.set(Number(m[1]), m[2]);
  // Objetos compactados em object streams.
  for (const corpo of [...objetos.values()]) {
    if (!/\/Type\s*\/ObjStm/.test(corpo)) continue;
    const n = Number(/\/N (\d+)/.exec(corpo)?.[1] ?? 0);
    const first = Number(/\/First (\d+)/.exec(corpo)?.[1] ?? 0);
    const ini = corpo.indexOf('stream') + 6;
    const fim = corpo.lastIndexOf('endstream');
    let bruto = Buffer.from(corpo.slice(ini, fim).replace(/^\r?\n/, ''), 'latin1');
    try { bruto = inflateSync(bruto); } catch { continue; }
    const s = bruto.toString('latin1');
    const cab = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const num = cab[2 * i];
      const off = cab[2 * i + 1];
      const prox = i + 1 < n ? cab[2 * i + 3] : s.length - first;
      objetos.set(num, s.slice(first + off, first + prox));
    }
  }
  const raizPaginas = [...objetos.entries()].find(([, c]) => /\/Type\s*\/Pages\b/.test(c) && !/\/Parent/.test(c));
  const ordem = [];
  const visitar = (num) => {
    const c = objetos.get(num) ?? '';
    if (/\/Type\s*\/Pages\b/.test(c)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(c)?.[1] ?? '';
      for (const k of kids.matchAll(/(\d+) 0 R/g)) visitar(Number(k[1]));
    } else ordem.push(num);
  };
  if (raizPaginas) visitar(raizPaginas[0]);
  const paginaDoObjeto = new Map(ordem.map((num, i) => [num, i + 1]));
  const resultado = {};
  const reDest = /\/([A-Za-z0-9_#.-]+)\s*\[\s*(\d+) 0 R\s*\/XYZ/g;
  for (const corpo of objetos.values()) {
    for (const d of corpo.matchAll(reDest)) {
      const nome = d[1].replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      const pag = paginaDoObjeto.get(Number(d[2]));
      if (pag) resultado[nome] = pag;
    }
  }
  return resultado;
}

async function gerar(browser, doc) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(aqui, doc.fonte)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Remove figuras cujas imagens não existem (em vez de mostrar imagem quebrada).
  const removidas = await page.evaluate(() => {
    const fora = [];
    for (const img of document.querySelectorAll('figure img')) {
      if (!img.complete || img.naturalWidth === 0) {
        fora.push(img.getAttribute('src'));
        const fig = img.closest('figure');
        const grupo = fig.parentElement.classList.contains('lado') ? fig.parentElement : null;
        fig.remove();
        if (grupo && !grupo.querySelector('figure')) grupo.remove();
      }
    }
    // Renumera as figuras que sobraram, por capítulo.
    for (const cap of document.querySelectorAll('section.capitulo')) {
      const num = cap.querySelector('.abertura .num')?.textContent.trim();
      cap.querySelectorAll('figcaption b').forEach((b, i) => { b.textContent = `Fig. ${num}.${i + 1}`; });
    }
    return fora;
  });
  for (const src of removidas) console.warn(`  aviso: imagem ausente, figura removida: ${src}`);

  const opcoes = { format: 'A4', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true };
  // Primeira passada: descobre em que página cai cada título.
  const rascunho = await page.pdf(opcoes);
  const paginas = paginasDasAncoras(rascunho);
  const preenchidas = await page.evaluate((mapa) => {
    let n = 0;
    for (const a of document.querySelectorAll('.sumario a[href^="#"]')) {
      const id = a.getAttribute('href').slice(1);
      const alvo = a.querySelector('.pg');
      if (alvo && mapa[id]) { alvo.textContent = String(mapa[id]); n++; }
    }
    return n;
  }, paginas);
  const total = await page.evaluate(() => document.querySelectorAll('.sumario a[href^="#"]').length);
  if (preenchidas < total) console.warn(`  aviso: ${total - preenchidas} entradas do sumário sem número de página`);
  // Segunda passada: PDF final com o sumário numerado e marcadores.
  const final = await page.pdf(opcoes);
  await page.close();
  const destino = resolve(raiz, doc.saida);
  writeFileSync(destino, final);
  copyFileSync(destino, resolve(raiz, 'docs', doc.saida));
  console.log(`${doc.saida}: ${Object.keys(paginas).length} âncoras, ${final.length} bytes`);
}

const browser = await chromium.launch();
try {
  for (const doc of documentos) await gerar(browser, doc);
} finally {
  await browser.close();
}
