# GitHub OAuth Broker

The `market-v2` Worker exchanges GitHub OAuth authorization codes for the Android application.

## Credentials

Cloudflare Worker secrets hold `OPERIT_GITHUB_OAUTH_CLIENT_ID`, `OPERIT_GITHUB_OAUTH_CLIENT_SECRET`, and `OPERIT_GITHUB_OAUTH_TRANSACTION_KEY`. They must not be committed, added to GitHub Actions, or placed in an Android build.

## Endpoints

- `POST /oauth/github/start` creates a five-minute PKCE transaction and returns the GitHub authorization URL plus a one-time delivery credential.
- `GET /oauth/github/callback` validates GitHub's redirect and completes the code exchange.
- `POST /oauth/github/consume` returns the completed authorization result exactly once to the device that holds the delivery credential.

The existing `POST /market/v2/auth/github` endpoint remains unchanged for already released Android clients.

## Deployment Order

Apply the D1 migration and deploy the Worker before shipping the Android release. Keep the legacy OAuth App until the announced migration deadline; do not put its secret in any new artifact.
