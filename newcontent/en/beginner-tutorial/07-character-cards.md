# 07. Character Cards, Tags, Group Chat

The software has a very long built-in **system prompt**, and the most important part of it is the **character card**. Besides character cards, the prompt also concatenates **tools**, **latex rendering format**, **status tags**, **user preferences**. (Note: the injection of **memory** and **time** is NOT included here, and this is **strictly prohibited** as it will severely disrupt the **context cache**)

When building the prompt, the content filled in the character card will be flattened (except for special parts like **opening message**, **other content**), then inserted into the **system prompt**. Then, the character card's **tags** are also inserted one by one.

**Special note!!! Description will NOT be concatenated into the prompt!**

I won't spend time explaining what "**system prompt**" is here. If you're not sure, you can search it yourself.

## Character Cards

Character card configuration is somewhat scattered. Besides core **character settings** and **avatar**, there are also external bindings like **themes**. This will be explained in two parts.

From my personal understanding, I want character cards to be "*defining what the AI is*". Therefore, the entire design of he/she won't store any **memory**/**user personality**, because these things are more like things attached to the user.

When the software initializes, it will automatically create a cartoon avatar character card called "**Operit**", which is a character card full of **mechanical feel** and **task feel** (but doesn't follow the **Three Laws of Robotics**) (escape)

### Core Configuration

#### Creating Character Cards

To create a character card, go to the **Settings screen**, scroll down, find **Character Card Editor**, then operate. You can directly click the "``+``" button to create a new character card, or directly **copy** an existing character card.

In addition, you can also use **AI-assisted character card creation**.

##### AI-Assisted Character Card Creation

> Please note that **AI-assisted creation has limitations** and cannot accurately judge when to stop. When you think it's about right, do **manual modification** directly instead of continuing the **AI dialogue**

**Especially emphasize** that direct dialogue here will **directly modify the currently selected character card**. Therefore, you must first click on the **current character's name** in this interface, create a new empty card, and then talk to the AI for modification.

![1.打开设置，找到"人设卡生成"](/manuals/assets/images/Luban_1756808515822d0bd7291-dba3-49df-a8df-140c0d0ce11c.jpg)
![2.在里面提供对AI的要求即可，AI助手会帮你填写。填写完毕即可在设置"设置"提示词编辑](/manuals/assets/images/Luban_17568085158497b6977ae-54bf-47c5-b746-6db78537b819.jpg)
![提示：如果已经有创建好的，为了避免混淆记得按图中位置](/manuals/assets/images/Luban_175681041748570cce1c9-3d7d-4684-9881-740c65777254.jpg)
![对角色卡进行精准的选择，这里也可以看见AI对角色卡生成的内容。](/manuals/assets/images/Luban_1756810417503b807133d-08b9-4fd6-9895-ac006ed6c879.jpg)

#### Import

In the **Character Card Editor interface**, the third **downward arrow** icon represents **import**. You can choose to import **Tavern character cards**, but **regex** is not yet supported. **World Info** will be converted to **tags** and imported simultaneously, and will be used according to **tag rules**.

**Multi-QR Code** is an interesting experimental feature. It allows you to directly "*steal*" character cards from someone else's export by scanning.

#### How to Change AI Avatar

![1.在设置中找到"提示词编辑"点击打开](/manuals/assets/images/Luban_1756890493442ca101dc6-1c7d-4423-b950-720ea58f3adb.jpg)
![2.选择需要修改头像的角色卡，点击右上角编辑](/manuals/assets/images/Luban_17568904934607606a092-e736-4e16-8883-9d98c0a22412.jpg)
![3.点击角色头像即可进入图片选择界面，选择图片即可，最后点击"保存"即可](/manuals/assets/images/Luban_175689049347921a7570d-2ebc-4530-83c1-270782d5cb3a.jpg)

#### "Other Content" Behavior Description

This part will be **loaded by scene**, used to replace the previous version's "**system tags**". Taking the default character card **Operit** as an example, "**Other Content (Chat)**" will be loaded during **normal UI dialogue**, while "**Other Content (Voice)**" will be loaded during **voice call**.
This allows the AI to correctly distinguish between **written language** and **spoken language**, speaking more briefly and directly during calls.

#### Opening Message

**Opening message** will be automatically appended to the chat window when **creating a new dialogue**, based on the current character card.

#### Fixed Model and Fixed Tools

In **Advanced Options**, you can specify which **model** or **tools** this character card can exclusively use. During dialogue, this won't follow **global configuration** but follow the **character card**, as shown in the picture. I think this is still simple and easy to understand (?)

Also, a special reminder: this **fixed model** only refers to "**dialogue function model**", and won't fix others.

![](/manuals/assets/images/1.jpg)


### External Bindings

To make each character card more differentiated, and also to meet the needs of users who don't distinguish character cards much and just use them as prompts, the software's bindings appear quite complex (?)

#### Theme and WAIFU Binding

Simply put, the software's **theme** and **waifu mode** will directly apply to the current **character card**. At the same time, this won't affect other character cards. When **switching character cards**, the theme will switch immediately.

#### Dialogue Binding

All **dialogues** must be **bound** to a certain character card, although you can still use character card B in a dialogue bound to character card A. If you switch to avatar mode, you will see: the dialogue still shows in A's **chat history category**, and messages you send to A will be replied to by A, but if you switch the character card to B at this time without creating a new dialogue, the AI will reply to you using **B's identity**.

Note: in this case, the AI will still think it's a **two-person dialogue**, without **consciousness isolation**.

In the chat history menu, you can choose multiple display methods. If you want good isolation between characters, it's recommended to turn on **Auto Switch Character Card**. When you click on a chat history item bound to a certain character card, it will automatically switch to the corresponding character card.

Of course, some people hope not to distinguish so many character cards, just use them as prompts, as long as there's **folder classification** enough. Then you can turn off this option and choose to classify by **folder**.

![](/manuals/assets/images/2.jpg)

#### Sender Binding

Huh? Someone might wonder, what is this thing?
Yes, this is when a certain character, as a **sender** (that is, appearing on the **right side** of the screen), talks to another character card, the **sender binding** appears.

In this case, the character being sent to will realize that the message sent to him/her is from the **user** and **a certain character**, that is, there will be **non-two-person dialogue** perception. But actually the effect is average, not as good as **group chat**. If there's a chance later, I'll explain in detail in the **advanced tutorial**.

## Tags

**Tags** will be automatically merged when concatenating character card prompts.
You can also go to the **Tag Market** to find interesting tags.

Generally, using tags can unlock interesting hidden features of the software, such as in tag descriptions, output in **html** format, output in what format. Unlike character cards, tags determine a **broad behavior** and can be applied to multiple character cards.

Character cards will include tags when exported.

## Group Chat

In the character card editor interface, you can enter the **Group Tab**. Then you can create a **group**. Group activation and binding relationships are completely equivalent to character cards.

Under a group, each character in **waifu mode** will follow their own independent configuration. Group chat will be organized by the **Group Planning Function Model**. If it gets stuck in group chat organization, you need to check this model.

During chat, **long press** a character's avatar to ``@him/her``. You can also reasonably use the **reply function**. Group chat will burn a lot of **tokens** (although the software still tries to make the cache hit). Characters can talk to each other, with **isolation awareness**.

## Other Prompts

The remaining prompts mainly consist of **Workspace** (if any), **Latex Instructions** (requiring AI to use ``$`` to wrap formulas, not very useful), **Status Description** (this is very critical for **summarizing memory**, triggered when output tasks complete), **User Preferences** (this is just some characteristic memory of the user), and **Tools**.

Yes, the above does NOT include **memory**. Memory must be actively called via **tools** (memory tools are independent of **disable tool selection**, and will only be appended when **memory attachment is on**), and will not be automatically injected into the prompt. This is to prevent the dialogue itself from being led astray. If needed, you can consider using the **Information Injection Plugin** to append memory.

The concatenation of these prompts can be controlled via **Disable Items**.

![](/manuals/assets/images/3.jpg)