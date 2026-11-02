# Abnormal-Exit Session Reclamation

## Old Implementation

`TerminalManager.handleTerminalSessionExit` only wrote an exit message to `OutputProcessor`, and did not delete the exited session from `SessionManager`. Since the tool layer looks up existing sessions by session name, subsequent calls would get the same invalid Session ID.

## Change Intent

After the exit-command event completes, call `SessionManager.closeSession`, so that the state table, read/write resources, provider session, and output-processing state are released together. The next time `super_admin:terminal` creates a session using the original session name, it will enter the normal new-session creation flow.

## Expected Result

The exit command can still receive the terminal exit message; the old Session is no longer reused; subsequent same-name terminal calls obtain a new, usable Session. Existing tool names, parameters, and AIDL interfaces remain unchanged.
