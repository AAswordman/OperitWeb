# MNN Local Model Running

Operit AI supports running AI models locally on your device through the MNN (Mobile Neural Network) framework, enabling completely offline AI conversations without relying on cloud APIs.

> ⚠️ **Important Note**: Local models have limited understanding capabilities and performance is far inferior to cloud APIs. It is recommended to disable memory links and enable tool disabling when using local models for better experience.

---

## How to Configure MNN Local Models

### 1. Select MNN Provider

In the "Model & Parameter Configuration" page, create a new model configuration or edit an existing one:

1. Go to **"Settings" -> "Model & Parameter Configuration"**
2. Click **"+ New"** to create a new configuration, or select an existing configuration to edit
3. In **"API Provider"**, select **"MNN (Local Inference)"**

![MNN Model Configuration Interface](/manuals/assets/model/fff4d73e9796dec22f22f0702babf62d.jpg)

### 2. Download MNN Models

After selecting the MNN provider, you will see a **"Download MNN Model"** button. Click this button to enter the model download page.

![MNN Model Download Interface](/manuals/assets/model/82262fe261a5d48199ee575c08c91f21.jpg)

On the model download page:

*   You can search for specific models using the search box
*   Each model card displays:
    *   **Model Name**: Such as `WebSailor-3B-MNN`, `Lingshu-7B-MNN`, `MiniCPM-V-4-MNN`, etc.
    *   **Model Size**: Shows the storage space occupied by the model file (e.g., 4.10 GB, 7.00 GB, 20.00 GB)
    *   **Model Tags**:
        *   **Vision**: Multimodal models that support visual understanding
        *   **Think**: Models that support chain-of-thought reasoning
*   Click the **"Start Download"** button to download the selected model

### 3. Configure Model Parameters

After downloading the model, return to the model configuration page where you need to configure the following parameters:

#### Select Model Configuration

*   **Model Name**: Select the downloaded MNN model from the dropdown list, for example `DeepSeek-R1-1.5B-Qwen-MN`
*   You can click **"+ New"** to create a new model configuration
*   Use the **"Delete"** button to remove unwanted configurations
*   Use **"Test Connection"** to verify if the model is working properly

#### Computation Type

*   **CPU**: Use CPU for inference (default option)
    *   Best compatibility, but slower speed
    *   Suitable for low-end devices or devices without GPU

#### Thread Count

*   Set the number of CPU threads used for model inference
*   Default value is **8**
*   Recommended adjustments based on device CPU cores:
    *   4-core devices: Recommended 4-6 threads
    *   8-core devices: Recommended 6-8 threads
    *   More cores: Can be increased appropriately, but too many threads may cause performance degradation

---

## Usage Recommendations

### Performance Optimization Tips

1.  **Disable Memory Links**: Local models have limited understanding capabilities. Disabling memory can avoid context confusion
2.  **Disable Tool Usage**: Local models perform poorly when handling complex tool calls. It is recommended to disable tools in conversation settings
3.  **Choose Appropriate Models**:
    *   Small models (e.g., 1.5B-3B): Fast speed, but limited capabilities
    *   Large models (e.g., 7B-20B): More capable, but require more storage space and computational resources
4.  **Adjust Thread Count**: Adjust thread count based on device performance to find the balance between speed and stability

### Suitable Scenarios

Local MNN models are suitable for the following scenarios:

*   **Privacy Protection**: Need to run completely offline without uploading data to the cloud
*   **Network Restrictions**: Use in environments without network connection or unstable networks
*   **Cost Control**: Avoid API call fees
*   **Simple Conversations**: Basic text conversations without complex reasoning

### Unsuitable Scenarios

The following scenarios are recommended to use cloud APIs:

*   **Complex Tasks**: Tasks requiring deep understanding, code generation, complex reasoning, etc.
*   **Tool Usage**: Need AI to call various tools to complete complex operations
*   **High-Quality Conversations**: Need high-quality, fluent conversation experience
*   **Multimodal Tasks**: Need to process multimodal content such as images and audio (although some MNN models support Vision, performance is limited)

---

## Important Notes

*   **Storage Space**: MNN model files are large (usually several GB to tens of GB). Please ensure your device has sufficient storage space
*   **Device Performance**: Local inference has high requirements for device performance. Low-end devices may run slowly or be unable to run
*   **Battery Consumption**: Local model inference consumes a lot of battery. It is recommended to use while charging
*   **Heat Issues**: Long-term operation may cause device heating. Please pay attention to heat dissipation

---

By properly configuring and using MNN local models, you can enjoy basic AI conversation functions while protecting privacy and controlling costs. However, for scenarios requiring high-quality experience, we still recommend using cloud API services.

