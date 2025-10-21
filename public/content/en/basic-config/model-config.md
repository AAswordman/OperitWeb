### How to Configure Your Own API

*Following these steps, you can easily configure DeepSeek's API for use in Operit AI.*

If you want to configure your own API (rather than using the default interface provided in the app), you can follow this process:

We have built-in DeepSeek as the default model because we believe it to be the most cost-effective API for domestic use in China, not only with strong performance but also with various discounts and disk caching to reduce usage costs.

API access and Token settings are not related to the software developer. We do not provide any services in this regard, nor do we charge any fees.

For first-time use of your own token, we recommend only recharging 1 yuan, which is completely sufficient.

---

#### Steps to Configure DeepSeek API

1.  In the app, if you haven't configured an API, you will see the following interface. Click "Get Token".

    ![](/manuals/assets/deepseek_API_step/2.png)

2.  The app will pop up a prompt guiding you to the DeepSeek official website. Click "Go to Get".

    ![](/manuals/assets/deepseek_API_step/4.png)

3.  On the DeepSeek website, you need to register and log in, then recharge. We recommend recharging 1 yuan for first-time use.

    ![](/manuals/assets/deepseek_API_step/3.png)

4.  After recharging, you can check your balance on the "Usage" page.

    ![](/manuals/assets/deepseek_API_step/5.png)

5.  Next, please go to the "API Keys" page and click "Create New API key".

    ![](/manuals/assets/deepseek_API_step/9.png)

6.  After creating the key, copy the generated API Key.

7.  Return to the Operit AI app and paste the copied API Key into the "API Key" input box.

    ![](/manuals/assets/deepseek_API_step/2.png)

8.  Alternatively, you can also go to "Settings" -> "Model & Parameter Configuration", create a new model configuration, and paste the API Key there.

    ![](/manuals/assets/deepseek_API_step/1.png)

After configuration is complete, you can use your own DeepSeek API for AI conversations.

---

You can switch and configure the AI model you want to use by following these steps:

> 🎨 Note: The existence of "default settings" is to make it more convenient for users to add different models from the same provider and key. (Clicking "New" will create a configuration template with the same information as the default settings)

#### Custom Model & Parameter Configuration

In addition to following the wizard to configure specific APIs (such as DeepSeek), Operit AI also provides powerful custom model configuration capabilities. You can connect to any compatible API provider here and finely adjust various parameters of the model.

**How to Access:**

*   Click **"+ New"** in the initial API configuration interface
*   Or go to **"Settings" -> "Model & Parameter Configuration"**

![Model & Parameter Configuration Main Interface](/manuals/assets/model/model-config-main.jpg)

**1. API Settings**

You can manually fill in the API information of the required model to create a new model configuration:

*   **API Endpoint:** The API request address of the model.
    *   *Tip: If you enter a base URL, the system will automatically complete the common path. To disable this feature, please add a `#` at the end of the URL.*
*   **API Key:** The API Key you obtained from the provider platform.
*   **Model Name:** Specify the specific model to use, such as `gpt-4-turbo` or `gemini-1.5-pro-latest`. You can click the list icon on the right to try pulling the model list from the provider.
*   **API Provider:** Click to select the corresponding API service provider. This helps the software better adapt to different API specifications.

![Select API Provider](/manuals/assets/model/model-config-providers.png)

We have built-in presets for multiple mainstream API providers, including:
*   OpenAI (GPT series)
*   Anthropic (Claude series)
*   Google (Gemini series)
*   Baidu (ERNIE Bot series)
*   Alibaba Cloud (Tongyi Qianwen series)
*   MNN (Local models) - You can select the MNN provider to download and run local models on your device

![MNN Configuration](/manuals/assets/model/mnn.png)

**2. Model Parameter Settings**

In the lower half of the configuration page, you can fine-tune the model's creativity parameters and repetition control parameters to control the output style of AI.

![Model Parameter Settings](/manuals/assets/model/model-config-params.png)

*   **Creativity Parameters:**
    *   **Temperature:** Controls the randomness of output. Lower values make output more deterministic and consistent, while higher values are more random and creative.
    *   **Top-P Sampling:** An alternative to temperature sampling, the model only selects from the smallest vocabulary set whose probability sum reaches the threshold P.
    *   **Top-K Sampling:** The model only selects from the K words with the highest probability.

*   **Repetition Control Parameters:**
    *   **Presence Penalty:** Enhances the model's tendency to talk about new topics by penalizing words that have already appeared. Higher values encourage the model to introduce new concepts.
    *   **Frequency Penalty:** Reduces the model's likelihood of repeating verbatim by penalizing the frequency of words that have already appeared. Higher values mean heavier penalties.

Through these rich configuration options, you can connect Operit AI to any AI model you prefer and finely adjust its performance according to specific task requirements.

