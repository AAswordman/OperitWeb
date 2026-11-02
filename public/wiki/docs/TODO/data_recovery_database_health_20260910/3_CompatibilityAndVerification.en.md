# Compatibility and Verification

## Published Interfaces

The data rescue UI was included in v1.12.1. The existing raw snapshot import/export, SQL input, preset queries, and post-recovery restart entry remain unchanged.

## Static Verification

- The "Configuration and Database Check" section is located after the SQL executor
- The check report is collapsed by default, showing only the pass count and issue descriptions directly
- Check operations do not execute write SQL against the live database
- Configuration checks only read an isolated copy, and configuration repairs are performed only after user confirmation
- Repair operations require a second user confirmation
- Preserving the original does not require the database to open successfully
- Chinese, English, and Japanese copy are maintained in sync
- App startup and other storage owners are not modified

## Items Not Executed

Per the repository execution guidelines, compile, build, or test commands are not run unless the user explicitly requests them.

[DONE]
