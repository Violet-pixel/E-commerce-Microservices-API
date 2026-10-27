// Monta o sumário a partir dos capítulos (h1) e seções (h2) e dá um id a cada título.
// Os números de página são preenchidos por gerar_pdfs.mjs.
(() => {
  const lista = document.getElementById('lista-sumario');
  if (!lista) return;
  const usados = new Set();
  const slug = (texto) => {
    let base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'secao';
    let id = base, i = 2;
    while (usados.has(id)) id = `${base}-${i++}`;
    usados.add(id);
    return id;
  };
  const item = (el, classe, numero) => {
    el.id = el.id && !usados.has(el.id) ? (usados.add(el.id), el.id) : slug((numero ? numero + '-' : '') + el.textContent);
    const li = document.createElement('li');
    li.className = classe;
    const a = document.createElement('a');
    a.href = '#' + el.id;
    if (numero) { const n = document.createElement('span'); n.className = 'n'; n.textContent = numero; a.append(n); }
    const t = document.createElement('span'); t.className = 't'; t.textContent = el.textContent;
    const p = document.createElement('span'); p.className = 'pontos';
    const g = document.createElement('span'); g.className = 'pg';
    a.append(t, p, g);
    li.append(a);
    return li;
  };
  for (const cap of document.querySelectorAll('section.capitulo')) {
    const h1 = cap.querySelector('.abertura h1');
    const num = cap.querySelector('.abertura .num')?.textContent.trim();
    const li = item(h1, 'cap', num);
    const sub = document.createElement('ol');
    for (const h2 of cap.querySelectorAll('h2')) sub.append(item(h2, 'sec'));
    li.append(sub);
    lista.append(li);
  }
})();
