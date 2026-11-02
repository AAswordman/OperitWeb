---
fork: https://github.com/AAswordman/Operit
---

# Operit 2 Client Migration

## Old Implementation

The Rust CLI used the GitHub Device Flow and required the operator to set a GitHub OAuth client ID environment variable. The Flutter marketplace page required the user to create and paste a GitHub Token.

## New Implementation

Both the Rust CLI and Flutter call Core's typed `GitHubOAuthBrokerService`. Flutter uses the generated Dart proxy, and the CLI uses the generated Rust proxy; neither passes marketplace authentication command strings, parses command stdout, nor hand-writes CoreLink requests. The app itself prepares the completion address, Core uses that address to call the Worker's `/oauth/github/start` and privately stores the delivery credential; the app displays the authorization page and hands back the completion link. The CLI uses a temporary loopback and prints the authorization link in the terminal; the Flutter marketplace login dialog intercepts the completion navigation of its WebView. Core claims only once, and only after receiving a completion link matching both the current transaction and the target address, and saves the GitHub token returned by the Worker.

## Protocol Responsibilities

- The Worker holds the OAuth client secret, generates PKCE, and handles GitHub callbacks
- The client contains neither the client ID nor the client secret
- The Flutter marketplace page holds no OAuth HTTP, platform Intent, EventChannel, or loopback receiver; it only manages its own visible WebView navigation
- The client does not repeatedly query the Worker for authorization status
- Rust parses and validates Broker responses, and pins the protocol contract with unit tests

[DONE]
