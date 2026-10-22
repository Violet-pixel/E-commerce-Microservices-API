<p align="center">
  <img src="docs/images/logo.png" width="160" alt="Cesto">
</p>

<h1 align="center">Cesto<br><sub><sup><sup><sub>Copyright (©) 2026 Clara Portes</sub></sup></sup></sub></h1>

<p align="center">
  API de e-commerce em microsserviços: catálogo, estoque, carrinho, pedidos, pagamentos e notificações conversando por eventos, com login OAuth2, validação estrita em todas as entradas e uma loja web que usa a API de verdade.<br>
  Pronta para usar, estudar ou adaptar.
</p>

<p align="center">
  TypeScript 5.9 · Node.js 22 · Fastify 5 · Prisma 7 · PostgreSQL 16 · Redis 7 Streams · Zod 4 · OAuth2 + PKCE · React 19 + Vite · Docker Compose · Vitest
</p>

---

> **Manual completo:** [`Manual-Cesto.pdf`](Manual-Cesto.pdf) explica a instalação, cada tela, a arquitetura, o OAuth2, os contratos tipados, a API, a configuração, como estender o projeto, os testes e a solução de problemas, passo a passo (cópia em [`docs/`](docs/Manual-Cesto.pdf)).

> **Banco de dados:** [`Banco-de-Dados-Cesto.pdf`](Banco-de-Dados-Cesto.pdf) traz os diagramas de cada banco, todas as tabelas com campos, tipos, chaves e índices, as máquinas de estado, o outbox, as chaves do Redis e como preparar o PostgreSQL.

<p align="center">
  <img src="docs/images/tela-loja.png" alt="Loja com catálogo, filtros por categoria e estoque em tempo real">
</p>

## O que o Cesto faz

- **Oito serviços independentes:** gateway, autenticação, catálogo, estoque, carrinho, pedidos, pagamentos e notificações. Cada um tem o próprio processo, o próprio banco e pode ser escalado sozinho.
- **Pedido como saga:** o checkout cria o pedido, o estoque reserva os itens, o pagamento cobra e o pedido é confirmado. Se faltar estoque ou o pagamento for recusado, tudo é desfeito e o estoque volta.
- **Eventos confiáveis:** Redis Streams com grupos de consumidores, outbox transacional (o evento só sai se o dado foi gravado), deduplicação na entrada, novas tentativas e fila de dead-letter.
- **OAuth2 de verdade:** Authorization Code com PKCE para a interface, Client Credentials entre serviços, JWT RS256 com JWKS, refresh token com rotação e detecção de reuso, escopos por papel.
- **Tipagem de ponta a ponta:** cada rota é um contrato com Zod. O mesmo contrato valida a entrada no servidor, tipa o handler, gera o OpenAPI e alimenta o cliente HTTP tipado da interface.
- **Erros de domínio mapeados:** `NotFound`, `Conflict`, `InsufficientStock`, `InvalidTransition` e outros viram respostas HTTP padronizadas, com código, mensagem, detalhes por campo e `requestId`.
- **Loja web completa:** catálogo com busca, carrinho, checkout, acompanhamento do pedido etapa por etapa, notificações e painel administrativo de produtos, estoque e expedição.
- **Pronto para operar:** health checks, rate limit no gateway, logs estruturados, desligamento gracioso, migrações versionadas, Swagger em `/api/docs`.

<p align="center">
  <img src="docs/images/tela-pedidos.png" alt="Pedidos com a linha do tempo de cada etapa da saga">
</p>

## Arquitetura

```mermaid
flowchart LR
    UI["Navegador<br/>React + Vite"] -- "HTTP" --> NG["web<br/>Nginx"]
    NG --> GW["gateway<br/>Fastify + proxy + rate limit"]
    GW --> AUTH["auth<br/>OAuth2 · JWT RS256"]
    GW --> CAT["catalog"]
    GW --> INV["inventory"]
    GW --> CART["cart"]
    GW --> ORD["orders"]
    GW --> PAY["payments"]
    GW --> NOT["notifications"]
    ORD -- "client_credentials" --> CART
    ORD -- "client_credentials" --> CAT
    CART -- "client_credentials" --> CAT
    CAT & INV & ORD & PAY -- "outbox → XADD" --> RS[("Redis 7<br/>Streams")]
    RS -- "XREADGROUP" --> INV & ORD & PAY & NOT & CART
    AUTH & CAT & INV & ORD & PAY & NOT --- PG[("PostgreSQL 16<br/>um banco por serviço")]
```

