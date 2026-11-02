# Storage Writes and Error Prompts

## Old Implementation

The workflow main file uses plain text writes. If the process is interrupted during a write, the next read may encounter truncated JSON. Multiple repository instances may also read and write the same directory at the same time, making list results unstable.

Workflow files with format errors are only skipped during batch loading, making it hard for users to know that a storage file is the problem.

## Fix Intent

Use `AtomicFile` to commit workflow and run-record JSON, and have the repository layer protect main workflow file reads and writes with a shared mutex. When reading the list, aggregate the filenames with format errors and tell the user through a visible prompt which files were skipped.

## Impact Scope

- New workflow storage exception wording
- Workflow main file reads, writes, deletion, and batch loading
- Workflow run-record writes

[DONE]
