# Settings and Prompt Integration

Old implementation:

- Memory library settings only saved retrieval weights, the auto-save interval, and embedding model configuration
- Both auto-save and manual updates entered `MemoryLibrary.generateAnalysis`, but the knowledge graph prompt did not accept user rules

Intended fix:

- Save text rules in the current memory space's preferences
- Provide a multi-line edit box below the interval description in the auto-save settings area
- In the knowledge graph extraction prompt, limit the rules to ingestion scope, classification, and expression preferences, while continuing to require strict JSON output

Expected results:

- Switching memory spaces shows each space's own rules
- Auto-save and manual updates use the same rules
- Restoring defaults clears that memory space's rules

[DONE]