| Serviço | Porta | Responsabilidade |
|---|---|---|
| `gateway` | 8000 | Porta única da API: roteamento, rate limit com Redis, `request-id`, OpenAPI e Swagger. Rotas `/internal` nunca saem daqui |
| `auth` | 4001 | Usuários, clientes OAuth2, códigos de autorização, tokens, chaves de assinatura e JWKS |
| `catalog` | 4002 | Produtos, categorias, busca, paginação e eventos de produto |
| `inventory` | 4003 | Saldo, reservas por pedido, baixa e devolução de estoque |
| `cart` | 4004 | Carrinho no Redis com preços sempre lidos do catálogo |
| `orders` | 4005 | Checkout, máquina de estados e orquestração da saga |
| `payments` | 4006 | Cobrança por um gateway plugável (simulado por padrão) e estorno |
| `notifications` | 4007 | Notificações geradas a partir dos eventos |
| `web` | 8080 | Loja e painel em React servidos pelo Nginx |

### Como um pedido é processado

1. `POST /api/v1/orders` lê o carrinho e os preços atuais com um token de serviço, grava o pedido como **Reservando** e, na mesma transação, o evento `order.placed` no outbox.
2. O `inventory` reserva todos os itens de uma vez (`available >= quantidade`, numa transação). Se algum faltar, publica `inventory.rejected` e o pedido é cancelado.
3. Com a reserva feita, o pedido passa a **Aguardando pagamento** e publica `payment.requested`. O `payments` cobra e responde `payment.approved` ou `payment.declined`.
4. Aprovado: o pedido fica **Confirmado** e o estoque reservado vira baixa definitiva. Recusado: o pedido é cancelado e a reserva volta para o saldo.
5. O carrinho é esvaziado pelo evento `order.placed`, e cada etapa vira uma notificação para o cliente. Depois, a loja marca o pedido como **Enviado** e **Entregue**.

<p align="center">
  <img src="docs/images/tela-carrinho.png" width="49%" alt="Carrinho com quantidade e total">
  <img src="docs/images/tela-checkout.png" width="49%" alt="Checkout com endereço e forma de pagamento">
</p>

## Como rodar

Você só precisa do **Docker** com Docker Compose.

**Windows:** dê dois cliques em `iniciar.cmd`.

**Linux ou macOS:**

```bash
./iniciar.sh
```

Na primeira vez o script cria o arquivo `.env` com uma senha aleatória para o banco e um segredo aleatório para os serviços, sobe os contêineres (PostgreSQL, Redis, os oito serviços e a interface) e abre **http://localhost:8080**.

| Endereço | O que é |
|---|---|
| http://localhost:8080 | Loja e painel administrativo |
| http://localhost:8080/api/docs | Documentação da API (Swagger) |
| http://localhost:8080/api/openapi.json | Especificação OpenAPI gerada dos contratos |
| http://localhost:8080/health | Saúde do gateway e de cada serviço |

Para rodar sem o script:

```bash
cp .env.example .env            # troque DB_PASSWORD e SERVICE_CLIENT_SECRET
docker compose up -d --build
docker compose up -d --scale inventory=3 --scale payments=2   # mais consumidores quando precisar
docker compose logs -f orders   # acompanhar a saga
```

## Contas de demonstração

Todas usam a senha **`Cesto@2026`**. Elas existem só para testes, para qualquer pessoa entrar logo depois de baixar o projeto. Os nomes, os produtos e o domínio `cesto.dev` são fictícios.

| Papel | E-mail | O que pode fazer |
|---|---|---|
| Administrador | `admin@cesto.dev` | Tudo, incluindo produtos, estoque e expedição de pedidos |
| Cliente | `cliente@cesto.dev` | Carrinho, pedidos e notificações |

Para simular situações do mundo real na loja:

| Quero ver | Como fazer |
|---|---|
| Pagamento recusado | Escolha **Cartão** e marque **Simular cartão recusado** |
| Falta de estoque | Compre a **Prensa francesa 600 ml**, que começa zerada |
| Limite de valor | Feche um pedido acima de `PAYMENT_DECLINE_ABOVE_CENTS` (padrão R$ 5.000,00) |

Para usar de verdade, suba com `SEED_DEMO=false` num banco vazio. Os clientes OAuth2 continuam sendo criados; o primeiro administrador pode ser promovido direto no banco `cesto_auth` (veja o manual).

<p align="center">
  <img src="docs/images/tela-admin-pedidos.png" width="49%" alt="Painel administrativo com pedidos de todos os clientes">
  <img src="docs/images/tela-admin-produtos.png" width="49%" alt="Cadastro de produtos e ajuste de preço e estoque">
</p>

## Tipagem e validação

Os contratos ficam em [`packages/contracts`](packages/contracts) e são a única fonte da verdade:

