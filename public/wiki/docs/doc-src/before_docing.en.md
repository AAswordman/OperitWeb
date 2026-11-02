---
tips: You can use a YAML-format fence `---` to fill in document metadata
For_Agent: Do not assume that any document you have written or modified is a published or final version, unless the user explicitly says so
---

# Writing documentation: giving words a shape, giving development a voice

By default, a double line break indicates a line break

Do not abuse bold: the purpose of bold is emphasis; if everything is bold, it is the same as nothing being emphasized, but English documents need uppercase NOT

Do not abuse parentheses: parentheses affect the visual appearance when editing and viewing, so make good use of various conjunctions and sentence patterns instead

## Views
- For developer documentation and all drafts and intermediate documents, Markdown diagrams are disabled; the DX is too poor
- When giving an overview of a directory, show a tree view using tab characters, and directory names should end with `/`.
- Mermaid is suitable for showing task graphs, but try not to use it for drafts

## Links and paths
- Make good use of the `[md link format]()` to improve the UX and DX of documents.
- Documents should use links relative to themselves, not absolute paths on disk; make good use of `../`, but do not go more than five levels up
- When the document hierarchy is too deep, indicate the root directory with an empty string, `/`, or the project name where it causes no ambiguity, but do not express it as a link

## List usage
- Make good use of unordered and ordered lists, and pay attention to their semantics
- If the leaf nodes of a list form complete sentences, the list should not exceed two levels; if they are words or phrases, three levels are allowed.
- If a leaf node does not end in a complete sentence, do not add a period
- A list whose root has fewer than two columns looks very odd visually; likewise, a group of four sentences **whose largest line break does not exceed two lines** does not suit being a list either
