# GitHub OAuth Broker

The `market-v2` Worker exchanges GitHub OAuth authorization codes for Operit clients.

## Credentials

Cloudflare Worker secrets hold `OPERIT_GITHUB_OAUTH_CLIENT_ID`, `OPERIT_GITHUB_OAUTH_CLIENT_SECRET`, and `OPERIT_GITHUB_OAUTH_TRANSACTION_KEY`. They must not be committed, added to GitHub Actions, or placed in an Android build.

## Endpoints

- `POST /oauth/github/start` creates a five-minute PKCE transaction and returns the GitHub authorization URL plus a one-time delivery credential. Every caller supplies the callback destination prepared by its own application.
- `GET /oauth/github/callback` validates GitHub's redirect, completes the code exchange, and redirects the browser to the stored completion URL.
- `GET /oauth/github/complete` is the canonical completion page used by embedded application browsers. It carries an opaque transaction ID and completion status, never a GitHub token or delivery credential.
- `POST /oauth/github/claim` returns the completed authorization result exactly once to the client that holds the delivery credential.

The existing `POST /market/v2/auth/github` endpoint remains unchanged for already released Android clients.

## Deployment Order

Apply migration `008_github_oauth_completion_redirect.sql` and deploy the Worker before shipping clients. Keep the legacy OAuth App until the announced migration deadline; do not put its secret in any new artifact.