```ts
export const api = {
  orders: {
    checkout: defineEndpoint({
      method: 'POST',
      path: '/api/v1/orders',
      auth: 'user',
      scopes: ['orders:write'],
      body: CheckoutBody,
      response: OrderDto,
      status: 202
    })
  }
};

route(app, api.orders.checkout, ({ principal, body }) => orders.checkout(principal.id, body));

const order = await request(api.orders.checkout, { body: { shippingAddress, paymentMethod: 'pix' } });
```

| Peça | O que entrega |
|---|---|
| `Dto<S>`, `CreateDto<T>`, `UpdateDto<T>`, `Paginated<T>`, `ApiResponse<T>`, `Result<T, E>` | DTOs genéricos reaproveitados por todos os serviços |
| `defineEndpoint` + `PathParams<'/orders/:id'>` | Parâmetros de rota extraídos do caminho em tempo de compilação |
| `EndpointRequest<E>` / `EndpointResponse<E>` | Requisição e resposta inferidas do contrato, no servidor e no cliente |
| `route(app, endpoint, handler)` | Valida params, query e body com Zod, checa token, papel e escopos e valida a saída |
| `callEndpoint` / `ServiceClient` | Cliente HTTP tipado, com token de serviço em cache para chamadas internas |
| `DomainError` e subclasses | Erros de negócio com código estável e status HTTP definido num só lugar |
| `eventSchemas` | Cada evento tem esquema próprio, validado ao publicar e ao consumir |

Toda resposta segue o mesmo envelope:

```json
{ "ok": true, "data": { "id": "...", "status": "PENDING" } }
{ "ok": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "details": {}, "requestId": "..." } }
```

## Usando a API

O login da interface usa Authorization Code com PKCE. Para scripts, faça o mesmo fluxo (o [`scripts/smoke.mjs`](scripts/smoke.mjs) é um exemplo completo):

```bash
# catálogo público
curl "http://localhost:8080/api/v1/catalog/products?q=café&sort=price_asc&pageSize=10"

# com o token do usuário
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"productId":"<id>","quantity":2}' http://localhost:8080/api/v1/cart/items

# fechar o pedido
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"paymentMethod":"pix","shippingAddress":{"recipient":"Ana","street":"Rua A","number":"10","district":"Centro","city":"Niterói","state":"RJ","postalCode":"24020-000"}}' \
     http://localhost:8080/api/v1/orders
```

| Rota | O que faz |
|---|---|
| `POST /oauth/authorize` · `POST /oauth/token` · `POST /oauth/revoke` · `GET /oauth/jwks` | Login com PKCE, emissão e revogação de tokens, chaves públicas |
| `POST /api/v1/auth/register` · `GET /api/v1/auth/me` | Cadastro e usuário atual |
| `GET /api/v1/catalog/products` · `GET .../{id}` | Lista com busca, categoria, faixa de preço, ordenação e paginação |
| `POST/PATCH/DELETE /api/v1/catalog/products` · `POST /api/v1/catalog/categories` | Gestão do catálogo (`catalog:write`) |
| `GET /api/v1/inventory` · `PUT /api/v1/inventory/{id}` | Saldo por produto e ajuste (`inventory:write`) |
| `GET/DELETE /api/v1/cart` · `POST /api/v1/cart/items` · `PATCH .../{productId}` | Carrinho |
| `POST /api/v1/orders` · `GET /api/v1/orders` · `GET .../{id}` · `POST .../{id}/cancel` | Checkout, histórico e cancelamento |
| `PATCH /api/v1/orders/{id}/status` | Envio, entrega ou cancelamento pela loja (`orders:manage`) |
| `GET /api/v1/payments/orders/{orderId}` | Pagamentos e estornos do pedido |
| `GET /api/v1/notifications` · `/unread` · `POST .../{id}/read` · `/read-all` | Notificações |

## Configuração

As principais variáveis do `.env` (a lista completa está no manual):

| Variável | Padrão | O que faz |
|---|---|---|
| `APP_PORT` / `GATEWAY_PORT` | `8080` / `8000` | Portas da interface e da API |
| `DB_USER` / `DB_PASSWORD` | `cesto` / — | PostgreSQL. Gerada pelos scripts; nunca publique a sua |
| `SERVICE_CLIENT_SECRET` | — | Segredo do cliente OAuth2 usado entre serviços |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | `900` / `2592000` | Validade dos tokens em segundos |
| `WEB_REDIRECT_URIS` | `http://localhost:8080/callback` | Endereços permitidos para o login da interface |
| `CORS_ORIGINS` | `http://localhost:8080` | Origens aceitas pelos serviços |
| `SEED_DEMO` | `true` | Contas, categorias, produtos e estoque de demonstração |
| `PAYMENT_DECLINE_ABOVE_CENTS` / `PAYMENT_DELAY_MS` | `500000` / `800` | Comportamento do pagamento simulado |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `300` / `1 minute` | Limite de requisições por IP no gateway |
| `LOG_LEVEL` | `info` | Nível dos logs |

