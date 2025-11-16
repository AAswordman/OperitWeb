### Knowledge Base and Memory

Operit AI's knowledge base feature allows AI to learn and remember information in conversations and store it in a structured way, forming a dedicated memory network.

#### Activating Memory Function

The memory bank is bound to user preference settings (user personality). Therefore, before activating the memory function, you need to configure user preferences.

If you want to turn off the memory function in a conversation, simply turn off `Memory Attachment`.

1.  **Set Active Configuration:** Set the user preference you wish to use to active status.
2.  **Enable Memory Attachment:** In the "Memory" option in the lower right corner of the chat interface, ensure the "Memory Attachment" function is enabled.

![Enable Memory Attachment](https://linux.do/uploads/default/original/4X/2/2/b/22bebda149dbc0ba4a75e7a315bf1e6e10b6abdf.png)

#### Generating and Viewing Memories

After having an appropriate conversation with AI, the system will automatically capture key information. If the memory bank doesn't immediately display content, you can try telling AI "task completed" to trigger memory generation.

#### AI's Automatic Learning and Deactivation

Operit AI actively learns key information during conversations and synchronously updates the associated **knowledge base** and **user preferences**. When you feel a certain task or conversation stage is complete, you can tell AI "task completed", which will prompt AI to organize information and generate memories.

If you wish to control or turn off AI's automatic learning function, you can operate in the following ways:

1.  **Turn off Memory Attachment**
    *   **Operation:** In the lower right corner of the chat interface, turn off the "Memory Attachment" switch.
    *   **Effect:** Prevents AI from learning and generating new memories in the **current conversation**. This is a temporary setting only for the current conversation.

#### Memory Bank Interface Operations

The memory bank provides a visual interface to manage AI's memory nodes:

-   **Create Memory:** Manually add a new memory node to the memory network.
    ![Create Memory](https://linux.do/uploads/default/original/4X/7/b/a/7baae06302a0f979eef7fed946a63ef271ecf9ec.jpeg) ![Memory Details](https://linux.do/uploads/default/original/4X/a/b/6/ab64dc1ed402cff8131f6077149418634cd3c6c2.jpeg)

-   **Box Selection Edit:** Hold Shift and drag the mouse to box-select multiple memory nodes for batch editing or deletion.
    ![Box Selection Edit](https://linux.do/uploads/default/original/4X/3/4/2/342a1fd38e6c2a3a46c92d24ebd36fdd1aca4701.jpeg) ![Selected State](https://linux.do/uploads/default/original/4X/2/e/8/2e85ec97a897bff3a1816b8d1a43a8851dd89e01.jpeg)

-   **Add Connection:** Establish weighted directed connections between different memory nodes to express relationships between them.

-   **Import File:** Supports batch importing content from `.txt` files, or you can send other types of files to AI and let it automatically extract information and store it in the memory bank.

#### Send Memory Function

During conversations, you can actively send memory folders to AI, allowing AI to retrieve relevant memories from specified memory folders, thereby better understanding context and providing more accurate responses.

**Usage Instructions:**

1.  **Open Attachment Menu:** In the chat interface, click the "+" button to the right of the input field to open the attachment menu.
2.  **Select Memory Option:** In the attachment menu, find and click the "Memory" option (icon shows a circuit board/chip).
3.  **Select Memory Folders:** In the "Select Memory Folder" dialog that appears, select one or more folders. AI will be able to retrieve relevant memories from these folders.
4.  **Confirm Send:** Click the "Confirm" button, and the selected memory folders will be sent to AI.

![Memory Attachment Menu](/manuals/assets/knowledge/40e91c0371f6e4fad3cdbb5573a0518e.jpg)
![Select Memory Folder](/manuals/assets/knowledge/bd1ce3211eb017a0e04c27611fed0778.jpg)

**Function Effect:**

After sending memories, AI will automatically retrieve relevant memory content when answering questions and reference these memories when needed, thereby providing responses that better match your personal preferences and conversation history.

![Memory Retrieval Effect](/manuals/assets/knowledge/c127c03567023f8aa10014f33be50fe5.jpg)

#### Effect Display

By building a memory network, AI can better understand context, perform complex tool calls and concurrent processing, thereby providing more intelligent responses.

![Tool Call](https://linux.do/uploads/default/original/4X/3/2/e/32e3bfa091d8ca44587097e74074fd99a5d269e3.jpeg) ![Concurrent Call](https://linux.do/uploads/default/original/4X/7/e/5/7e5179d35b644be5bc1119108ef750668057628b.jpeg)
![Memory Details](https://linux.do/uploads/default/original/4X/3/f/2/3f2f6371134dbf21c806c69160d908aaae373dca.jpeg) ![Final Effect](https://linux.do/uploads/default/original/4X/a/3/f/a3fa1ca6a8becc9d2d536e7a859fc4dbdbdb2e1c.jpeg)

