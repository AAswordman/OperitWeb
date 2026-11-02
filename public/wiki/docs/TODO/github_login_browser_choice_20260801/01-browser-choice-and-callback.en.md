# Browser Choice and Callback

## Old Implementation

The old selection dialog could enter an embedded WebView, or open an external browser with `ACTION_VIEW`. The external completion address was `operit://github-oauth-callback`, received by an Activity.

## Intent Correction

Broker login no longer allows the old custom scheme, nor does it allow the client to hold the OAuth secret. The external browser instead uses a Worker-supported local callback address: the app first listens on a random port on `127.0.0.1` for `/oauth/github/complete`, then registers that address as the transaction completion address.

## Expected Results

- Every time the user initiates a GitHub login, they first choose between the embedded page or an external browser
- The embedded page keeps its existing completion link interception logic
- After the external browser completes authorization, the local listener receives the completion link and claims the login result
- The listener, activity transaction, and browser window are released on cancellation, timeout, or completion
