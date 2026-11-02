# 04 Streamable HTTP Timeout

After a tool call receives a `202 Accepted`, `StreamableHttpClientTransport` does not re-establish a waiting request for that call. The GET/SSE session established by the initialization notification is responsible for receiving subsequent JSON-RPC responses.

The original `HttpClient(OkHttp)` did not install Ktor's `HttpTimeout`. The SSE session therefore used OkHttp's default read timeout, and was closed when no packets arrived while the server was processing asynchronously, so the caller received `Socket timeout has expired`. The remote runtime now uniformly uses a 15-second connection timeout, and a 60-second HTTP request and SSE idle window. The configuration model does not add a timeout field.

[DONE]
