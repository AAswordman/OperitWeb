---
name: juejin-publish
description: Publish or update a Juejin article from this repo's markdown guides while preserving the original wording, heading order, bold emphasis, and inline image positions. Use when a guide under `public/newcontent/...` must be posted to Juejin with Juejin-hosted images, especially when tall phone screenshots need centered HTML image tags with a fixed `height` instead of width-based markdown images or external image links.
---

# Juejin Publish

## Overview

Use this skill when a repo guide must be published to Juejin as an article, not rewritten as a social post. Keep the original markdown wording and structure. Upload every guide image through Juejin's own image flow first, replace local image paths with Juejin-hosted URLs, render tall phone screenshots with centered HTML `<img>` tags using a fixed `height`, then publish and verify the final article page.

## Workflow

### 1. Resolve the source guide

- Read the source markdown from `public/newcontent/...`.
- Extract the title, body, and image references in original order.
- Preserve original headings, paragraph flow, bold emphasis, and image positions unless the user explicitly asks for rewriting.

### 2. Upload images to Juejin first

- Do not keep external image URLs in the final article body.
- Do not reuse CSDN-hosted image URLs or other third-party hotlinks. They can fail in Juejin with browser-side blocking such as `ERR_BLOCKED_BY_ORB`.
- Use Juejin editor's built-in image upload button in the left toolbar.
- Upload guide images one by one through the browser file chooser.
- Prefer local files on `D:\` now that the Playwright MCP root has been widened to `D:\`.
- Keep the uploaded Juejin image URLs in the same order as the source markdown image references.

### 3. Rebuild a clean Juejin body

- Start from the original markdown body instead of patching a dirty draft line by line.
- Replace only the image lines; keep the original text untouched.
- For regular images, a normal markdown image can be acceptable.
- For tall phone screenshots, do not rely on plain markdown image syntax if the screenshots render too large.
- Replace those image lines with centered HTML like:

```html
<p align="center"><img src="JUEJIN_HOSTED_URL" height="520" alt="图片说明" /></p>
```

- Treat fixed `height` as the primary control for phone screenshots. Do not solve this by shrinking the whole article width.
- Keep the `alt` text aligned with the source image label.
- Wrap the image in `<p align="center">` so the screenshot stays visually centered.

### 4. Prefer full-body replacement in the editor

- Juejin's editor uses CodeMirror. When the draft contains duplicate blocks, failed imports, or stale external URLs, replace the entire body at once instead of editing fragments in place.
- A reliable path is to set the full CodeMirror content directly and then verify the editor state.
- After replacement, verify:
  - No stale external image hosts remain.
  - The expected number of `height="520"` tags remain for phone screenshots.
  - The title is still correct.
  - The body ends with the original tail paragraphs.

### 5. Update or publish on Juejin

- For an existing published article, use the original draft/editor page and click `更新`.
- In the update modal, keep the existing classification or tags unless the user asked to change them.
- Confirm and update the same article instead of creating a separate new draft.
- Treat Juejin's `发布成功` page or the existing article page refresh as the success signal.

### 6. Verify the public article page

- Open the published or updated article page after submission.
- Verify the title, opening paragraph, image count, and ending paragraphs.
- For phone screenshots, inspect the final rendered article page instead of trusting only the editor preview.
- Confirm the screenshots are centered and rendered by height at the intended size.
- Scroll through the article so lazy-loaded images actually resolve before concluding verification.

## Repo-specific Paths

- Source guides: `public/newcontent/...`
- Common guide images: `public/manuals/assets/...`
- Sibling publish skills: `release-skill/xiaohongshu-publish/`, `release-skill/csdn-publish/`, `release-skill/bilibili-column-publish/`

## Browser Automation Notes

- Select the correct browser tab before snapshotting or clicking controls.
- Refresh the snapshot before using the Juejin upload button or the update dialog.
- The body editor is CodeMirror and can be inspected with `document.querySelector('.CodeMirror').CodeMirror`.
- Reliable checks include:

```js
const cm = document.querySelector('.CodeMirror').CodeMirror;
cm.getValue();
cm.setValue(fullMarkdown);
```

- Use the editor's own upload flow to obtain Juejin-hosted image URLs before rebuilding the final article body.
- After publish, inspect actual `article img` nodes on the public page and verify rendered height and load completion.

## Common Failure Modes

- External image links fail or disappear.
  Upload through Juejin first and replace the body with Juejin-hosted URLs.
- The draft contains duplicated content from previous attempts.
  Rebuild the full article body from the source markdown and replace the entire CodeMirror value.
- Phone screenshots are still huge.
  Replace markdown image syntax with centered HTML `<img>` tags and control the screenshot by `height`, not article width.
- The screenshots look off-center.
  Wrap them in `<p align="center">` and verify on the final article page.
- Some images appear missing on the article page.
  Scroll through the article and wait for lazy loading before judging the result.
- The editor preview looks correct but the final article differs.
  Use the published article page as the source of truth and inspect the rendered images there.

## Expected End State

- The Juejin article preserves the source guide wording and structure.
- Every guide image is hosted by Juejin, not by an external site.
- Tall phone screenshots are centered and controlled by fixed `height` HTML image tags.
- The draft body is clean rather than polluted by partial upload remnants.
- The final public Juejin article page renders the intended image layout and text order.
