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

## Running in ~5 minutes

### Option 1: Docker Compose (recommended)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env
```

Edit `.env` and set your OpenRouter key:

```bash
OPENROUTER_API_KEY=sk-or-...
# Optional: the default is a free preview model, which may change or go offline.
# LLM_MODEL=anthropic/claude-haiku-5-5
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

cp .env.example api/.env      # fill in the AI key
cd api && npm install && npm run seed && npm run dev          # API on :3000
cd web && npm install && npm run dev                          # web on :5173
```

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
| `JWT_SECRET` | (required, min. 16 chars) | Token signing secret |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `OPENROUTER_API_KEY` | | OpenRouter key (required for the chat) |
| `LLM_MODEL` | `dots-studio/dots-3-note-preview:free` | OpenRouter model with tool-calling support (e.g. `anthropic/claude-haiku-5-5`) |
| `UPLOAD_DIR` | `uploads` | Folder for uploaded images (in Compose, the `uploads-data` volume mounted at `/app/uploads`) |
| `WEB_PORT` | `8080` | Frontend port in Compose |
| `MONGODB_URI`, `PORT`, `CORS_ORIGIN` | | Local runs only; Compose sets them itself |

Variables are validated with zod at startup: if something is wrong, the API does not start and says why.

### Tests and quality

```bash
cd api && npm test && npm run typecheck && npm run lint    # 63 tests (in-memory Mongo)
cd web && npm test && npm run build && npm run lint        # 23 tests
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
