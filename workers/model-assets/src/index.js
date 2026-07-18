const VERSION_PREFIX = "/sherpa-onnx/v1.13.2/";

const MODEL_ASSET_KEYS = new Set([
  "sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-v1.13.2-vad.tar.bz2",
  "sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-1.13.2-vad-asr-zh_en-paraformer_small.tar.bz2",
  "sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-1.13.2-vits-piper-en_US-libritts_r-medium.tar.bz2",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, ETag",
};

export default {
  fetch: handleRequest,
};

/** Handles one public model asset request. */
async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse("method_not_allowed", 405);
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith(VERSION_PREFIX)) {
    return textResponse("not_found", 404);
  }

  const key = url.pathname.slice(1);
  if (!MODEL_ASSET_KEYS.has(key)) {
    return textResponse("not_found", 404);
  }

  const object = await env.OPERIT_MODEL_ASSETS.get(key);
  if (object === null) {
    return textResponse("not_found", 404);
  }

  const headers = modelAssetHeaders(object);
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

/** Builds response headers for one R2 model object. */
function modelAssetHeaders(object) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "application/x-bzip2");
  headers.set("Content-Length", String(object.size));
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return headers;
}

/** Builds one plain text response with shared CORS headers. */
function textResponse(body, status) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(body, { status, headers });
}