<p align="center">
  <img src="docs/images/tela-notificacoes.png" width="49%" alt="Notificações geradas pelos eventos do pedido">
  <img src="docs/images/tela-entrada.png" width="49%" alt="Entrada com OAuth2 e PKCE">
</p>

## Desenvolvimento e testes

Sem Docker, com Node.js 22, PostgreSQL 16 e Redis 7 locais:

```bash
npm ci
cp .env.example .env                 # ajuste DB_USER, DB_PASSWORD e DB_HOST
psql -U postgres -f docker/postgres/init.sql
npm run generate                     # clientes Prisma de cada serviço
npm run build
npm run migrate                      # aplica as migrações nos seis bancos
npm run dev                          # sobe os oito serviços com recarga automática
npm run dev -w apps/web              # interface em http://localhost:5173
```

```bash
npm test                             # testes unitários e de integração (Vitest)
TEST_REDIS_URL=redis://localhost:6379 npm test   # inclui o barramento com Redis real
npm run typecheck                    # TypeScript estrito em todos os pacotes
API_URL=http://localhost:8000 npm run smoke      # 21 verificações ponta a ponta na API rodando
```

O GitHub Actions compila tudo, roda os testes, aplica as migrações, sobe os serviços, executa o teste ponta a ponta e constrói as imagens Docker a cada push.

### Estrutura

```text
packages/contracts/   esquemas Zod, DTOs genéricos, contratos das rotas, eventos e cliente tipado
packages/core/        servidor Fastify, rotas tipadas, OAuth2 (verificação), erros de domínio, outbox, OpenAPI
packages/bus/         barramento de eventos em Redis Streams com novas tentativas e dead-letter
services/             gateway, auth, catalog, inventory, cart, orders, payments, notifications
  */prisma/           esquema e migrações de cada banco
apps/web/             loja e painel em React + Vite
docker/               Dockerfiles, Nginx e criação dos bancos
scripts/              desenvolvimento local, migrações, geração do Prisma e teste ponta a ponta
docs/                 manuais em PDF e imagens do README
.github/workflows/    CI
```

### Como personalizar

1. **Nova rota:** declare o contrato em `packages/contracts/src/api.ts` e registre com `route(app, api.x.y, handler)` no serviço. Validação, autorização, OpenAPI e tipos do cliente vêm juntos.
2. **Novo evento:** acrescente o esquema em `eventSchemas`, grave no outbox de quem publica e inscreva o handler com `bus.subscribe` em quem consome.
3. **Gateway de pagamento real:** implemente a interface `PaymentGateway` em `services/payments/src/gateway.ts` e troque o `SimulatedGateway` no `main.ts`.
4. **Novo serviço:** copie um serviço existente, crie o banco em `docker/postgres/init.sql`, adicione o bloco no `docker-compose.yml` e o prefixo em `services/gateway/src/routes.ts`.

O passo a passo de cada caso, com exemplos, está no manual.

### Componentes de terceiros

O Cesto depende de componentes com licenças próprias, que continuam valendo para cada um deles:

| Componente | Uso no projeto | Licença |
|---|---|---|
| [Fastify](https://fastify.dev/) | Servidor HTTP dos serviços e proxy do gateway | MIT |
| [Prisma](https://www.prisma.io/) | ORM, migrações e cliente tipado | Apache-2.0 |
| [Zod](https://zod.dev/) | Validação e inferência de tipos | MIT |
| [jose](https://github.com/panva/jose) | Assinatura e verificação de JWT e JWKS | MIT |
| [ioredis](https://github.com/redis/ioredis) | Cliente Redis para Streams, carrinho e rate limit | MIT |
| [React](https://react.dev/) e [Vite](https://vite.dev/) | Interface web | MIT |
| [Lucide](https://lucide.dev/) | Ícones da interface | ISC |
| [Public Sans](https://public-sans.digital.gov/) | Fonte da interface | SIL Open Font License 1.1 |
| [Swagger UI](https://github.com/swagger-api/swagger-ui) | Página de documentação da API | Apache-2.0 |
| [Vitest](https://vitest.dev/) | Testes automatizados | MIT |

PostgreSQL, Redis e Nginx rodam como serviços externos via Docker e não são redistribuídos neste repositório; cada um segue a licença da sua própria imagem.

## Licença

Copyright (©) 2026 Clara A. Portes

Este projeto é distribuído sob a licença [MIT](LICENSE). Você pode usar, copiar, modificar e redistribuir o código, inclusive para fins comerciais, desde que mantenha o aviso de copyright e o texto da licença.
