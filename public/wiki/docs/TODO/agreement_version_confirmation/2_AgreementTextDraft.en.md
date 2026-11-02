---
title: Agreement Text Implementation Record
status: completed
document_type: agreement-implementation-record
agreement_version: 2026-07-15
last_reviewed: 2026-07-15
---

# Agreement Text Implementation Record

This file records the agreement text after user confirmation. The content has been written into the app's plain-language Chinese version and rigorous version of the agreement, and is kept consistent with `CURRENT_AGREEMENT_VERSION`; the existing multilingual agreement resources have been updated in sync, to avoid the new version confirmation page displaying old terms.

## Plain-Language Version

**Service boundary statement:** Operit does not provide anthropomorphic emotional interaction services aimed at the public. Operit is an open-source client that runs locally on the user's device; it does not operate model inference services, host chat sessions or interaction data, or distribute shared model credentials to users. Cloud model requests are sent by the user directly from the device to the chosen model provider using credentials configured by the user, and the relevant data is subject to that provider's rules; local models perform inference on the device.

This app can call file, terminal, automation, Root, ADB, extension, and other capabilities. Before operating, please verify the content, back up important data, and grant permissions with care; losses to devices, data, accounts, or otherwise caused by user operations, user configuration, third-party services, or third-party extensions shall be handled by the actual operator in accordance with applicable law.

For third-party plugins, scripts, Skills, toolkits, and other content in the plugin market, their copyright and related liabilities belong to the labeled authors or rights holders. Market display or installation does not mean that Operit guarantees, endorses, or has acquired rights to that content. Before using, modifying, publishing, or redistributing, please confirm the license and rights status yourself.

## Rigorous Version

<p><b>Operit User Agreement and Privacy Policy</b><br>Version: 2026-07-15; Proposed effective date: July 15, 2026.</p>

<p><b>1. Scope and Agreement Version</b><br>This agreement applies to the officially released Operit Android client and its optional online features. Using this app means you have read and agreed to the current version. The app records the agreement version you confirmed at launch; when the agreement undergoes a material update, the app will require you to reconfirm before you can continue using it. The open-source code license in the repository is governed by the GNU Lesser General Public License version 3 (LGPLv3) set out in the root <code>LICENSE</code>; this agreement does not exclude or reduce the rights granted to you by applicable law and open-source licenses.</p>

<p><b>2. Product Positioning and Third-Party Services</b><br>Operit is open-source client software; it does not provide large language model inference, shared API Keys, chat request relaying, or cloud hosting of chat records. Cloud models, cloud speech, search, drawing, MCP, and other network features are chosen, configured, and enabled by you. When you use such services, data is sent directly to the corresponding providers and is subject to their terms of service and privacy policies. You shall judge for yourself the security, legality, and suitability of providers, models, endpoints, and extensions, and safeguard the relevant credentials properly.</p>

<p><b>3. Data Processing and Privacy</b><br>Chat records, character cards, memories, model configurations, and API Keys are generally stored in the device's app data. When you actively export, back up, upload files, use third-party network features, or submit requests to external HTTP services, the relevant data will be copied, transmitted, or disclosed according to your actions. Market, announcement, update check, GitHub login, and publishing features access Operit, GitHub, or related third-party resources; these features do not forward chat model requests. Manage your data and credentials in light of device security settings, third-party service terms, and this agreement.</p>

<p><b>4. External Deployment and Operational Responsibility</b><br>External HTTP services, QQ Bots, auto-replies, and similar capabilities are enabled by your choice. When you open them to others or to the public, you shall, as the actual deployer or operator, be responsible for access control, user authorization, content safety, data protection, protection of minors, necessary notices, and other applicable obligations. When continuously providing emotional interaction services that simulate the personality traits, thinking patterns, or communication styles of a natural person to the public within China, you shall assess and comply with the <i>Interim Measures for the Administration of Anthropomorphic Artificial Intelligence Interaction Services</i> and other applicable provisions yourself. You shall not use this app to provide virtual relatives, virtual partners, or other virtual intimate relationship services aimed at minors, induce emotional dependence or addiction, carry out emotional manipulation, or engage in other activities that infringe upon the lawful rights and interests of others.</p>

<p><b>5. Lawful Use and Content Responsibility</b><br>You shall comply with applicable laws and regulations, third-party service rules, and platform rules, and shall not use this app, extensions, or configurations to carry out illegal activities, infringe upon the rights of others, access systems or data without authorization, or disseminate illegal or harmful content. You are responsible for the content and conduct you input, configure, generate, publish, forward, or operate yourself. AI outputs may contain errors, omissions, or biases, and do not constitute medical, psychological crisis, legal, financial, or other professional advice; in emergency or dangerous situations, please contact local emergency services, medical institutions, or trusted persons promptly.</p>

<p><b>6. Software Provided As Is</b><br>To the extent permitted by applicable law, this software is provided on an "as is" and "as available" basis. Contributors make no express or implied warranties regarding the continued availability, accuracy, security, merchantability, fitness for a particular purpose, or non-infringement of the software or third-party services. Losses caused by using this software, third-party services, extensions, user configurations, or your own modifications shall be handled in accordance with applicable law and the corresponding service agreements.</p>

<p><b>7. Agreement Updates and Contact</b><br>We may update this agreement due to functional, legal, or security requirements, and will provide the current version in the app. Updates that materially affect user rights will take effect by raising the agreement version and requiring reconfirmation. You may raise questions and comments through the project repository, the in-app feedback entry, or public contact channels.</p>

## Review Record

- The user has confirmed implementation at this version.
- Retain "Proposed effective date: July 15, 2026".
- Removed the blanket restriction in the old agreement of "personal use only, all commercial use prohibited", to avoid conflict with the scope of the LGPLv3 license.
- Not yet supplemented with the project entity's legal name, contact email, or privacy request handling channel.

## Completion Record

Status: complete. The agreement text has been written into the existing agreement resources in `app/src/main/res/values*/strings.xml`; no compile, build, or test commands were executed.
