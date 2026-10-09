# Catalog AI

🇺🇸 English · [🇧🇷 Português](README.pt-BR.md)

A **multi-tenant** mini SaaS: each company manages its own product catalog, and an **AI agent** answers customer questions by querying the real database (tool calling), always restricted to the data of the logged-in user's company.

![Admin dashboard](docs/screenshots/dashboard-admin.png)

| Chat with the assistant (dark mode, TechNova admin) | User view (read-only) | Mobile |
|---|---|---|
| ![Chat](docs/screenshots/chat.png) | ![User](docs/screenshots/dashboard-user-dark.png) | ![Mobile](docs/screenshots/mobile.png) |

> The UI, the demo data and the agent's answers are in Brazilian Portuguese (the agent's system prompt asks for pt-BR). Internationalizing the UI is listed under production improvements.

## What's inside

- **Backend:** Node.js + Express + MongoDB (Mongoose), strict TypeScript.
- **Auth:** JWT, `admin` and `user` roles, permission middleware.
- **Multi-tenant:** isolation by `company_id`, enforced in two layers (repository + Mongoose plugin).
- **AI agent:** tool-calling loop with any OpenRouter model (Claude, OpenAI, free models...), with **SSE streaming**.
- **Frontend:** React + TypeScript (Vite), responsive, **dark mode**.
- **Product image upload** (PNG, JPEG, WebP, up to 2 MB), validated by the file's actual bytes.
- **Extras:** Docker Compose, seed script, **86 automated tests** (63 backend, 23 frontend).

## Tech stack

