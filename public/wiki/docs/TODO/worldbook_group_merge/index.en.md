---
fork_repository: https://github.com/tuxKOH/Operit
status: completed
---

# World Book Group Merge

Merge the grouping capability of `com.operit.worldbook_plus` back into the stable package
`com.operit.worldbook`.

Previously, the world book could only manage entries as a flat list, with each entry individually bound to one character card. After the merge,
users can organize entries into groups, copy entries into groups, and select multiple character cards in the group UI.

The package ID stays `com.operit.worldbook`, and the version rises from `1.1.0` to `1.2.0`, so the already installed
stable package can update in place and keep using its existing `entries.json` data.

Scope:

- The source, build outputs, and package manifest of `examples/worldbook/`
- Group persistence, service interfaces, management UI, and Chinese/English text
- This TODO's change record

Group character card selection is only for organization and display; entry activation is still controlled by each entry's own
`character_card_id`, and that UI field must not be described as an activation rule.

See [1_MergePackageImplementation.md](1_MergePackageImplementation.en.md).

[DONE] The stable package has merged the grouping implementation, keeping `com.operit.worldbook` as the upgrade target.
