# API Documentation: `okhttp.d.ts`

`okhttp.d.ts` describes the global `OkHttp` object and a set of more "client-style" HTTP APIs. Compared with `Tools.Net.http()`, it is better suited to building requests with chaining, reusing client configuration, and handling interceptors.

## Global Object

```ts
OkHttp
```

It can be used directly, without `import`.

## Core Object Relationships

- `OkHttp.newClient()`: creates a default client.
- `OkHttp.newBuilder()`: creates a client builder.
- `OkHttpClientBuilder`: sets timeouts, redirects, retries, and interceptors.
- `OkHttpClient`: executes requests.
- `RequestBuilder`: constructs an `HttpRequest` with chaining.
- `OkHttpResponse`: wraps the response result.

## Main Types

### `HttpRequest`

Fields:

- `url`
- `method`
- `headers`
- `body?`
- `bodyType?`: `text | json | form | multipart`
- `formParams?`
- `multipartParams?`

Methods:

- `execute()`: executes the current request directly.

### `OkHttpResponse`

Common fields:

- `raw: HttpResponseData`
- `statusCode`
- `statusMessage`
- `headers`
- `content`
- `contentType`
- `size`

Common methods:

- `json()`
- `text()`
- `bodyAsBase64()`
- `isSuccessful()`

### `OkHttpClientBuilder`

Supports the following chained configuration:

- `connectTimeout(timeout)`
- `readTimeout(timeout)`
- `writeTimeout(timeout)`
- `followRedirects(follow)`
- `retryOnConnectionFailure(retry)`
- `addInterceptor(interceptor)`
- `build()`

### `OkHttpClient`

Supports the following calls:

- `newRequest()`
- `execute(request)`
- `get(url, headers?)`
- `post(url, body, headers?)`
- `put(url, body, headers?)`
- `delete(url, headers?)`
- `OkHttpClient.newBuilder()`

### `RequestBuilder`

Supports the following chained methods:

- `url(url)`
- `method(method)`
- `header(name, value)`
- `headers(headers)`
- `body(body, type?)`
- `jsonBody(data)`
- `formParam(name, value)`
- `multipartParam(name, value, contentType?)`
- `build()`

## Examples

### The Simplest GET

```ts
const client = OkHttp.newClient();
const response = await client.get('https://example.com');
console.log(response.statusCode);
console.log(response.text());
```

### Configuring a Client with a Builder

```ts
const client = OkHttp
  .newBuilder()
  .connectTimeout(10_000)
  .readTimeout(20_000)
  .followRedirects(true)
  .retryOnConnectionFailure(true)
  .build();
```

### Building a JSON POST Request

```ts
const client = OkHttp.newClient();
const request = client
  .newRequest()
  .url('https://example.com/api')
  .header('Authorization', 'Bearer token')
  .jsonBody({ hello: 'world' })
  .build();

const response = await client.execute(request);
const json = response.json();
```

### Adding an Interceptor

```ts
const client = OkHttp
  .newBuilder()
  .addInterceptor((request) => {
    request.headers['X-Trace-Id'] = String(Date.now());
    return request;
  })
  .build();
```

## Differences from `Tools.Net`

- `Tools.Net` leans more toward a tool-call style, suitable for quick requests.
- `OkHttp` leans more toward a client style, suitable for chained configuration and reuse.
- Both ultimately depend on the bridging capabilities of the current environment, but at the type level they are two different wrappers.

## Related Files

- `examples/types/okhttp.d.ts`
- `examples/types/network.d.ts`
- `examples/types/results.d.ts`
