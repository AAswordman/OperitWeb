# API Documentation: `cryptojs.d.ts`

`cryptojs.d.ts` describes the available subset of the global `CryptoJS` object. It is not the complete upstream CryptoJS, but rather the portion of capability exposed inside the app through a native bridge.

## Purpose

The current type definition mainly covers two uses:

- Computing `MD5`.
- Decrypting with `AES.decrypt()`.

## Global Object

```ts
CryptoJS
```

It can be used directly, with no `import` needed.

## Available Types and Members

### `CryptoJS.WordArray`

The result object after bridging, whose core capability is:

```ts
toString(encoding?: any): string
```

Common usage:

```ts
const hex = CryptoJS.MD5("hello").toString();
```

### `CryptoJS.MD5(message)`

```ts
MD5(message: string): WordArray
```

It computes MD5 over a string and returns a `WordArray`.

### `CryptoJS.AES.decrypt(ciphertext, key, cfg?)`

```ts
CryptoJS.AES.decrypt(ciphertext: string, key: any, cfg?: any): WordArray
```

Notes:

- Here, `key` and `cfg` are interpreted by the bridge implementation.
- The type definition does not provide `AES.encrypt()`, so the documentation should not assume it is available.

### Encoding and Mode Related Objects

The available members are:

- `CryptoJS.enc.Hex.parse(hexStr)`
- `CryptoJS.enc.Utf8`
- `CryptoJS.pad.Pkcs7`
- `CryptoJS.mode.ECB`

## Examples

### Computing MD5

```ts
const digest = CryptoJS.MD5("assistance").toString();
complete({ digest });
```

### Converting a Hex String to a `WordArray`

```ts
const wordArray = CryptoJS.enc.Hex.parse("48656c6c6f");
const text = wordArray.toString(CryptoJS.enc.Utf8);
```

### AES Decryption

```ts
const result = CryptoJS.AES.decrypt(ciphertext, key, {
  mode: CryptoJS.mode.ECB,
  padding: CryptoJS.pad.Pkcs7
});
const plaintext = result.toString(CryptoJS.enc.Utf8);
```

## Notes

- This definition file describes "the API actually exposed by the current bridge layer", not the full CryptoJS.
- If an upstream CryptoJS method does not appear in `examples/types/cryptojs.d.ts`, do not assume it exists in scripts.
- The `toString()` encoding parameter is more like a hint value in the bridge layer; the actual processing logic is decided by the native side.

## Related Files

- `examples/types/cryptojs.d.ts`
- `examples/types/index.d.ts`
