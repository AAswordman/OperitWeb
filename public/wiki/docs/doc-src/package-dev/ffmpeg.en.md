# API Documentation: `ffmpeg.d.ts`

`ffmpeg.d.ts` provides the `Tools.FFmpeg` namespace for in-package scripts, along with several codec parameter types.

## Purpose

Suitable for the following tasks:

- Executing raw FFmpeg commands.
- Querying information about the current FFmpeg environment.
- Completing common video transcoding with simplified parameters.

## Type Aliases

### `FFmpegVideoCodec`

Video codec enum values include:

- `h264`
- `hevc`
- `vp8`
- `vp9`
- `av1`
- `libx265`
- `libvpx`
- `libaom`
- `mpeg4`
- `mjpeg`
- `prores`

### `FFmpegAudioCodec`

Audio codec enum values include:

- `aac`
- `mp3`
- `opus`
- `vorbis`
- `flac`
- `pcm`
- `wav`
- `ac3`
- `eac3`

### `FFmpegResolution`

Supported:

- Preset values: `1280x720`, `1920x1080`, `3840x2160`, `7680x4320`
- Custom values: `${number}x${number}`

### `FFmpegBitrate`

Supported:

- Preset values: `500k`, `1000k`, `2000k`, `4000k`, `8000k`
- Custom values: `${number}k`, `${number}M`

## Runtime API

### `Tools.FFmpeg.execute(command)`

```ts
execute(command: string): Promise<FFmpegResultData>
```

Notes:

- `command` takes only the FFmpeg arguments themselves.
- Do not include the `ffmpeg` prefix.

Example:

```ts
await Tools.FFmpeg.execute('-i input.mp4 -vf scale=1280:720 output.mp4');
```

### `Tools.FFmpeg.info()`

```ts
info(): Promise<FFmpegResultData>
```

Returns information about the current FFmpeg executable environment.

### `Tools.FFmpeg.convert(inputPath, outputPath, options?)`

```ts
convert(
  inputPath: string,
  outputPath: string,
  options?: {
    video_codec?: FFmpegVideoCodec;
    audio_codec?: FFmpegAudioCodec;
    resolution?: FFmpegResolution;
    bitrate?: FFmpegBitrate;
  }
): Promise<FFmpegResultData>
```

Suitable for the most common "input file → output file" transcoding scenario.

## Examples

### Simple Transcoding

```ts
const result = await Tools.FFmpeg.convert(
  '/sdcard/input.mp4',
  '/sdcard/output.mp4',
  {
    video_codec: 'h264',
    audio_codec: 'aac',
    resolution: '1920x1080',
    bitrate: '4000k'
  }
);
complete(result);
```

### Querying the Environment

```ts
const info = await Tools.FFmpeg.info();
console.log(info.toString());
```

## Return Value

All three APIs return `FFmpegResultData`. This type is defined in `results.d.ts` and contains the execution result and human-readable output.

## Related Files

- `examples/types/ffmpeg.d.ts`
- `examples/types/results.d.ts`
- `examples/types/index.d.ts`
