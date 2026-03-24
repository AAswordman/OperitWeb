---
name: bilibili-column-publish
description: Publish or update a Bilibili column article from this repo's markdown guides while preserving the original wording, paragraph flow, bold emphasis, and inline image positions. Use when a guide under `public/newcontent/...` must be posted to Bilibili's article editor, with headings adapted to the editor's supported levels and guide images uploaded one by one through the built-in image flow.
---

# Bilibili Column Publish

## Overview

Use this skill when a repo guide must be published to Bilibili as a column article, not rewritten into a short social post. Keep the original wording, paragraph order, bold emphasis, and image positions. Adapt heading depth to what the Bilibili editor actually supports, rebuild the article in a clean editor state, upload local images one by one through the editor toolbar, then publish and verify the final public article page.

## Workflow

### 1. Resolve the source guide

- Read the source markdown from `public/newcontent/...`.
- Extract the title, body, and image references in original order.
- Preserve original wording and paragraph flow unless the user explicitly asks for rewriting.
- Keep image positions aligned with the source markdown.

### 2. Normalize the structure for Bilibili's editor

- Treat the title as a separate field; do not rely on the editor body to set it.
- Preserve `##` and `###` headings as real headings when possible.
- Do not rely on deeper heading levels like `####` and `#####`. In the Bilibili editor they may be flattened into plain paragraphs.
- Convert deeper step headings into standalone bold paragraphs instead, for example:

```html
<p><strong>步骤二：授予权限</strong></p>
```

- Preserve inline bold emphasis from the source guide.
- Prefer rebuilding the body as HTML segments instead of pasting raw markdown into a dirty draft.

### 3. Open a clean Bilibili editor state

- Use the Bilibili article editor route `https://member.bilibili.com/platform/upload/text/new-edit`.
- The actual editor lives inside an iframe whose URL includes `read-editor`.
- Work against the editor object exposed as `window.editor`.
- If the draft already contains failed imports, partial uploads, or duplicated blocks, clear the editor and rebuild from scratch instead of trying to salvage the dirty state.
- A verified cleanup path is:

```js
window.editor.commands.clearContent(true)
```

- Set the title field explicitly before publishing. Do not assume a previous draft title is still correct.

### 4. Insert text and images in alternating order

- Prefer `window.editor.commands.insertContent(...)` for text blocks.
- Insert the article in ordered segments so image positions stay exact.
- A reliable pattern is:
  1. Insert the first text segment.
  2. Upload the next image through the toolbar.
  3. Insert the next text segment.
  4. Repeat until the article is complete.
- Focus the editor to the end before each insertion or upload.
- Use the editor's own toolbar image button, which appears as `eva3-toolbar-image`.
- Upload local image files through the browser file chooser one by one.
- Do not batch multiple images in one chooser step for this guide style.
- Do not rely on remote `<img src="...">` injection. It may fail to create a real Bilibili image node even if the HTML appears to insert.
- Do not mix direct DOM file-input hacks with the normal file chooser path in the same upload sequence.

### 5. Wait for each image to become a real Bilibili image node

- After each upload, wait until the editor JSON reflects a new `enhancedImage` node.
- The final image source should resolve to a Bilibili-hosted URL such as `i0.hdslb.com/bfs/new_dyn/...`.
- Do not continue to the next step while the current image is still missing from editor state.
- If a file chooser gets stuck or multiple chooser states pile up, cancel the stale chooser states before continuing. Otherwise later automation steps may fail unexpectedly.

### 6. Verify the rebuilt draft before publishing

- Use `window.editor.getJSON()` or equivalent editor state inspection to confirm the draft is complete.
- Verify:
  - The title matches the intended article title.
  - The image count matches the source guide image count.
  - The tail paragraphs match the original guide ending.
  - The body order still matches the source guide.
- Prefer editor-state verification over visual guesswork when the draft is long.

### 7. Publish and verify the public page

- Use the Bilibili publish button only after the draft passes the checks above.
- Treat `你的专栏已提交成功` as the publish success signal.
- Click through to the published article page after success.
- Bilibili may manage the content under the `opus` flow even when the UI labels it as a column article.
- Verify the public page title, the opening paragraphs, and the full image sequence.
- Capture the final public article URL as the completion artifact.

## Repo-specific Paths

- Source guides: `public/newcontent/...`
- Common guide images: `public/manuals/assets/...`
- Existing sibling skills: `release-skill/xiaohongshu-publish/`, `release-skill/csdn-publish/`

## Browser Automation Notes

- Select the correct browser tab before snapshotting or clicking controls.
- The Bilibili editor is inside the `read-editor` iframe, not the top-level page.
- Verified editor commands include:

```js
window.editor.commands.clearContent(true)
window.editor.commands.focus('end')
window.editor.commands.insertContent('<p>...</p>')
```

- `setContent` may work, but segmented `insertContent` is safer when images must remain in exact positions.
- Refresh the browser snapshot before clicking upload or publish controls if the page state may have changed.
- The public management page may surface the new article under `https://member.bilibili.com/platform/upload-manager/opus`.

## Common Failure Modes

- Deep headings disappear or degrade into plain paragraphs.
  Convert `####` and deeper headings into bold standalone paragraphs before insertion.
- A remote image URL is inserted into HTML but no actual article image appears.
  Use the local upload flow through Bilibili's own image toolbar instead.
- The file chooser becomes stuck and later commands stop working.
  Cancel stale chooser states and restart the upload sequence one image at a time.
- The draft contains duplicated blocks or partial remnants from previous attempts.
  Clear the editor and rebuild from scratch instead of patching the dirty draft.
- Images appear uploaded visually, but the editor JSON count is still short.
  Wait for the new `enhancedImage` node and the hosted image URL before moving on.
- Publish appears to succeed but the final article is missing or incomplete.
  Open the management page and the public article page, then verify title, text, and image count again.

## Expected End State

- The Bilibili article preserves the source guide's wording and paragraph order.
- `##` and `###` headings remain headings where supported.
- Deeper headings are represented as bold paragraphs instead of being lost.
- Every guide image is uploaded to Bilibili and appears in the original position.
- The draft is verified through editor state before publish.
- The final public Bilibili article URL is available and viewable.
