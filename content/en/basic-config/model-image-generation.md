# Image Generation Setup

Operit image generation is configured in Package Management. Enable a draw package and fill its required credentials, then you can ask AI to generate images in chat.

## Entry

1. Open Settings
2. Open Package Management
3. Switch to Packages

## Enable Draw Packages

Find the Draw group and turn on the package switch.

- OpenAI Draw
- Qwen Draw
- xAI Draw
- Zhipu Draw
- Nanobanana Draw
- Pollinations Draw

## Available Options

### OpenAI Draw

- Required OPENAI_API_KEY
- Optional OPENAI_API_BASE_URL
- Optional OPENAI_IMAGE_MODEL

### Qwen Draw

- Required DASHSCOPE_API_KEY
- Optional DASHSCOPE_API_BASE_URL
- Optional QWEN_IMAGE_MODEL
- Resolution setting
- Image count setting
- Negative prompt setting
- Watermark switch

### xAI Draw

- Required XAI_API_KEY
- Optional model name
- Size setting

### Zhipu Draw

- Required ZHIPU_API_KEY
- Optional ZHIPU_IMAGE_MODEL
- Size setting

### Nanobanana Draw

- Required NANOBANANA_API_KEY
- BEEIMG_API_KEY is needed when using local reference images
- Text to image
- Image to image
- Aspect ratio and quality tiers

### Pollinations Draw

- No key required
- Fast image output

## Setup Steps

1. Turn on your target draw package in the Draw group
2. Tap the settings icon at the bottom right
3. Find the target package in the environment variable dialog
4. Fill required items first
5. Fill optional items as needed
6. Save
7. Return to chat and request image generation

## Recommended Workflow

- Start with one primary draw package
- Add a second package only after successful generation
- If generation fails, recheck required fields in the environment variable dialog
