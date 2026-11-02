# API Documentation: `network.d.ts`

`network.d.ts` describes the `Tools.Net` namespace. It covers not only regular HTTP requests, but also "visit a web page and extract its content" and a full set of persistent web session APIs.

## Purpose

The current definitions cover three categories of capability:

- Ordinary HTTP requests.
- Web page visits and content extraction.
- Persistent web session control (navigation, executing JS, clicks, form filling, screenshot snapshots, file uploads, etc.).

## Runtime Entry Point

```ts
Tools.Net
```

## Main APIs

### HTTP requests

#### `httpGet(url, ignore_ssl?)`

```ts
httpGet(url: string, ignore_ssl?: boolean): Promise<HttpResponseData>
```

#### `httpPost(url, body, ignore_ssl?)`

```ts
httpPost(url: string, body: string | object, ignore_ssl?: boolean): Promise<HttpResponseData>
```

#### `http(options)`

```ts
http({
  url,
  method?,
  headers?,
  body?,
  connect_timeout?,
  read_timeout?,
  follow_redirects?,
  ignore_ssl?,
  responseType?,
  validateStatus?
}): Promise<HttpResponseData>
```

This is the more general HTTP request entry point.

#### `uploadFile(options)`

Uploads files via `multipart/form-data`, supporting:

- `url`
- `method?: 'POST' | 'PUT'`
- `headers?`
- `form_data?`
- `ignore_ssl?`
- `files[]`

Where each item in `files[]` contains:

- `field_name`
- `file_path`
- `content_type?`
- `file_name?`

### Web page visits

#### `visit(urlOrParams)`

```ts
visit(
  string |
  {
    url?,
    visit_key?,
    link_number?,
    include_image_links?,
    headers?,
    user_agent_preset?,
    user_agent?
  }
): Promise<VisitWebResultData>
```

Notes:

- Supports directly visiting a URL.
- Also supports continuing to visit a link based on an existing `visit_key`.
- This is a tool for "visiting a web page and extracting readable content", not a replacement for raw HTTP GET/POST.
- If what you actually need is an interface response body, AJAX return values, or exact headers/status/body, use `httpGet()`, `httpPost()`, or `http()`; misusing `visit()` may produce empty returns or incomplete content.
- When the body is too long, `VisitWebResultData.content` may retain only a preview, and the full content is written to the local file pointed to by `contentSavedTo`.
- When you encounter `contentSavedTo`, prefer using `read_file_part`, `read_file_full`, or `grep_code` on that path.

### Persistent browser sessions

#### `startBrowser(options?)`

Starts a persistent browser session (floating WebView) and returns `StringResultData`, where `value` is a JSON string.

#### `stopBrowser(sessionIdOrOptions?)`

Closes a specified session or all sessions.

#### `browserNavigate(sessionId, url, headers?)`

Navigates a session to the target URL.

#### `browserEval(sessionId, script, timeoutMs?)`

Executes JavaScript within a session.

#### `browserClick(options)`

```ts
browserClick({
  session_id?,
  ref,
  element?,
  button?,
  modifiers?,
  doubleClick?
}): Promise<StringResultData>
```

Here `ref` usually comes from a node reference in a snapshot result.

#### `browserFill(sessionId, selector, value)`

Fills content by CSS selector.

#### `browserWaitFor(sessionId, selector?, timeoutMs?)`

Waits for the page to be ready or for a selector to appear.

#### `browserSnapshot(sessionId, options?)`

Gets a text snapshot of the current page, with control over whether links and images are included.

#### `browserTakeScreenshot(options)`

```ts
browserTakeScreenshot({
  type?: string,
  element?: string,
  ref?: string,
  fullPage?: boolean
}): Promise<string>
```

Captures a screenshot of the current page or a snapshot element. `type` defaults to `png` when omitted. `ref` and `element` must be provided as a pair, and `fullPage` controls whether the full page is captured.

#### `browserFileUpload(sessionId, paths?)`

Handles the page's file picker; omitting `paths` means cancel.

### Cookie management

Used via `Tools.Net.cookies`:

- `get(domain)`
- `set(domain, cookies)`
- `clear(domain?)`

All return values are `HttpResponseData`.

## Examples

### The simplest GET request

```ts
const response = await Tools.Net.httpGet('https://example.com');
console.log(response.statusCode);
console.log(response.content);
```

### General HTTP request

```ts
const response = await Tools.Net.http({
  url: 'https://example.com/api',
  method: 'POST',
  headers: {
    Authorization: 'Bearer token'
  },
  body: {
    hello: 'world'
  },
  follow_redirects: true
});
```

### Scraping web page content

```ts
const page = await Tools.Net.visit({
  url: 'https://example.com',
  include_image_links: true,
  user_agent_preset: 'desktop'
});
console.log(page.title);
console.log(page.content);

// If you need raw API responses instead of webpage extraction,
// use httpGet/httpPost/http rather than visit().
```

### Clicking within a persistent session

```ts
const started = await Tools.Net.startBrowser({ url: 'https://example.com' });
const session = JSON.parse(started.value);

await Tools.Net.browserClick({
  session_id: session.sessionId,
  ref: 'node_12',
  element: '登录按钮'
});
```

## Return Values

- Regular network requests use `HttpResponseData`.
- `visit()` uses `VisitWebResultData`.
- Most browser session control APIs return `StringResultData`, with the actual payload usually placed in the `value` field, and often as a JSON string.

## Related Files

- `examples/types/network.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
