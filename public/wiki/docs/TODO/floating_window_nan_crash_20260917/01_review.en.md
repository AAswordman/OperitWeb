# Workspace Review and Fixes

## Plan

1. Verify size sources; do not write the speculation that persisted data corruption is the confirmed root cause as a confirmed root cause; remove the newly added logic that replaces illegal values with defaults, and make the validation state explicit.
2. Fix the timing of persisting crash counts and deactivation markers, and the service lifecycle handling after deactivation or initialization failure.
3. Unify size read/write bounds to avoid inverted upper/lower limits on small screens; fill in timestamp cleanup when manually restarted.
4. Statically review the final diff and submit.

## Review Results

- Crash records changed to a single synchronous commit, eliminating the race between asynchronous writes and process exit.
- After initialization failure, the start callback stops the service; the destroy flow no longer accesses uninitialized window objects, and the exception handler detaches itself when cleanup finishes.
- Size reads and writes share a valid range; non-finite values are explicitly rejected, and the documentation keeps the limitation that the NaN source is not yet confirmed.
- Manual restart clears both counts and timestamps.
- The Binder is not exposed when the service is not ready; the delegate records binding results, and on empty binding or window display failure it unbinds and clears the floating window mode state.

Static diff check `git diff --check` passed. No on-device run verification has been done yet.

[DONE]
