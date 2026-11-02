# Android Login Replacement

## Old Implementation

The GitHub login UI provided two paths, an embedded WebView and an external browser, and the app exchanged the token directly with GitHub after receiving `operit://github-oauth-callback`.

## New Implementation

Android registers the completion address through the generic browser callback component, displays the authorization page returned by the Worker, and intercepts the final navigation to `https://api.operit.app/oauth/github/complete`. The coordinator verifies the current transaction, claims once, and saves the GitHub token and user information.

When the user explicitly signs out of GitHub login, the app clears its own WebView's Cookie and WebStorage, then deletes the local authentication information. The next login does not silently reuse the previous GitHub Web session; this does not affect the GitHub login state of the system browser or Chrome.

## Result

- Removed the old custom scheme, external browser callback, and Activity Intent takeover
- The browser callback component contains no GitHub protocol, token, or claim credentials
- Removed Android's client ID and client secret BuildConfig fields
- Authentication version upgraded; old APK data is not continued to be used by the new authentication code

[DONE]

[DONE]
