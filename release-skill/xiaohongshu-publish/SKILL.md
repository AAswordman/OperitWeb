---
name: xiaohongshu-publish
description: Prepare and publish Xiaohongshu notes from this repo's documentation pages. Use when a markdown guide must be rendered in local screenshot mode, exported with the repo's built-in long-image workflow, extracted into the workspace, and then uploaded or updated through Xiaohongshu browser automation.
---

# Xiaohongshu Publish

## Overview

Use this skill when a guide article in this repo needs to be published or updated as a Xiaohongshu note. Render the guide through the local screenshot page, export long-image assets with the repo's built-in workflow, unpack them inside the workspace, then replace the note images and publish through browser automation.

## Workflow

### 1. Resolve the source guide

- Find the markdown source under `public/newcontent/...`.
- Map it to the local guide route `http://localhost:5173/#/guide/new/<category>/<slug>?mode=screenshot`.
- Prefer the local route over manual markdown rewriting when the deliverable is a Xiaohongshu image post.

### 2. Verify screenshot-mode state before export

- Open the guide with `?mode=screenshot`.
- Confirm the page uses a pure white background and black text in computed styles.
- Confirm the content column width stays stable; shrink embedded screenshots instead of shrinking the whole page just to make images look smaller.
- Wait until the page status says all images are loaded before exporting.

### 3. Export assets

- Use the screenshot page's built-in export button instead of ad hoc local slicing.
- Expect a zip download named like `<slug>-chunks.zip`.
- Extract the zip into a workspace-local directory such as `temp/xhs_zip_exports` before upload.
- Verify file count and file sizes after extraction.

### 4. Update the Xiaohongshu note

- Open the existing note edit page when a note id or edit URL is available.
- Use the full `重新上传` flow to replace the old image set in one operation.
- Upload the extracted workspace-local PNG files through the browser file chooser.
- Keep the body text short; put the long-form content inside the exported images.
- Confirm the image count, preview count, and body counter before publishing.
- Click publish and verify the Xiaohongshu success page appears.

## Repo-specific Paths

- Screenshot-mode implementation lives under `src/components/MarkdownRenderer.tsx`, `src/components/MarkdownRenderer.css`, `src/pages/GuideNewPage.tsx`, and `src/layouts/MainLayout.tsx`.
- Typical extracted upload directory: `temp/xhs_zip_exports`

## Browser Automation Checklist

- Select the correct Playwright tab before reading the page state.
- Refresh the browser snapshot before clicking upload, re-upload, or publish controls.
- Use the file chooser upload flow when Xiaohongshu opens one; do not mix it with direct DOM file input manipulation in the same step.
- Wait for image counters and preview counters to settle after upload.
- Treat `更新成功` as the success signal for edit flows.

## Common Failure Modes

- Exported images are too tall.
  Adjust the built-in export behavior in the repo and export again.
- Embedded screenshots look cropped.
  Fix screenshot-mode styling in the repo and verify on the local page before exporting again.
- Browser automation cannot upload exported files.
  Extract or copy the files into a directory under the repo before uploading.
- The note still shows old images.
  Use the full re-upload flow instead of appending new files.
- The publish click appears to work but the note is unchanged.
  Verify the page actually redirected to Xiaohongshu's success page.

## Expected End State

- Screenshot mode exports a zip of chunked PNG files.
- Exported chunks stay readable and suitable for Xiaohongshu image posts.
- The Xiaohongshu note uses only the newly exported images.
- The note body is a short lead-in rather than a full guide transcription.
