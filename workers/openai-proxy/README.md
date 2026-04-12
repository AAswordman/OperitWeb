# openai-proxy

Cloudflare Worker for OpenAI API and ChatGPT backend passthrough.

## What it does

- Proxies `/v1/*` directly to OpenAI
- Also supports `/openai/v1/*` when you want to mount it behind a path prefix
- Proxies `/backend-api/*` to `https://chatgpt.com/backend-api/*`
- Also supports `/chatgpt/backend-api/*` when you want a ChatGPT path prefix
- Passes through the client's `Authorization` header by default
- Streams upstream responses back as-is
- Forwards client IP headers upstream as best effort:
  - `CF-Connecting-IP`
  - `X-Forwarded-For`
  - `X-Real-IP`
  - `True-Client-IP`

## Required setup

By default, you do not need to store an OpenAI key inside the worker.
Let the client send:

```http
Authorization: Bearer sk-...
```

Only set a worker-side OpenAI key if you want it as a fallback when the client does not send `Authorization`:

```bash
wrangler secret put OPENAI_API_KEY
```

Optional secrets and vars:

- `OPENAI_PROXY_SECRET`
  - If set, every request must include `X-Proxy-Secret`
- `OPENAI_BASE_URL`
  - Defaults to `https://api.openai.com`
- `CHATGPT_BACKEND_BASE_URL`
  - Defaults to `https://chatgpt.com`
- `CHATGPT_BACKEND_AUTHORIZATION`
  - Optional fallback `Authorization` for ChatGPT backend requests
- `CHATGPT_BACKEND_COOKIE`
  - Optional fallback `Cookie` for ChatGPT backend requests
- `OPENAI_PROXY_ALLOWED_ORIGINS`
  - Defaults to `*`
- `OPENAI_ORGANIZATION`
  - Optional upstream header fallback
- `OPENAI_PROJECT`
  - Optional upstream header fallback

For `backend-api/codex/response` and `backend-api/codex/responses`, the proxy keeps the incoming `Cookie` and `Authorization` headers instead of stripping them like the OpenAI API path.
If you need browser credential mode, avoid `*` and set `OPENAI_PROXY_ALLOWED_ORIGINS` to explicit origins.

## Local dev

```bash
cd workers/openai-proxy
npx wrangler dev
```

## Deploy

From repo root:

```bat
workers\worker_submit.bat openai-proxy
```

Or inside the worker directory:

```bash
npx wrangler deploy
```

## Example

This worker is configured for:

- `https://openai.aaswordsman.org/*`

Use either:

- `https://openai.aaswordsman.org/v1/responses`
- `https://openai.aaswordsman.org/openai/v1/responses`
- `https://openai.aaswordsman.org/backend-api/codex/response`
- `https://openai.aaswordsman.org/backend-api/codex/responses`
- `https://openai.aaswordsman.org/chatgpt/backend-api/codex/response`
- `https://openai.aaswordsman.org/chatgpt/backend-api/codex/responses`
