export interface DemoProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  category: string;
  stock: number;
}

export const DEMO_CATEGORIES = [
  { id: '6f1d2c3b-0000-4a00-8000-000000000001', name: 'Cozinha', slug: 'cozinha' },
  { id: '6f1d2c3b-0000-4a00-8000-000000000002', name: 'Casa', slug: 'casa' },
  { id: '6f1d2c3b-0000-4a00-8000-000000000003', name: 'Papelaria', slug: 'papelaria' },
  { id: '6f1d2c3b-0000-4a00-8000-000000000004', name: 'Café', slug: 'cafe' }
] as const;

const p = (n: number) => `7a2e9b10-0000-4b00-9000-${String(n).padStart(12, '0')}`;

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: p(1), sku: 'COZ-PAN-01', name: 'Panela de ferro fundido 24 cm', slug: 'panela-ferro-24', description: 'Retém calor por mais tempo e vai do fogão ao forno.', priceCents: 38990, category: 'cozinha', stock: 12 },
  { id: p(2), sku: 'COZ-TAB-02', name: 'Tábua de corte em bambu', slug: 'tabua-bambu', description: 'Bambu de reflorestamento com canaleta para líquidos.', priceCents: 8990, category: 'cozinha', stock: 40 },
  { id: p(3), sku: 'COZ-FAC-03', name: 'Faca do chef 20 cm', slug: 'faca-chef-20', description: 'Aço inox de alto carbono e cabo antideslizante.', priceCents: 21900, category: 'cozinha', stock: 18 },
  { id: p(4), sku: 'COZ-POT-04', name: 'Conjunto de potes herméticos', slug: 'potes-hermeticos', description: 'Cinco potes de vidro com tampa de vedação.', priceCents: 15990, category: 'cozinha', stock: 25 },
  { id: p(5), sku: 'CAS-MAN-05', name: 'Manta de algodão cru', slug: 'manta-algodao', description: 'Tecido grosso, 1,30 x 1,70 m, lavável na máquina.', priceCents: 17990, category: 'casa', stock: 15 },
  { id: p(6), sku: 'CAS-VAS-06', name: 'Vaso de cerâmica fosca', slug: 'vaso-ceramica', description: 'Feito à mão, acabamento fosco e furo de drenagem.', priceCents: 7490, category: 'casa', stock: 30 },
  { id: p(7), sku: 'CAS-LUM-07', name: 'Luminária de mesa articulada', slug: 'luminaria-articulada', description: 'Braço ajustável e soquete E27.', priceCents: 24990, category: 'casa', stock: 8 },
  { id: p(8), sku: 'CAS-CES-08', name: 'Cesto organizador de fibra', slug: 'cesto-fibra', description: 'Fibra natural trançada com alças laterais.', priceCents: 11990, category: 'casa', stock: 22 },
  { id: p(9), sku: 'PAP-CAD-09', name: 'Caderno pontilhado A5', slug: 'caderno-pontilhado', description: '160 páginas de papel 120 g e capa dura.', priceCents: 6490, category: 'papelaria', stock: 60 },
  { id: p(10), sku: 'PAP-CAN-10', name: 'Caneta técnica 0,4 mm', slug: 'caneta-tecnica', description: 'Tinta pigmentada à prova d’água.', priceCents: 2290, category: 'papelaria', stock: 120 },
  { id: p(11), sku: 'PAP-AGE-11', name: 'Agenda semanal 2027', slug: 'agenda-2027', description: 'Uma semana por página dupla, com metas mensais.', priceCents: 8990, category: 'papelaria', stock: 35 },
  { id: p(12), sku: 'PAP-EST-12', name: 'Estojo de lona', slug: 'estojo-lona', description: 'Lona encerada com zíper de metal.', priceCents: 5490, category: 'papelaria', stock: 3 },
  { id: p(13), sku: 'CAF-GRA-13', name: 'Café especial em grãos 500 g', slug: 'cafe-graos-500', description: 'Torra média, notas de chocolate e caramelo.', priceCents: 6990, category: 'cafe', stock: 50 },
  { id: p(14), sku: 'CAF-MOE-14', name: 'Moedor manual de café', slug: 'moedor-manual', description: 'Mós cônicas de cerâmica com regulagem de moagem.', priceCents: 19990, category: 'cafe', stock: 10 },
  { id: p(15), sku: 'CAF-PRE-15', name: 'Prensa francesa 600 ml', slug: 'prensa-francesa', description: 'Vidro borossilicato e filtro de inox.', priceCents: 12990, category: 'cafe', stock: 0 },
  { id: p(16), sku: 'CAF-XIC-16', name: 'Par de xícaras de porcelana', slug: 'xicaras-porcelana', description: 'Duas xícaras de 180 ml com pires.', priceCents: 9490, category: 'cafe', stock: 28 }
];