| Layer | Technologies |
|---|---|
| **Backend** | [Node.js](https://nodejs.org) 22 · [Express](https://expressjs.com) 5 · [TypeScript](https://www.typescriptlang.org) 6 (strict) · [MongoDB](https://www.mongodb.com) 7 with [Mongoose](https://mongoosejs.com) 9 |
| **Validation and security** | [Zod](https://zod.dev) 4 (env, request bodies, tool schemas) · JWT (`jsonwebtoken`) · `bcryptjs` · `helmet` · `cors` · `express-rate-limit` |
| **AI** | [OpenRouter](https://openrouter.ai) (one OpenAI-compatible API for Claude, GPT and free models) through the `openai` SDK · **tool calling** · **Server-Sent Events** streaming |
| **Uploads** | `multer` (memory storage) + content sniffing by magic bytes, files on disk behind an `ImageStorage` interface |
| **Frontend** | [React](https://react.dev) 19 · TypeScript · [Vite](https://vite.dev) 8 · React Router 7 · [TanStack Query](https://tanstack.com/query) 5 · `react-markdown` for chat answers · plain CSS with design tokens (light and dark themes) |
| **Infra** | Docker and Docker Compose · multi-stage Dockerfiles · nginx 1.27 (serves the SPA and proxies `/api`) |
| **Quality** | [Vitest](https://vitest.dev) 5 · Supertest · `mongodb-memory-server` · Testing Library · ESLint (`typescript-eslint`) · oxlint · Prettier |

## Setting up the AI (OpenRouter)

The chat agent talks to an LLM through [OpenRouter](https://openrouter.ai), a single OpenAI-compatible API that routes to many providers (Claude, GPT, Gemini, open models, free models...). You only need one key, and you can change the model without touching the code.

**1. Create an account.** Go to [openrouter.ai](https://openrouter.ai) and sign in (Google, GitHub or e-mail).

**2. Create an API key.**
1. Open [openrouter.ai/keys](https://openrouter.ai/keys) (menu *Keys*).
2. Click **Create API Key**, give it a name (e.g. `catalog-ai`) and, optionally, a credit limit.
3. **Copy the key right away** (`sk-or-v1-...`): it is shown only once. Treat it as a password and never commit it (`.env` is git-ignored).

**3. Choose a model.** Open [openrouter.ai/models](https://openrouter.ai/models) and **filter by *Supported parameters → tools***: the agent needs **tool calling**, and a model without it cannot query the catalog. Use the model's slug (the id shown on its page, with the copy button), for example:

| Model slug | Cost | Notes |
|---|---|---|
| `dots-studio/dots-3-note-preview:free` | free | **Default** when `LLM_MODEL` is empty. A preview model: it may change, disappear or be rate limited |
| `openai/gpt-4.1-mini` | paid, cheap | Good price/quality for this use case |
| `anthropic/claude-haiku-5.5` | paid, cheap | Fast Claude model |
| `openai/gpt-4.1` | paid | Stronger, more expensive |

Free models end with `:free` (filter by *Prices → Free*, or open [this list](https://openrouter.ai/models?supported_parameters=tools&max_price=0)). Prices and availability change, so always check the model page.

**4. Free tier limits.** Without credits, free models are limited (around 50 requests per day and a few per minute per account, at the time of writing). When the quota is exhausted, the chat answers *"O provedor de IA atingiu o limite de uso"* (`429`). To lift it, add credits at [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits) (a small amount is enough, and it also unlocks a much higher free-model quota) or switch to a paid model.

**5. Configure the project.** In `.env` (Docker) or `api/.env` (local):

```bash
OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL=openai/gpt-4.1-mini     # optional: leave empty to use the free default
```

After editing `.env` with the stack already running, recreate the API so it reads the new values: `docker compose up -d api`.

**6. Check that the key works** (should return `200` and your key info):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

## Running in ~5 minutes

### Option 1: Docker Compose (recommended)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env
```

Edit `.env` and set your OpenRouter key (see [Setting up the AI](#setting-up-the-ai-openrouter) to create one, it takes a minute):

```bash
OPENROUTER_API_KEY=sk-or-...
# Optional: the default is a free preview model, which may change or go offline.
# LLM_MODEL=openai/gpt-4.1-mini
```

Then:

```bash
docker compose up --build -d      # mongo + api + web
docker compose run --rm seed      # 2 companies, 25 products, 4 users
```

Open **http://localhost:8080**.

Without an AI key everything works except the chat, which answers `503` with a message explaining what is missing.

To stop: `docker compose down` (add `-v` to delete the data).

### Option 2: Local (no Docker for the app)

Requirements: Node 22+ and a reachable MongoDB.

```bash
docker run -d --name catalog-mongo -p 27017:27017 mongo:7   # or use a local Mongo

cp .env.example api/.env      # fill in OPENROUTER_API_KEY

# terminal 1: API on :3000
cd api && npm install && npm run seed && npm run dev

# terminal 2: web on :5173
cd web && npm install && npm run dev
```

Open **http://localhost:5173**.

Vite proxies `/api/*` to `http://localhost:3000`, so there is no CORS in development.

### Seed users

Password for everyone: `senha1234`

| Company | Role | E-mail | Invite code |
|---|---|---|---|
| TechNova Eletrônicos (electronics) | admin | `admin@technova.example` | `technova-demo` |
| TechNova Eletrônicos | user | `user@technova.example` | |
| Casa & Aroma (home and decor) | admin | `admin@casaaroma.example` | `casaaroma-demo` |
| Casa & Aroma | user | `user@casaaroma.example` | |

**Suggested script to check tenant isolation:** sign in as `user@casaaroma.example` and ask *"Tem vela de lavanda? E algum notebook?"* (Is there a lavender candle? And any laptop?); then sign in as `user@technova.example` and ask the same thing. Each one only sees their own catalog.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | (required, min. 16 chars) | Token signing secret. `.env.example` ships a placeholder: change it for anything beyond a local demo |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `OPENROUTER_API_KEY` | | OpenRouter key (required for the chat) |
| `LLM_MODEL` | `dots-studio/dots-3-note-preview:free` | OpenRouter model with tool-calling support (e.g. `openai/gpt-4.1-mini` or `anthropic/claude-haiku-5.5`) |
| `UPLOAD_DIR` | `uploads` | Folder for uploaded images (in Compose, the `uploads-data` volume mounted at `/app/uploads`) |
| `WEB_PORT` | `8080` | Frontend port in Compose |
| `MONGODB_URI`, `PORT`, `CORS_ORIGIN` | | Local runs only; Compose sets them itself |

Variables are validated with zod at startup: if something is wrong, the API does not start and says why.

### Tests and quality

```bash
(cd api && npm install && npm test && npm run typecheck && npm run lint)   # 63 tests (in-memory Mongo)
(cd web && npm install && npm test && npm run build && npm run lint)       # 23 tests
```

Backend tests use `mongodb-memory-server` (it downloads a Mongo binary on first run) and a simulated LLM: **no test calls a real AI provider**, even if there is a key in `.env`.

## API

All routes except `/auth/register`, `/auth/login` and `/health` require `Authorization: Bearer <jwt>`.

| Method and route | Who | Description |
|---|---|---|
| `POST /auth/register` | public | Creates a new company (becomes `admin`) with `companyName`, **or** joins an existing one with `inviteCode` (becomes `user`) |
| `POST /auth/login` | public | Returns `{ token, user }` |
| `GET /auth/me` | authenticated | User and company (`inviteCode` is only shown to admins) |
| `GET /products` | admin, user | Filters `q`, `category`, `minPrice`, `maxPrice`, `page`, `limit` |
| `GET /products/categories`, `GET /products/:id` | admin, user | |
| `POST /products`, `PUT /products/:id`, `DELETE /products/:id` | **admin only** | `403` for `user` |
| `PUT /products/:id/image`, `DELETE /products/:id/image` | **admin only** | `multipart/form-data` upload (field `image`) or image removal |
| `POST /chat` | admin, user | `{ message, history? }`. With `Accept: text/event-stream` it answers over SSE (`text`, `tool`, `done`, `error`); otherwise JSON `{ reply, toolCalls }` |

`GET /uploads/<companyId>/<file>` serves the uploaded images (public, no token; see "Image upload").

Errors always follow the shape `{ "error": { "message", "details?" } }`.

## Using the app

1. **Sign in** at http://localhost:8080 with a [seed user](#seed-users). The tabs *Entrar* (sign in), *Criar empresa* (create company) and *Convite* (invite) also let you register: *Criar empresa* makes a new company and its first `admin`; *Convite* joins an existing company as a `user` with its invite code (shown to admins on the dashboard).
2. **Products** (dashboard): browse, search by text and filter by category. As `admin` you can create, edit and delete products (name, description, price, category from a list or a new one, and an optional image upload up to 2 MB). As `user` the catalog is read-only.
3. **Assistant** (chat): ask in natural language ("Do you have anything under R$ 100?", "Which categories exist?"). The agent queries your company's catalog through tools and streams the answer. It only knows the products of the logged-in company.
4. **Theme:** the moon/sun button toggles dark mode; the choice is remembered.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Chat says the AI is unavailable (`503`) | `OPENROUTER_API_KEY` is empty. Set it in `.env` and run `docker compose up -d api` |
| Chat says *"O provedor de IA atingiu o limite de uso"* (`429`) | Free quota exhausted. Wait for the daily reset, add credits or use a paid `LLM_MODEL` |
| Chat shows a generic error right away | The model may not support tool calling, or the provider rejected the request. Check `docker compose logs api` and try another `LLM_MODEL` |
| `port is already allocated` | Port `3000` (API) or `8080` (web) is in use. Stop the other process; for the web port, set `WEB_PORT` in `.env`. The API port is fixed at `3000` |
| `JWT_SECRET` error when starting Compose | You did not create `.env`: run `cp .env.example .env` |
| Login says invalid credentials | Run the seed (`docker compose run --rm seed`) and use the [seed users](#seed-users) (password `senha1234`) |
| Start over with clean data | `docker compose down -v` (also deletes uploaded images), then up and seed again |

## Architecture decisions

### Backend structure

```
api/src
├── config/        env (zod) and Mongo connection
├── lib/           application errors, tenant plugin
├── middlewares/   authenticate, requireRole, validate, errorHandler
├── modules/
│   ├── auth/      user model, JWT token, schemas, service, controller, routes
│   ├── companies/ company model
│   ├── products/  model, repository, schemas, service, controller, routes
│   └── chat/      agent, tools, prompt, LLM clients, SSE
├── seed/          demo data (idempotent)
├── app.ts         builds the Express app (does not open a port, so it is testable)
└── server.ts      opens the port and handles shutdown
```

Layers per module: **routes → controller → service → repository/model**. The controller only translates HTTP, business rules live in the service and data access in the repository. `app.ts` is separate from `server.ts` and receives the LLM client as a parameter (`createApp({ llm })`), which allows testing routes with `supertest` and a simulated LLM, with no network.

### Multi-tenant: isolation does not depend on "remembering to filter"

I chose **one shared database with `company_id` on every document** (rather than a database per tenant): it is the simplest model to operate with many small tenants, and isolation is enforced in code:

1. **The tenant comes only from the JWT.** `company_id` is read from `req.auth` (verified token), never from the body, query or params. Input schemas are `strictObject`: sending `company_id` in the body returns `400`.
2. **A repository with "no way to forget".** Every function takes `companyId` as a required first argument.
3. **Safety net on the model** (`lib/tenantScope.ts`, a Mongoose plugin): any `find`/`update`/`delete`/`count` without a concrete `company_id` **throws**, including filters with operators such as `{ $ne: id }` (which would match other tenants). `aggregate` must start with a tenant `$match`. `company_id` is immutable on updates.
4. **`404`, not `403`**, when accessing another company's resource: it does not reveal that the id exists.

The tests cover listing, reading, editing, deleting, search and categories across two companies, at the repository level, over HTTP and through the chat.

`User` and `Company` are deliberately left out of the plugin: login looks up by e-mail *before* the tenant is known.

### Auth and permissions

- JWT HS256 with `sub`, `companyId` and `role`; the algorithm is **pinned** on verification (there is a test with an `alg: none` token).
- Passwords use bcrypt (cost 10), with `select: false` on the hash. Login responds the same for an unknown e-mail and a wrong password and spends the same time in both cases (throwaway hash), so accounts cannot be enumerated.
- `authenticate` + `requireRole('admin')` are composed as route middlewares. Permissions are checked on the server; hiding buttons in the frontend is only UX.
- **How does a `user` join a company?** The challenge does not define it. I chose a per-company **invite code** (visible only to the admin): accepting a `companyId` at registration would let anyone join another company.
- Rate limits: 30 requests/15 min on register and login (per IP) and 20 chat messages/min (**per user**, since each call costs tokens). `helmet`, restricted CORS and a 100 kb body limit.

### AI agent

`POST /chat` runs a **real tool-calling loop** (`chat.agent.ts`): the model decides whether it needs a tool, the server runs it, returns the result and the model writes the answer, capped at 5 iterations.

- **Tools:** `search_products` (text, category, price range, limit) and `list_categories`. Schemas are zod and become the JSON Schema sent to the model, so there is a single source of truth.
- **The model never chooses the tenant.** `companyId` is injected by the server from the JWT; the tool schema does not even have that field, and extra arguments are dropped. A test simulates a model trying to pass another company's `company_id`.
- **Tool errors go back to the model** as `is_error` (unknown tool, invalid parameters) so it can correct itself instead of failing the request.
- **Prompt injection:** the system prompt tells the model to treat product names and descriptions as data, not instructions. The defense that really matters is structural: even if the model is fooled, the tools can only reach the user's tenant.
- **OpenRouter:** a single OpenAI-compatible API gives access to Claude, GPT and free models, and the model is switched with `LLM_MODEL`, with no code change. I validated the full flow (login → chat → tool → streamed answer) with a real key and the default model; other models depend on tool-calling support at OpenRouter.
- **`LlmClient` interface:** the agent depends only on it, using a neutral message format (`llm.ts`) and an adapter to the OpenAI format (`openai-format.ts`). Switching providers (for example, Anthropic's native SDK) means writing another implementation, and tests use a scripted, deterministic LLM.
- **Own loop instead of LangChain:** for this scope (two tools and a short loop, with injected tenant and SSE streaming), using the OpenAI-compatible client directly keeps every step (model call → tool execution → result returned) visible, testable and easy to explain, with no abstraction layers. Since the logic sits behind the `LlmClient` interface, moving to LangChain/LangGraph is a localized swap; I would do it once there are multiple agents, conversation memory, RAG or orchestration across models.
- **SSE streaming** instead of WebSocket: the flow is one-way (server → client), SSE is plain HTTP (passes through proxies, no handshake), and the client cancels by aborting the `fetch`, which also aborts the LLM call. The frontend uses `fetch` + stream because `EventSource` cannot POST or send `Authorization`. WebSocket becomes worthwhile with two-way communication (presence, handoff to a human agent, several devices in the same conversation).
- **Search:** every word of the query must match in name, description or category, in any order, and the user's text is escaped before becoming a regex. This showed up in real testing: "vela de lavanda" did not find "Vela Aromática Lavanda" in the first version.

### Image upload

- **Storage behind an interface** (`ImageStorage`, `modules/uploads`): today it writes to disk at `uploads/<companyId>/<uuid>.<ext>`, with a Compose volume so files survive container recreation. Switching to S3/GCS means writing another implementation; I did not use S3 now to keep setup at 5 minutes, with no cloud account.
- **The type is decided from the bytes**, not from `Content-Type` or the file name (the client can forge both). Only PNG, JPEG and WebP; **SVG is rejected** because it can carry scripts. 2 MB limit (`413`) and one file per request.
- **Multi-tenant:** the product is looked up by the JWT's `companyId` before anything is written (`404` for another company), and the file goes into the company's own folder. The name is generated on the server (UUID), so there is no path traversal, and `imageUrl` in the body only accepts `http(s)`, which prevents pointing to another company's file.
- **No orphan files:** replacing or removing the image, switching to an external URL or deleting the product deletes the old file; if the database write fails, the new file is discarded.
- **Public reads:** `<img>` cannot send `Authorization`, so `/uploads` is public. Protection comes from the random name (UUID, unguessable) and disabled directory listing. In production: signed URLs with expiry, or a CDN with restricted access.

### Frontend

- **Vite + React + TypeScript**: the challenge only asks for React + TS, and Vite is the recommended toolchain for SPAs. Next.js would bring SSR and API routes the project does not use, since there is a separate API.
- **TanStack Query** for server state (cache, invalidation after mutations), plain context for the session, and custom CSS with variables (tokens) instead of a UI library: fewer dependencies and full control of dark mode.
- Dark mode respects `prefers-color-scheme`, persists the choice and avoids the theme "flash" by setting the attribute before React mounts.
- Loading, error and empty states on every screen, native `<dialog>` for modals (focus and ESC for free), `prefers-reduced-motion`, responsive layout.
- Any `401` response ends the session.

### Infra

Docker Compose with `mongo` (healthcheck and volume), `api` (multi-stage build, production dependencies only, non-root user) and `web` (nginx serving the build and forwarding `/api` to the API on the same domain, with `proxy_buffering off` so SSE is not held back). The seed is a separate job (`docker compose run --rm seed`) because it refuses to run with `NODE_ENV=production`.

## What I would do differently in production

**Scale**
- Stateless API: scales horizontally behind a load balancer. Rate limiting in Redis (today it is in memory, per instance).
- MongoDB as a **replica set** (high availability and transactions; today registration manually compensates by undoing the company creation if the user creation fails). Shard key starting with `company_id`.
- Search with a text index or Atlas Search / OpenSearch (today it is a regex with `company_id` in the index, fine for small catalogs), and cursor pagination.
- Chat: queue or concurrency limit for the LLM provider, per-tenant quota and budget, caching of frequent queries and model *fallback*.
- Internationalization: UI strings, API error codes (translated by the client) and the agent's answer language chosen per user.
- Real time: if the chat evolves into support with humans, WebSocket with a pub/sub adapter (Redis) for several API instances.
- Images: S3/GCS with signed URLs and a CDN instead of local disk (which does not scale across API instances), resizing/optimization (thumbnails, WebP) and file scanning.

**Security**
- Short-lived access tokens + rotating **refresh token** with revocation, in an `httpOnly` cookie + CSRF protection. Today the JWT lives in `localStorage` (simple, but exposed to XSS) and lasts 1 day.
- Secrets in a secrets manager, key rotation, verified e-mail, password policy and MFA for admins.
- E-mail invitations with expiry and single use, instead of a fixed code per company. Audit log of admin actions.
- CSP and other security headers in nginx, dependency and image scanning in CI.
- For enterprise customers, an option of a dedicated database per tenant. Privacy review of what is sent to the LLM provider (contract, retention, personal data).

**Monitoring and operations**
- Structured logs (e.g. pino) with `requestId`, `userId` and `companyId`; metrics (latency, error rate, Mongo saturation) and tracing with OpenTelemetry; Sentry for frontend and backend errors.
- Agent observability: per-conversation traces (prompt, tools called, latency, tokens and cost per tenant) with Langfuse or LangSmith, plus an evaluation set (questions with expected answers) running in CI to catch regressions when changing model or prompt.
- Liveness and readiness probes, alerts (error rate, p95, LLM cost), backups and database restore drills.
- CI with lint, tests and build, plus end-to-end tests (Playwright) of the login → CRUD → chat flow.

## Known limitations

- Upload stores the image as sent, with no resizing or optimization, and local disk storage does not work across several API instances.
- Automated tests do not call a real LLM; the provider integration was validated manually (see the script above). Free OpenRouter models may fluctuate or be rate limited; the default is a *preview* model, so you may need to change `LLM_MODEL`.
- Free OpenRouter models have a daily quota per account (without credits, around 50 requests per day); when exceeded, the chat answers "O provedor de IA atingiu o limite de uso" (the AI provider reached its usage limit, `429`). Adding credits or using another key fixes it.
- The default free model goes through a provider that rejects some texts with `400` (for example, phrases like "ignore as regras anteriores", i.e. "ignore the previous rules"); in that case the chat shows the generic error message. Paid models or other OpenRouter providers do not have this restriction.
- There are no browser end-to-end tests; the frontend tests cover streaming, permissions and the main flows with a simulated API.
- There is no password recovery or e-mail verification.
