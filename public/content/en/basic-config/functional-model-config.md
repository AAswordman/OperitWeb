### Functional Model Configuration

In Operit AI, different functional modules may need to call AI models to complete specific tasks. To give you more flexible control over cost and effectiveness, we provide a functional model configuration center. Here, you can separately specify which model configuration to use for various AI services within the software.

![Functional Model Configuration](/manuals/assets/preference/functional-model-config.png)

#### Description and Recommendations for Each Functional Module

*   **Conversation Function:**
    *   **Description:** This is the core conversation function of the app, used for daily chatting and interaction with you.
    *   **Recommendation:** Generally recommend using a powerful standard model for the best experience. You can also switch the model used for the current conversation at any time in the chat interface.

*   **Conversation Summary:**
    *   **Description:** This function is used to generate summaries of conversations, making it convenient for you to quickly review and track important information.
    *   **Recommendation:** Does not require high model performance; you can choose any model, including some lightweight small models, to save costs.

*   **Question Bank Management:**
    *   **Description:** Used for intelligent analysis and management of your question bank.
    *   **Recommendation:** Similar to conversation summary, any model can be used, and small models are also competent.

*   **File Binding Processing:**
    *   **Description:** When you upload or bind files, this function will process file content, performing intelligent binding and mixing to provide more precise context understanding and code processing capabilities.
    *   **Recommendation:** This function has certain requirements for model response speed and processing capability. We **recommend using fast and cost-effective models**, such as `Gemini Flash`. Using slow models like `DeepSeek R1` is not recommended.

*   **UI Controller:**
    *   **Description:** Used to control and operate the software interface through natural language commands.
    *   **Recommendation:** Any model can be selected.

---

If you need to add or modify model configurations (for example, adding a new Gemini API Key), please refer to `Model Configuration`.

