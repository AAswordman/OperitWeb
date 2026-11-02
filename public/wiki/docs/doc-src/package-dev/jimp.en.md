# API documentation: `jimp.d.ts`

`jimp.d.ts` describes the bridging capabilities of the global `Jimp` object currently available in the runtime environment. It is a lightweight subset focused on basic image reading/writing and simple image processing.

## Purpose

The current definitions support:

- Reading an image from Base64.
- Creating a blank image.
- Cropping and compositing.
- Exporting as Base64.
- Manually releasing bridged objects.

## Global object

```ts
Jimp
```

It can be used directly, without `import`.

## Core types

### `Jimp.JimpWrapper`

The bridged image object, with the following methods:

- `crop(x, y, w, h)`: crops and returns a new `JimpWrapper`.
- `composite(src, x, y)`: overlays another image onto the current image.
- `getWidth()`: gets the width.
- `getHeight()`: gets the height.
- `getBase64(mime)`: exports as a Base64 string.
- `release()`: releases the underlying resources.

### `Jimp.read(base64)`

```ts
read(base64: string): Promise<JimpWrapper>
```

Creates an image object from Base64 content.

### `Jimp.create(w, h)`

```ts
create(w: number, h: number): Promise<JimpWrapper>
```

Creates a blank image.

### MIME constants

- `Jimp.MIME_JPEG`
- `Jimp.MIME_PNG`

## Examples

### Reading an image and cropping it

```ts
const image = await Jimp.read(base64Image);
const cropped = await image.crop(0, 0, 200, 200);
const output = await cropped.getBase64(Jimp.MIME_PNG);
await image.release();
await cropped.release();
```

### Creating a canvas and overlaying an image

```ts
const canvas = await Jimp.create(800, 600);
const icon = await Jimp.read(iconBase64);
await canvas.composite(icon, 24, 24);
const merged = await canvas.getBase64(Jimp.MIME_PNG);
await icon.release();
await canvas.release();
```

## Usage notes

- A `JimpWrapper` wraps a bridged object, so call `release()` after use whenever possible.
- The input is Base64, not a file path; if you have a file on hand, you can first use `Tools.Files.readBinary()` to obtain its content.
- This documentation only covers the methods explicitly declared in `examples/types/jimp.d.ts`; do not assume that all APIs of the full version of Jimp exist.

## Related files

- `examples/types/jimp.d.ts`
- `examples/types/files.d.ts`
- `examples/types/index.d.ts`
