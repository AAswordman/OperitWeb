Welcome to **Operit AI**! This guide is made to help you get started quickly and fully use Operit AI’s powerful features, turning your phone into a real smart assistant.

## 🗺️ Basic Process Guide

### First-time Use / Trial

When using Operit AI for the first time, you need to do some simple setup. Below we will finish it in the fastest steps:

#### Step 1: Read Our Agreements

![User Agreement and Privacy Policy](/manuals/assets/user_step/step_for_frist_1.jpg)

#### Step 2: Grant Permissions

Here, grant several basic permissions to the app.

Special note: **floating window permission is a must**, otherwise the authorization pop-up may not appear.

![Permission Guide](/manuals/assets/user_step/step_for_frist_2.jpg)

#### Step 3: Choose Permission Level

At this step, if you are not sure what these options mean, just choose **Standard Permission**.

If you have Shizuku, choose **Debug Permission**; if you have root, choose **Root Permission**.

There are some risks under accessibility permission. If you want auto-click features, you can consider **Accessibility Permission** and the options under it.

![Choose Permission Level](/manuals/assets/user_step/step_for_perm.png)

#### Step 4: Set User Preferences

User preferences will be sent to AI when chatting with AI, and they will also be gradually auto-corrected during conversations.

Some people get stuck on what this “identity recognition” means. It means what kind of identity you want AI to treat you as.

Of course, you can also leave all these options blank and just scroll to the bottom to confirm. That also has no impact.

![Preference Settings](/manuals/assets/user_step/step_for_frist_3.jpg)

#### Step 5: Configure Your Own API

##### Case 1: Use the Built-in Direct Setup

Here, you can click get token, jump to DeepSeek official site, and apply for a key. In the middle, you may need to pay/recharge on DeepSeek official side. This is billed by usage.

After applying, fill it in and click the button once, then you can start chatting.

![Start Using After API Setup](/manuals/assets/user_step/step_for_frist_4.jpg)

##### Case 2: Use Custom API

Of course, if you have your own API, you can click that custom button.

Here, you need to choose the provider matching your model. Main choices are: **OpenAI-compatible** and **OpenAI Response-compatible**. Of course, if your provider can be found directly in the list, just select it directly instead of using the generic option. The benefit is that you don’t need to fill in the URL manually—only token and model are needed.

If choosing other providers, it is the same as choosing OpenAI-compatible.

After choosing, fill in URL, then token, then click the button on the right side of model input to select model. After finishing, scroll to top and click test model.

If it passes, then continue to scroll down. If it does not pass, try changing provider / troubleshoot based on the error.

Also, endpoint often needs to be filled to the specific `completions` position.

For most models, please enable **toolcall**; for gpt, enable **strict toolcall**. For image/video recognition and similar features, enable according to whether the model truly supports them. If unsure, testing will also make one connection check; if image recognition etc. is found unsupported, please disable it.

![Custom API Setup](/manuals/assets/user_step/custom.jpg)

About model configuration, we will introduce it in detail in the next article.

#### Step 6: Read and Explore

After finishing API configuration, you can return to Operit AI and start your smart assistant journey!

You can first try asking AI a few simple questions, for example: how many degrees today? where am I? open xxx app. search train tickets.

More advanced usage will be introduced later. Please don’t rush, this is only the software introduction, and there are many more tutorials after this.

#### Special Step: Terminal Setup

At this point, some people may wonder: “Wait, is this really enough? In the permission page, there is also an Operit Terminal that needs authorization!”

Yes, this part does need to be installed as well. But this is **not the most essential** part. For basic usage, doing the steps above is **already enough**. Of course, authorizing the terminal is also totally fine—just remember to do it in a place with good internet, because some components need to be downloaded.

The later documents will also explain terminal-related things in detail.