# Image Recognition Feature

Operit AI supports two methods for image recognition: direct image recognition and calling recognition through functional models. You can choose the appropriate method based on the model type you're using.

---

## Method 1: Direct Image Recognition (Vision-Capable Models)

For multimodal models that support visual understanding (such as GPT-4 Vision, Claude 3.5 Sonnet, Gemini Pro Vision, etc.), you can enable direct image recognition in the model configuration.

### Configuration Steps

1. Go to **"Settings" -> "Model & Parameter Configuration"**
2. Select or create a vision-capable model configuration
3. Find the **"Enable Direct Image Processing"** option in the configuration interface
4. **Check this option** to enable direct image processing
5. Save the configuration

![Model Configuration Interface](/manuals/assets/model/f6044fc42c9d65f65751ba8470dcf551.jpg)

### Usage

After configuration, when using this model for conversation:

*   Send images directly to the AI
*   The AI can directly recognize and understand image content
*   No additional tool calls required, faster response speed

---

## Method 2: Image Recognition via Functional Models (Non-Vision Models)

For models that don't support direct image recognition, you can enable image recognition by configuring functional models. The system will automatically call the configured recognition model when needed to process images.

### Configuration Steps

1. Go to **"Settings" -> "Functional Model Configuration"**
2. Find the **"Image Recognition"** functional module
3. Select a vision-capable multimodal model configuration
4. **Ensure this model configuration has "Direct Image Processing" enabled**
5. Save the configuration

![Functional Model Configuration Interface](/manuals/assets/model/967d284fca94c4cdcbe6e73cb84ff801.jpg)

### How It Works

When you use a main model that doesn't support direct image recognition for conversation:

1.  **Send Image**: You send an image in the conversation
2.  **Automatic Call**: The main model calls the image recognition functional model through the `read_file` tool
3.  **Intent Parameter**: Supports passing recognition intent through the `intent` parameter for deep understanding
4.  **OCR Support**: Also supports OCR (Optical Character Recognition) functionality to recognize text in images
5.  **Return Results**: After the recognition model processes the image, it returns results to the main model, which continues the conversation based on the recognition results

### Usage Example

When you send an image and ask: "What's in this image?":

*   The main model (non-vision) calls the `read_file` tool
*   The system automatically sends the image to the configured image recognition functional model
*   The recognition model analyzes the image content and returns a description
*   The main model answers your question based on the recognition results
