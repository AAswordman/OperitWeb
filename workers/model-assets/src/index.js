const V86_RUNTIME_PREFIX = "v86-runtime/i686-buildroot-node20-python312-20260720/";

const PUBLIC_ASSET_CONTENT_TYPES = new Map([
  ["sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-v1.13.2-vad.tar.bz2", "application/x-bzip2"],
  ["sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-1.13.2-vad-asr-zh_en-paraformer_small.tar.bz2", "application/x-bzip2"],
  ["sherpa-onnx/v1.13.2/sherpa-onnx-wasm-simd-1.13.2-vits-piper-en_US-libritts_r-medium.tar.bz2", "application/x-bzip2"],
  [`${V86_RUNTIME_PREFIX}operit-runtime-manifest.json`, "application/json; charset=utf-8"],
  [`${V86_RUNTIME_PREFIX}operit-runtime-bzimage.bin`, "application/octet-stream"],
  [`${V86_RUNTIME_PREFIX}operit-runtime-initrd.cpio.gz`, "application/gzip"],
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers":
    "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag",
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
  const key = url.pathname.slice(1);
  if (!PUBLIC_ASSET_CONTENT_TYPES.has(key)) {
    return textResponse("not_found", 404);
  }

  const metadata = await env.OPERIT_MODEL_ASSETS.head(key);
  if (metadata === null) {
    return textResponse("not_found", 404);
  }

  const range = parseRangeHeader(request.headers.get("Range"), metadata.size);
  if (range === "invalid") {
    return rangeNotSatisfiableResponse(metadata.size);
  }
  const object = await env.OPERIT_MODEL_ASSETS.get(
    key,
    range === null ? undefined : { range },
  );
  if (object === null) {
    return textResponse("not_found", 404);
  }
  const headers = assetHeaders(key, metadata, range);
  if (request.method === "HEAD") {
    return new Response(null, { status: range === null ? 200 : 206, headers });
  }

  return new Response(object.body, { status: range === null ? 200 : 206, headers });
}

/** Parses one single byte range supported by the immutable model asset endpoint. */
function parseRangeHeader(value, totalBytes) {
  if (value === null) {
    return null;
  }
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (match === null) {
    return "invalid";
  }
  const offset = Number(match[1]);
  const requestedEnd = match[2] === "" ? totalBytes - 1 : Number(match[2]);
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(requestedEnd) ||
    offset >= totalBytes ||
    requestedEnd < offset
  ) {
    return "invalid";
  }
  const end = Math.min(requestedEnd, totalBytes - 1);
  return { offset, length: end - offset + 1 };
}

/** Builds response headers for one complete or byte-ranged public R2 object. */
function assetHeaders(key, object, range) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", PUBLIC_ASSET_CONTENT_TYPES.get(key));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(range === null ? object.size : range.length));
  if (range !== null) {
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
    );
  }
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return headers;
}

/** Builds one invalid byte range response for a model asset. */
function rangeNotSatisfiableResponse(totalBytes) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Range", `bytes */${totalBytes}`);
  return new Response(null, { status: 416, headers });
}

/** Builds one plain text response with shared CORS headers. */
function textResponse(body, status) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(body, { status, headers });
}
