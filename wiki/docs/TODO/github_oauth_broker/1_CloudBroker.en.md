# Cloud Exchange Protocol

## Old Implementation

The device submits the OAuth authorization code and the client secret embedded in the APK directly to GitHub.

## New Implementation

The Worker creates a short-lived authentication transaction, generating a PKCE verifier and a one-time claim credential. The GitHub callback is received by the Worker, which exchanges the authorization code; the user token is temporarily stored encrypted and then redirected to the completion address pre-registered with the browser callback Host; after Core validates the completion link, it claims once with the claim credential, and the record is then deleted.

## Result

- The client secret does not leave the Cloudflare secret
- The authorization code, token, and claim credential do not appear in the browser callback URL
- Completion notifications do not generate Worker polling requests
- The new interface does not change the `/market/v2/auth/github` used by old clients

[DONE]

[DONE]
