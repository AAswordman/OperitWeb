---
fork: https://github.com/AAswordman/Operit
---

# GitHub Login Browser Choice

## Previous State

GitHub login opened the in-app WebView directly. An earlier login entry let the user choose between an embedded page or an external browser, but the old external flow depended on a removed custom scheme and a deprecated device-side OAuth secret.

## Goals

- Restore the choice dialog between the embedded page and the external browser
- Let both methods keep using the Broker's PKCE and one-time claim credentials
- Let the external browser deliver the completion link via a local callback address

## Scope

- Android GitHub login dialog, OAuth coordinator, and local callback listener
- Android Chinese and English resources
- This TODO record
