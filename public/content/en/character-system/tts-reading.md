# TTS Voice Reading

TTS (Text-to-Speech) functionality can convert the character's text replies into voice and read them aloud.

## Feature Description

### Single Message Reading
- **Operation**: Long-press any message and select "Read Message" from the popup menu.
- **Use**: Listen to a single important reply.

![Long-press to Read](/manuals/assets/voice/image3.png)

### Auto-Read
- **Operation**: Click the "Auto-Read" switch in the lower right corner of the conversation interface.
- **Use**: After enabling, all new messages will be automatically read aloud, suitable for when it's inconvenient to look at the screen.

![Auto-Read Switch](/manuals/assets/voice/image4.png)

## Advanced Configuration

Go to "Voice Service Settings" -> "Text-to-Speech (TTS) Settings" for advanced configuration.

![TTS Settings](/manuals/assets/voice/image5.png)

### TTS Service
- **System TTS**: Default option, uses the device's built-in voice engine.
- **Custom Service**: Supports configuring third-party TTS services.

### Cleanup Regex
This function is used to remove redundant content (such as Markdown symbols, special characters, etc.) from the text before reading through regular expressions, optimizing the listening experience.
- **Add/Delete Rules**: Manually manage regular expressions.
- **Use Templates**: Quickly apply preset common filtering rules.

