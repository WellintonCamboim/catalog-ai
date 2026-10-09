# Catalog AI: API reference

🇺🇸 English · [🇧🇷 Português](API.pt-BR.md) · Machine-readable spec: [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0, importable into Swagger UI, Postman or Insomnia)

REST API in JSON, plus one Server-Sent Events (SSE) endpoint for the AI chat.

## Contents

- [Basics](#basics): base URL, authentication, roles, multi-tenancy, errors, rate limits
- [Quick start](#quick-start)
- [Health](#health)
- [Auth](#auth): register, login, me
- [Products](#products): list, categories, get, create, update, delete
- [Product images](#product-images): upload, remove, serving
- [Chat](#chat): JSON and SSE streaming
- [Data models](#data-models)
- [Using the spec](#using-the-spec-swagger-postman-insomnia)

## Basics

### Base URL

| How you run it | Base URL |
|---|---|
| Docker Compose, through the web container (nginx) | `http://localhost:8080/api` |
| Docker Compose, API directly | `http://localhost:3000` |
| Local dev (`npm run dev`) | `http://localhost:3000` (or `http://localhost:5173/api` through the Vite proxy) |

All examples below use `http://localhost:3000`. Through nginx, prefix every path with `/api`.

### Format

- Requests with a body use `Content-Type: application/json` (except the image upload, which is `multipart/form-data`). The JSON body limit is **100 kB**.
- Responses are JSON. Timestamps are ISO 8601 UTC strings. Prices are numbers in BRL (R$).
- Success status codes: `200` (read, update), `201` (create, register), `204` (delete, no body).

### Authentication

Every route except `GET /health`, `POST /auth/register`, `POST /auth/login` and `GET /uploads/...` needs a JWT:

```
Authorization: Bearer <token>
```

- The token is returned by **register** and **login**. It is an HS256 JWT valid for **1 day** (`JWT_EXPIRES_IN`), carrying `sub` (user id), `companyId` and `role`.
- A missing, malformed, expired or tampered token returns `401`.
- There is no refresh endpoint: sign in again when it expires.

### Roles and permissions

| Role | Can do |
|---|---|
| `admin` | Everything a `user` can, plus create, update and delete products and manage their images. Sees the company's invite code in `GET /auth/me` |
| `user` | Read products and categories, and use the chat |

A `user` calling an admin-only route gets `403 Apenas administradores podem fazer isso`. Permissions are enforced on the server.

### Multi-tenancy

Each user belongs to exactly one company. **The company always comes from the token**, never from the request: there is no `company_id` parameter anywhere. Product and chat bodies reject unknown fields (so a `company_id` there returns `400`), and the auth routes simply ignore them. All product queries are filtered by the caller's company, so:

- a company never sees another company's products, categories or chat answers;
- reading, editing or deleting another company's product returns **`404`** (not `403`), so the id is not revealed.

### Errors

Every error has the same shape:

```json
{ "error": { "message": "Human readable message", "details": { "field": ["reason"] } } }
```

`details` only appears on validation errors (`400`), keyed by field name. Constraint messages come from the validator and may be in English (for example `Too small: expected string to have >=2 characters`); custom messages are in Portuguese. For unknown extra fields in a body, `details` is an empty object.

| Status | Meaning | Examples |
|---|---|---|
| `400` | Validation failed | Invalid body, query or missing upload field |
| `401` | Not authenticated | `Não autenticado`, `Token inválido ou expirado`, `Credenciais inválidas` |
| `403` | Authenticated but not allowed | `Apenas administradores podem fazer isso` |
| `404` | Not found, or belongs to another company | `Produto não encontrado`, `Rota não encontrada`, `Código de convite inválido` |
| `409` | Conflict | `E-mail já cadastrado` |
| `413` | Upload too large | `Imagem muito grande (máximo 2 MB)` |
| `415` | Unsupported image type | `Formato não suportado: use PNG, JPEG ou WebP` |
| `429` | Too many requests, or AI provider quota reached | See [rate limits](#rate-limits) and [Chat](#chat) |
| `502` | The AI provider failed (JSON chat only) | `Não foi possível obter a resposta do agente` |
| `503` | AI not configured | `Agente de IA indisponível: OPENROUTER_API_KEY não configurada` |
| `500` | Unexpected server error | `Erro interno do servidor` |

### Rate limits

| Scope | Limit | Key |
|---|---|---|
| `POST /auth/register`, `POST /auth/login` | 30 requests per 15 minutes | client IP |
| `POST /chat` | 20 requests per minute | authenticated user |

Exceeding a limit returns `429` with the headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `Retry-After` (seconds), and a **plain-text** body, `Too many requests, please try again later.`, not the JSON error shape above. Handle `429` by status code.

### CORS

Browsers are allowed from a single origin (`CORS_ORIGIN`, default `http://localhost:5173`). Through the web container or the Vite proxy the browser talks to the same origin, so CORS does not apply.

## Quick start

```bash
BASE=http://localhost:3000

# 1. sign in with a seed user and keep the token
TOKEN=$(curl -s $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@technova.example","password":"senha1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 2. list products
curl -s "$BASE/products?limit=3" -H "Authorization: Bearer $TOKEN"

# 3. ask the agent
curl -s $BASE/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"Quais produtos custam até R$ 200?"}'
```

(Seed users are listed in the [README](../README.md#seed-users).)

## Health

### `GET /health`

Public. Liveness check.

```json
{ "status": "ok" }
```

## Auth

### `POST /auth/register`

Public. Creates a user and returns a token. Send **exactly one** of `companyName` or `inviteCode`:

- `companyName` → creates a new company and the user becomes its **`admin`**.
- `inviteCode` → joins the existing company that owns that code and the user becomes a **`user`**.

| Field | Type | Rules |
|---|---|---|
| `name` | string | 2 to 120 characters |
| `email` | string | valid e-mail (stored lower-case, must be unique) |
| `password` | string | 8 to 72 characters |
| `companyName` | string | 2 to 120 characters (new company) |
| `inviteCode` | string | code shown to the company admin |

```bash
curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@example.com","password":"senha-forte-1","companyName":"Minha Loja"}'
```

`201 Created`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "6ac960bd38959668bd8b7da9",
    "name": "Ana",
    "email": "ana@example.com",
    "role": "admin",
    "companyId": "6ac960bd38959668bd8b7da8"
  }
}
```

Errors: `400` validation (including sending both or neither of `companyName` and `inviteCode`), `404` unknown invite code, `409` e-mail already registered, `429` rate limit.

### `POST /auth/login`

Public.

```bash
curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@technova.example","password":"senha1234"}'
```

`200 OK`: same body as register (`token` and `user`).

Errors: `400` validation, `401 Credenciais inválidas` (the same answer, and the same response time, for an unknown e-mail and a wrong password), `429`.

### `GET /auth/me`

Authenticated. Returns the current user and company. `inviteCode` is included **only for admins**.

```bash
curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{
  "user": { "id": "6ac9...", "name": "Ana", "email": "ana@example.com", "role": "admin", "companyId": "6ac9..." },
  "company": { "id": "6ac9...", "name": "Minha Loja", "inviteCode": "1d821937eb9e" }
}
```

## Products

All product routes require authentication and only ever touch the caller's company.

### `GET /products`

Admin and user. Paginated list, newest first.

| Query parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string (1 to 100) | | Text search. Every word (3+ characters) must appear in the name, description or category, in any order, case-insensitive |
| `category` | string (1 to 60) | | Exact category name, case-insensitive |
| `minPrice` | number ≥ 0 | | Minimum price |
| `maxPrice` | number ≥ 0 | | Maximum price (`minPrice` must not exceed it) |
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer 1 to 100 | `20` | Page size |

```bash
curl -s "$BASE/products?q=notebook&maxPrice=6000&page=1&limit=10" -H "Authorization: Bearer $TOKEN"
```

```json
{
  "items": [
    {
      "id": "6ac9...",
      "name": "Notebook Essencial 15",
      "description": "Processador Ryzen 5, 8 GB de RAM, SSD de 256 GB, ótimo para estudos.",
      "price": 2999,
      "category": "Computadores",
      "imageUrl": "https://picsum.photos/seed/.../600/400",
      "createdAt": "2026-10-09T20:37:50.462Z",
      "updatedAt": "2026-10-09T20:37:50.462Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

Errors: `400` for an invalid query (for example `minPrice` greater than `maxPrice`), `401`.

### `GET /products/categories`

Admin and user. Distinct categories of the company.

```json
{ "items": ["Acessórios", "Áudio", "Celulares", "Computadores", "Periféricos", "Wearables"] }
```

### `GET /products/:id`

Admin and user. Returns one [Product](#product). `404` if the id does not exist, is malformed, or belongs to another company.

### `POST /products`

**Admin only.** Creates a product in the caller's company.

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 1 to 120 characters |
| `description` | string | yes | 1 to 2000 characters |
| `price` | number | yes | 0 to 1,000,000 |
| `category` | string | yes | 1 to 60 characters |
| `imageUrl` | string | no | `http` or `https` URL, up to 500 characters. To upload a file use [`PUT /products/:id/image`](#put-productsidimage) |

Unknown fields (including `company_id`) are rejected with `400`.

```bash
curl -s -X POST $BASE/products -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Caneca","description":"Caneca de cerâmica","price":29.9,"category":"Cozinha"}'
```

`201 Created`: the [Product](#product). Errors: `400`, `401`, `403`.

### `PUT /products/:id`

**Admin only.** Partial update: send only the fields to change (same rules as create, at least one field). Returns the updated [Product](#product).

```bash
curl -s -X PUT $BASE/products/$ID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"price":34.9}'
```

Setting `imageUrl` to an external URL deletes a previously uploaded file. Errors: `400` (empty body or invalid field), `401`, `403`, `404`.

### `DELETE /products/:id`

**Admin only.** Deletes the product and its uploaded image, if any. `204 No Content`. Errors: `401`, `403`, `404`.

## Product images

### `PUT /products/:id/image`

**Admin only.** Uploads (or replaces) the product image. `multipart/form-data` with a single file in the field **`image`**.

- Accepted types: **PNG, JPEG, WebP**. The type is detected from the file's actual bytes, not from its name or `Content-Type`. SVG is rejected.
- Maximum size: **2 MB**. One file per request.
- The previous uploaded image, if any, is deleted.

```bash
curl -s -X PUT $BASE/products/$ID/image -H "Authorization: Bearer $TOKEN" -F "image=@./foto.png"
```

`200 OK`: the updated [Product](#product), with a relative `imageUrl`:

```json
{ "id": "6ac9...", "name": "Caneca", "imageUrl": "/uploads/6ac9.../c931e00e-828d-490e-8906-c51d08fa19e1.png", "...": "..." }
```

Errors: `400` (no `image` field, or more than one file), `401`, `403`, `404`, `413` (over 2 MB), `415` (not PNG, JPEG or WebP).

### `DELETE /products/:id/image`

**Admin only.** Removes the image (uploaded file or external URL). Returns the [Product](#product) with `imageUrl: null`. Errors: `401`, `403`, `404`.

### `GET /uploads/<companyId>/<file>`

**Public** (no token). Serves an uploaded image, with the right `Content-Type` and a 7-day cache lifetime. Images are public by design, because `<img>` tags cannot send an `Authorization` header: protection comes from the unguessable UUID file names, and directory listing is disabled.

To display an uploaded image, prefix the relative `imageUrl` with the API base: `http://localhost:8080/api` + `/uploads/6ac9.../c931....png`. External `imageUrl` values (`http...`) are used as they are.

## Chat

### `POST /chat`

Admin and user. Sends a question to the AI agent, which decides whether to call its tools and answers with real data from **the caller's company catalog**. The agent has two tools, `search_products` and `list_categories`; the company is injected by the server from the token, so the model can never read another company's data. It answers in Brazilian Portuguese, calls tools up to 5 rounds, and refuses topics other than the company's products.

Request body:

| Field | Type | Required | Rules |
|---|---|---|---|
| `message` | string | yes | 1 to 2000 characters |
| `history` | array | no | Up to 20 previous turns: `{ "role": "user" \| "assistant", "content": "..." }`, content 1 to 4000 characters. The server keeps no conversation state, so send the history you want the agent to remember |

Unknown fields are rejected with `400`. The response format depends on the `Accept` header.

#### JSON response (default)

```bash
curl -s -X POST $BASE/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"Tem notebook?","history":[]}'
```

`200 OK`, after the agent finishes:

```json
{
  "reply": "Sim, temos notebooks!\n\n1. **Notebook Essencial 15** - R$ 2.999,00 ...",
  "toolCalls": ["search_products"]
}
```

Errors: `400`, `401`, `429` (rate limit, or the AI provider's quota: `O provedor de IA atingiu o limite de uso. Tente novamente em alguns minutos.`), `502` (provider failure), `503` (no `OPENROUTER_API_KEY`).

#### Streaming response (SSE)

Send `Accept: text/event-stream` to receive the answer as it is generated. The HTTP status is `200` as soon as the stream opens, so failures after that arrive as an `error` event.

```bash
curl -N -X POST $BASE/chat -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -d '{"message":"Quais categorias existem?"}'
```

```
event: tool
data: {"name":"list_categories"}

event: text
data: {"text":"Temos as "}

event: text
data: {"text":"seguintes categorias: ..."}

event: done
data: {}
```

| Event | Data | Meaning |
|---|---|---|
| `tool` | `{ "name": "search_products" }` | The agent is calling a tool (useful for a "searching..." indicator) |
| `text` | `{ "text": "..." }` | A chunk of the answer. Concatenate them in order |
| `done` | `{}` | The answer is complete |
| `error` | `{ "message": "..." }` | The agent failed (for example the provider quota was reached). The stream ends |

Closing the connection (or aborting the `fetch`) cancels the call to the model.

Browser example. `EventSource` cannot send a POST body or an `Authorization` header, so read the stream with `fetch`:

```js
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ message: 'Tem notebook?' }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const events = buffer.split('\n\n');
  buffer = events.pop(); // keep the incomplete tail
  for (const raw of events) {
    const event = /^event: (.*)$/m.exec(raw)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(raw)?.[1] ?? '{}');
    if (event === 'text') render(data.text);
    if (event === 'error') showError(data.message);
  }
}
```

If you proxy the API yourself, disable response buffering (nginx: `proxy_buffering off`), or the tokens arrive in one burst.

## Data models

### Product

| Field | Type | Description |
|---|---|---|
| `id` | string | Product id |
| `name` | string | Name |
| `description` | string | Description |
| `price` | number | Price in BRL |
| `category` | string | Category |
| `imageUrl` | string \| null | External `http(s)` URL, or a relative `/uploads/...` path for an uploaded image, or `null` |
| `createdAt`, `updatedAt` | string | ISO 8601 timestamps |

The company id is never exposed.

### User

| Field | Type | Description |
|---|---|---|
| `id` | string | User id |
| `name`, `email` | string | |
| `role` | `"admin"` \| `"user"` | |
| `companyId` | string | The company the user belongs to |

### Company (from `GET /auth/me`)

| Field | Type | Description |
|---|---|---|
| `id`, `name` | string | |
| `inviteCode` | string | Only for admins |

## Using the spec (Swagger, Postman, Insomnia)

[`openapi.yaml`](openapi.yaml) describes all routes, schemas and errors.

- **Swagger UI / Editor:** open [editor.swagger.io](https://editor.swagger.io), *File → Import file*, and pick `docs/openapi.yaml`. Use *Authorize* with a token from `POST /auth/login` to try the protected routes.
- **Postman / Insomnia:** import `docs/openapi.yaml` as an OpenAPI 3 collection and set a `Bearer` token on the collection.
- **Swagger UI locally with Docker:**

```bash
docker run --rm -p 8081:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "$PWD/docs:/spec" swaggerapi/swagger-ui
# then open http://localhost:8081
```
