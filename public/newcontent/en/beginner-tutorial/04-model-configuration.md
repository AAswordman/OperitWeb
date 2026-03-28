# 04. Model Configuration and Context

From this point on, things will get a bit more complicated.
Some people may say: this is too troublesome, why design so many options? Answer: this is purely for higher freedom, and of course there are also some historical burdens. There will be improvements in the next major version, but for this version... it is what it is for now.

To make configuration more convenient, in version 1.10.0 and above, you can directly ask AI in the chat interface and let AI help you finish configuration.
But it is still highly recommended to read through the content below; it won’t take much of your time, and I believe it helps you understand these features.

First, in the settings page, you can find model and parameter configuration.

![](/manuals/assets/model/new_model_config2.jpg)

Next, we enter the model configuration page.

## API Settings

### Cloud Models

#### Providers and Endpoints

To better choose providers, here is some basic knowledge: **model APIs are not fully unified**. The following paragraphs are supplemental material, and you can read them selectively.

> Current APIs are mainly in three categories: OpenAI endpoint, Anthropic endpoint, and Gemini endpoint. Under OpenAI endpoint, there are also two formats: completions and responses. **The most commonly used format in the market right now is OpenAI completions.**
> **Different endpoints cannot be mixed.** For example, you cannot take an OpenAI-style API and directly throw it into the Gemini generic provider option without any adjustment, or it will error.

> Each endpoint has its own signature. The most obvious one: different routes, simply speaking, the URL ending looks different. Taking OpenAI as an example, its endpoint is `https://api.openai.com/v1/chat/completions`, with a very obvious feature ending in `v1/chat/completions`. While OpenAI responses format is `https://api.openai.com/v1/responses`, ending in `v1/chat/completions`.

> Another example: DeepSeek API request URL is `https://api.deepseek.com/v1/chat/completions`.

Precisely because APIs are not fully unified, we need to choose the **correct API provider**. **Whichever platform gives you the key, use that platform’s provider type.** There are two cases here.

![](/manuals/assets/model/model-config-providers.png)

##### Case 1: The provider can be found in the list

After selecting a provider, the **API endpoint will be auto-filled**.
If you are using coding plans like GLM, you need to **click the endpoint area once more** to choose the corresponding coding endpoint.

![](/manuals/assets/model/new_model_config1.jpg)

##### Case 2: The provider cannot be found in the list

If you can’t find it in the list, then choose a generic category: OpenAI Generic / OpenAI Response Generic / Anthropic Generic / Gemini Generic. **Generally, the first two are used more often.**
Next you need to fill it manually. What exactly to fill should be based on the docs of the website where you got the key.

#### Key

The API key here is the API key mentioned earlier. Just fill it in.

#### Model Name

Click the button on the right side of the model input box to auto-fetch the model list, then select one or multiple models.

If fetching fails, it’s okay, you can try filling it manually.

At this point, the three basic elements of cloud models are complete.

### Local Models

Operit supports two types of local models (the Ollama provider belongs to the cloud models above): MNN and llama.cpp. Local model runtime basically... can’t really run, but considering there is such demand, we still added it.

When running local models, in the chat interface menu please choose: Disable Tools. If not disabled, you will experience very long inference time and possible freezes/crashes, because tool prompts are way too long and phones can’t handle it.

If you really want to try tools, it is recommended to turn off almost all tools and keep only one or two. We will explain specific operations in detail later in the tools section, so we won’t expand here.

Just set API provider to llama or mnn. For mnn we provide download paths, for llama you need to prepare your own model.

Many people ask me if NPU can be supported. No problem, but only after upstream officially supports it so I can port it over a(

Operit stores mnn files in `/storage/emulated/0/Download/Operit/models/mnn`, and stores llama files in `/storage/emulated/0/Download/Operit/models/llama`. You can manage them yourself with a file manager.

![](/manuals/assets/model/mnn.png)


### Other Switches


All models have: model supports image recognition, model supports audio parsing, model supports video parsing, toolcall, strict toolcall.

In general, **it is recommended to enable toolcall and strict toolcall**. Although the in-app note says they can be off if no errors occur, many people encounter this issue: AI keeps activating tool packages but does not call them, especially with GLM5+ and GPT. In those cases, strict toolcall must be enabled. To avoid trouble, if toolcall is supported, just enable strict toolcall for all.

For model supports image/audio/video, set according to actual capability. It literally means what it says. The easiest method is to enable all three, then click the test button at the top once. If an error appears, turn that item off, meaning this model does not support that capability.

> Some people may ask: if these are off, does it affect anything? Yes and no. For example, DeepSeek does not support image understanding. If you turn off “model supports image recognition” here, the model can still read image text through the built-in OCR in the app. But if you lie to the app and enable model image recognition for DeepSeek, it will error at runtime.

> Also, this gives the app a delegation standard. Simply put, for models that do not support multimodal recognition, it will find another configuration you set that does support multimodal, let that configuration help recognize content, and then pass it back. In this way, multimodal tasks can also be completed. This will be explained in the next chapter.

![](/manuals/assets/model/new_model_config3.jpg)


## Context Settings and Summary Settings

What is context? Context means feeding chat history and your messages to the AI. The part fed in is context.

Context settings also need to be filled honestly based on model capability, so the app can maximize model performance. The first context-length field means the context length you want in daily use; the second field means the maximum context your API can handle, like GLM 200k, DeepSeek 128k.

Context settings are for summary behavior. The app will automatically evaluate current context length and compare with the values filled here: when summary conditions below are met, it will automatically trigger one compression to keep context length within the given window.

Fill one for daily usage and one for maximum usage. The purpose is dynamic usage decision. The switch for this is **max mode** in Chat Interface -> Model Selection. When max is off, the app controls context by the first value; when max is on, it uses the maximum value.

Summary settings are straightforward: one summarizes by message count, one summarizes by threshold. Both are auto-summary. If you want manual summary, refer to the previous interface-overview article: long-press a message, there is an “Insert Summary” option. It can be inserted anywhere in the chat.

And one special note: the app will use the selected chat model configuration’s context and summary values as the current active values.

If summary gets stuck, refer to the next section to find reasons. Because summary, like image recognition, is also delegated to another model configuration.

Context, summary, and max mode will not have a standalone detailed article later; basically it is what is said above.

![](/manuals/assets/model/new_model_config4.jpg)

## Model Parameter Settings

There is nothing particularly special to explain for model parameters.
Pay special attention to the **max_tokens** parameter in model output settings. This parameter is not context length, but the maximum output length of the model. For DeepSeek, you can enable it and set 8192. For other models, you can disable it, or enable and adjust manually.

![](/manuals/assets/model/new_model_config5.jpg)

## Custom Request Headers

This part is separated in 1.10.0 instead of following each model configuration.
In most cases, it is not needed. For some scenarios requiring special headers, this item can be modified.

![](/manuals/assets/model/new_model_config6.jpg)

## Advanced Settings

This section mainly controls model request rate limits and maintains a key pool.

The key pool will test all keys inside it, and during requests it will override the previous key and rotate through them one by one.
