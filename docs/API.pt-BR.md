# Catalog AI: referência da API

[🇺🇸 English](API.md) · 🇧🇷 Português · Especificação legível por máquina: [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0, importável no Swagger UI, Postman ou Insomnia)

API REST em JSON, mais um endpoint de Server-Sent Events (SSE) para o chat com IA.

## Sumário

- [Fundamentos](#fundamentos): URL base, autenticação, perfis, multi-tenant, erros, limites de uso
- [Início rápido](#início-rápido)
- [Health](#health)
- [Auth](#auth): registro, login, me
- [Produtos](#produtos): listar, categorias, buscar um, criar, atualizar, excluir
- [Imagens de produto](#imagens-de-produto): envio, remoção, acesso
- [Chat](#chat): resposta em JSON e streaming
- [Modelos de dados](#modelos-de-dados)
- [Usando a especificação](#usando-a-especificação-swagger-postman-insomnia)

## Fundamentos

### URL base

| Como você executa | URL base |
|---|---|
| Docker Compose, pelo container web (nginx) | `http://localhost:8080/api` |
| Docker Compose, API direta | `http://localhost:3000` |
| Desenvolvimento local (`npm run dev`) | `http://localhost:3000` (ou `http://localhost:5173/api` pelo proxy do Vite) |

Todos os exemplos abaixo usam `http://localhost:3000`. Pelo nginx, coloque `/api` na frente de cada caminho.

### Formato

- Requisições com corpo usam `Content-Type: application/json` (exceto o envio de imagem, que é `multipart/form-data`). O limite do corpo JSON é de **100 kB**.
- As respostas são JSON. Datas são strings ISO 8601 em UTC. Preços são números em reais (R$).
- Códigos de sucesso: `200` (leitura, atualização), `201` (criação, registro), `204` (exclusão, sem corpo).

### Autenticação

Toda rota, exceto `GET /health`, `POST /auth/register`, `POST /auth/login` e `GET /uploads/...`, exige um JWT:

```
Authorization: Bearer <token>
```

- O token é devolvido pelo **registro** e pelo **login**. É um JWT HS256 válido por **1 dia** (`JWT_EXPIRES_IN`), com `sub` (id do usuário), `companyId` e `role`.
- Token ausente, malformado, expirado ou adulterado retorna `401`.
- Não existe endpoint de refresh: entre novamente quando expirar.

### Perfis e permissões

| Perfil | Pode |
|---|---|
| `admin` | Tudo o que o `user` pode, mais criar, atualizar e excluir produtos e gerenciar as imagens. Vê o código de convite da empresa em `GET /auth/me` |
| `user` | Ler produtos e categorias e usar o chat |

Um `user` que chama uma rota só de admin recebe `403 Apenas administradores podem fazer isso`. As permissões são verificadas no servidor.

### Multi-tenant

Cada usuário pertence a exatamente uma empresa. **A empresa sempre vem do token**, nunca da requisição: não existe parâmetro `company_id` em lugar nenhum. Os corpos de produto e de chat rejeitam campos desconhecidos (então um `company_id` ali retorna `400`), e as rotas de auth simplesmente os ignoram. Todas as consultas de produto são filtradas pela empresa de quem chama, então:

- uma empresa nunca vê produtos, categorias ou respostas do chat de outra;
- ler, editar ou excluir o produto de outra empresa retorna **`404`** (e não `403`), para não revelar que o id existe.

### Erros

Todo erro tem o mesmo formato:

```json
{ "error": { "message": "Mensagem legível", "details": { "campo": ["motivo"] } } }
```

`details` só aparece em erros de validação (`400`), indexado pelo nome do campo. As mensagens de restrição vêm do validador e podem estar em inglês (por exemplo `Too small: expected string to have >=2 characters`); as mensagens personalizadas estão em português. Para campos extras desconhecidos no corpo, `details` vem como objeto vazio.

| Status | Significado | Exemplos |
|---|---|---|
| `400` | Falha de validação | Corpo ou query inválidos, campo de upload ausente |
| `401` | Não autenticado | `Não autenticado`, `Token inválido ou expirado`, `Credenciais inválidas` |
| `403` | Autenticado, mas sem permissão | `Apenas administradores podem fazer isso` |
| `404` | Não encontrado, ou pertence a outra empresa | `Produto não encontrado`, `Rota não encontrada`, `Código de convite inválido` |
| `409` | Conflito | `E-mail já cadastrado` |
| `413` | Upload grande demais | `Imagem muito grande (máximo 2 MB)` |
| `415` | Tipo de imagem não suportado | `Formato não suportado: use PNG, JPEG ou WebP` |
| `429` | Muitas requisições, ou cota do provedor de IA atingida | Veja [limites de uso](#limites-de-uso) e [Chat](#chat) |
| `502` | O provedor de IA falhou (só no chat em JSON) | `Não foi possível obter a resposta do agente` |
| `503` | IA não configurada | `Agente de IA indisponível: OPENROUTER_API_KEY não configurada` |
| `500` | Erro inesperado do servidor | `Erro interno do servidor` |

### Limites de uso

| Escopo | Limite | Chave |
|---|---|---|
| `POST /auth/register`, `POST /auth/login` | 30 requisições a cada 15 minutos | IP do cliente |
| `POST /chat` | 20 requisições por minuto | usuário autenticado |

Ao exceder, a resposta é `429` com os cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` e `Retry-After` (em segundos), e um corpo em **texto simples**, `Too many requests, please try again later.`, e não o formato JSON de erro acima. Trate o `429` pelo código de status.

### CORS

Navegadores são aceitos a partir de uma única origem (`CORS_ORIGIN`, padrão `http://localhost:5173`). Pelo container web ou pelo proxy do Vite o navegador fala com a mesma origem, então o CORS não se aplica.

## Início rápido

```bash
BASE=http://localhost:3000

# 1. entre com um usuário do seed e guarde o token
TOKEN=$(curl -s $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@technova.example","password":"senha1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 2. liste produtos
curl -s "$BASE/products?limit=3" -H "Authorization: Bearer $TOKEN"

# 3. pergunte ao agente
curl -s $BASE/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"Quais produtos custam até R$ 200?"}'
```

(Os usuários do seed estão no [README](../README.pt-BR.md#usuários-do-seed).)

## Health

### `GET /health`

Público. Verificação de que a API está no ar.

```json
{ "status": "ok" }
```

## Auth

### `POST /auth/register`

Público. Cria um usuário e devolve um token. Envie **exatamente um** entre `companyName` e `inviteCode`:

- `companyName` → cria uma empresa nova e o usuário vira **`admin`** dela.
- `inviteCode` → entra na empresa existente dona do código e o usuário vira **`user`**.

| Campo | Tipo | Regras |
|---|---|---|
| `name` | string | 2 a 120 caracteres |
| `email` | string | e-mail válido (guardado em minúsculas, deve ser único) |
| `password` | string | 8 a 72 caracteres |
| `companyName` | string | 2 a 120 caracteres (empresa nova) |
| `inviteCode` | string | código mostrado ao admin da empresa |

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

Erros: `400` validação (inclusive enviar os dois, ou nenhum, entre `companyName` e `inviteCode`), `404` código de convite desconhecido, `409` e-mail já cadastrado, `429` limite de uso.

### `POST /auth/login`

Público.

```bash
curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@technova.example","password":"senha1234"}'
```

`200 OK`: mesmo corpo do registro (`token` e `user`).

Erros: `400` validação, `401 Credenciais inválidas` (a mesma resposta, e o mesmo tempo de resposta, para e-mail inexistente e senha errada), `429`.

### `GET /auth/me`

Autenticado. Devolve o usuário e a empresa atuais. O `inviteCode` aparece **somente para admins**.

```bash
curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{
  "user": { "id": "6ac9...", "name": "Ana", "email": "ana@example.com", "role": "admin", "companyId": "6ac9..." },
  "company": { "id": "6ac9...", "name": "Minha Loja", "inviteCode": "1d821937eb9e" }
}
```

## Produtos

Todas as rotas de produto exigem autenticação e só alcançam a empresa de quem chama.

### `GET /products`

Admin e user. Lista paginada, do mais novo para o mais antigo.

| Parâmetro de query | Tipo | Padrão | Descrição |
|---|---|---|---|
| `q` | string (1 a 100) | | Busca por texto. Cada palavra (3+ caracteres) deve aparecer no nome, na descrição ou na categoria, em qualquer ordem, sem diferenciar maiúsculas |
| `category` | string (1 a 60) | | Nome exato da categoria, sem diferenciar maiúsculas |
| `minPrice` | número ≥ 0 | | Preço mínimo |
| `maxPrice` | número ≥ 0 | | Preço máximo (`minPrice` não pode ser maior) |
| `page` | inteiro ≥ 1 | `1` | Página |
| `limit` | inteiro de 1 a 100 | `20` | Itens por página |

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

Erros: `400` para query inválida (por exemplo `minPrice` maior que `maxPrice`), `401`.

### `GET /products/categories`

Admin e user. Categorias distintas da empresa.

```json
{ "items": ["Acessórios", "Áudio", "Celulares", "Computadores", "Periféricos", "Wearables"] }
```

### `GET /products/:id`

Admin e user. Devolve um [Produto](#produto). `404` se o id não existe, está malformado ou pertence a outra empresa.

### `POST /products`

**Somente admin.** Cria um produto na empresa de quem chama.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `name` | string | sim | 1 a 120 caracteres |
| `description` | string | sim | 1 a 2000 caracteres |
| `price` | número | sim | 0 a 1.000.000 |
| `category` | string | sim | 1 a 60 caracteres |
| `imageUrl` | string | não | URL `http` ou `https`, até 500 caracteres. Para enviar um arquivo use [`PUT /products/:id/image`](#put-productsidimage) |

Campos desconhecidos (inclusive `company_id`) são rejeitados com `400`.

```bash
curl -s -X POST $BASE/products -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Caneca","description":"Caneca de cerâmica","price":29.9,"category":"Cozinha"}'
```

`201 Created`: o [Produto](#produto). Erros: `400`, `401`, `403`.

### `PUT /products/:id`

**Somente admin.** Atualização parcial: envie só os campos a mudar (mesmas regras da criação, ao menos um campo). Devolve o [Produto](#produto) atualizado.

```bash
curl -s -X PUT $BASE/products/$ID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"price":34.9}'
```

Definir `imageUrl` com uma URL externa apaga um arquivo enviado antes. Erros: `400` (corpo vazio ou campo inválido), `401`, `403`, `404`.

### `DELETE /products/:id`

**Somente admin.** Exclui o produto e a imagem enviada, se houver. `204 No Content`. Erros: `401`, `403`, `404`.

## Imagens de produto

### `PUT /products/:id/image`

**Somente admin.** Envia (ou substitui) a imagem do produto. `multipart/form-data` com um único arquivo no campo **`image`**.

- Tipos aceitos: **PNG, JPEG, WebP**. O tipo é detectado pelos bytes reais do arquivo, e não pelo nome ou pelo `Content-Type`. SVG é recusado.
- Tamanho máximo: **2 MB**. Um arquivo por requisição.
- A imagem enviada anteriormente, se houver, é apagada.

```bash
curl -s -X PUT $BASE/products/$ID/image -H "Authorization: Bearer $TOKEN" -F "image=@./foto.png"
```

`200 OK`: o [Produto](#produto) atualizado, com um `imageUrl` relativo:

```json
{ "id": "6ac9...", "name": "Caneca", "imageUrl": "/uploads/6ac9.../c931e00e-828d-490e-8906-c51d08fa19e1.png", "...": "..." }
```

Erros: `400` (sem o campo `image`, ou mais de um arquivo), `401`, `403`, `404`, `413` (acima de 2 MB), `415` (não é PNG, JPEG nem WebP).

### `DELETE /products/:id/image`

**Somente admin.** Remove a imagem (arquivo enviado ou URL externa). Devolve o [Produto](#produto) com `imageUrl: null`. Erros: `401`, `403`, `404`.

### `GET /uploads/<companyId>/<arquivo>`

**Público** (sem token). Serve uma imagem enviada, com o `Content-Type` correto e cache de 7 dias. As imagens são públicas por design, porque a tag `<img>` não envia o cabeçalho `Authorization`: a proteção vem dos nomes de arquivo UUID, impossíveis de adivinhar, e a listagem de pastas é desativada.

Para exibir uma imagem enviada, coloque a URL base da API na frente do `imageUrl` relativo: `http://localhost:8080/api` + `/uploads/6ac9.../c931....png`. Valores externos de `imageUrl` (`http...`) são usados como estão.

## Chat

### `POST /chat`

Admin e user. Envia uma pergunta ao agente de IA, que decide se chama suas ferramentas e responde com dados reais **do catálogo da empresa de quem chama**. O agente tem duas ferramentas, `search_products` e `list_categories`; a empresa é injetada pelo servidor a partir do token, então o modelo nunca consegue ler dados de outra empresa. Ele responde em português do Brasil, chama ferramentas em até 5 rodadas e recusa assuntos que não sejam os produtos da empresa.

Corpo da requisição:

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `message` | string | sim | 1 a 2000 caracteres |
| `history` | array | não | Até 20 turnos anteriores: `{ "role": "user" \| "assistant", "content": "..." }`, conteúdo de 1 a 4000 caracteres. O servidor não guarda estado da conversa, então envie o histórico que quer que o agente lembre |

Campos desconhecidos são rejeitados com `400`. O formato da resposta depende do cabeçalho `Accept`.

#### Resposta em JSON (padrão)

```bash
curl -s -X POST $BASE/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"Tem notebook?","history":[]}'
```

`200 OK`, depois que o agente termina:

```json
{
  "reply": "Sim, temos notebooks!\n\n1. **Notebook Essencial 15** - R$ 2.999,00 ...",
  "toolCalls": ["search_products"]
}
```

Erros: `400`, `401`, `429` (limite de uso, ou a cota do provedor de IA: `O provedor de IA atingiu o limite de uso. Tente novamente em alguns minutos.`), `502` (falha do provedor), `503` (sem `OPENROUTER_API_KEY`).

#### Resposta em streaming (SSE)

Envie `Accept: text/event-stream` para receber a resposta conforme ela é gerada. O status HTTP é `200` assim que o stream abre, então falhas depois disso chegam como um evento `error`.

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

| Evento | Dados | Significado |
|---|---|---|
| `tool` | `{ "name": "search_products" }` | O agente está chamando uma ferramenta (útil para um indicador "buscando...") |
| `text` | `{ "text": "..." }` | Um trecho da resposta. Concatene-os na ordem |
| `done` | `{}` | A resposta está completa |
| `error` | `{ "message": "..." }` | O agente falhou (por exemplo, a cota do provedor foi atingida). O stream termina |

Fechar a conexão (ou abortar o `fetch`) cancela a chamada ao modelo.

Exemplo no navegador. O `EventSource` não envia corpo POST nem o cabeçalho `Authorization`, então leia o stream com `fetch`:

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
  buffer = events.pop(); // guarda o final incompleto
  for (const raw of events) {
    const event = /^event: (.*)$/m.exec(raw)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(raw)?.[1] ?? '{}');
    if (event === 'text') render(data.text);
    if (event === 'error') showError(data.message);
  }
}
```

Se você colocar um proxy na frente da API, desative o buffer de respostas (nginx: `proxy_buffering off`), ou os tokens chegam todos de uma vez.

## Modelos de dados

### Produto

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Id do produto |
| `name` | string | Nome |
| `description` | string | Descrição |
| `price` | número | Preço em reais |
| `category` | string | Categoria |
| `imageUrl` | string \| null | URL externa `http(s)`, ou caminho relativo `/uploads/...` para imagem enviada, ou `null` |
| `createdAt`, `updatedAt` | string | Datas ISO 8601 |

O id da empresa nunca é exposto.

### Usuário

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Id do usuário |
| `name`, `email` | string | |
| `role` | `"admin"` \| `"user"` | |
| `companyId` | string | Empresa a que o usuário pertence |

### Empresa (de `GET /auth/me`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id`, `name` | string | |
| `inviteCode` | string | Somente para admins |

## Usando a especificação (Swagger, Postman, Insomnia)

O [`openapi.yaml`](openapi.yaml) descreve todas as rotas, schemas e erros.

- **Swagger UI / Editor:** abra o [editor.swagger.io](https://editor.swagger.io), *File → Import file*, e escolha `docs/openapi.yaml`. Use *Authorize* com um token de `POST /auth/login` para testar as rotas protegidas.
- **Postman / Insomnia:** importe `docs/openapi.yaml` como coleção OpenAPI 3 e defina um token `Bearer` na coleção.
- **Swagger UI local com Docker:**

```bash
docker run --rm -p 8081:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "$PWD/docs:/spec" swaggerapi/swagger-ui
# depois abra http://localhost:8081
```
