---
name: zhihu-column-publish
description: Publish or update a Zhihu column article from this repo's markdown guides while preserving the original wording, paragraph flow, bold emphasis, and inline image positions. Use when a guide under `public/newcontent/...` must be posted to Zhihu with Zhihu-hosted images, or when a published Zhihu article's tall phone screenshots need to be reduced by patching the server-side draft HTML before re-publishing.
---

# Zhihu Column Publish

## Overview

Use this skill when a repo guide must be published to Zhihu as a column article, not rewritten into a short social post. Keep the original wording, paragraph order, bold emphasis, and image positions. Use Zhihu-hosted images, publish through the article editor, and treat the public article page as the source of truth for image sizing.

## Workflow

### 1. Resolve the source guide

- Read the source markdown from `public/newcontent/...`.
- Extract the title, body, and image references in original order.
- Preserve the original wording and paragraph flow unless the user explicitly asks for rewriting.
- Keep image positions aligned with the source markdown.

### 2. Prepare a Zhihu-compatible article body

- Treat the article title as a separate field from the body.
- Preserve heading order and inline bold emphasis from the source guide.
- Do not collapse paragraphs just to fit Zhihu's editor.
- Prefer a clean rebuild over patching a dirty draft with duplicated blocks or failed imports.
- Treat Zhihu's stored draft body as HTML, not markdown.

### 3. Upload guide images through Zhihu

- Use Zhihu's own article editor and image upload flow so the final article uses Zhihu-hosted image URLs.
- Do not keep external image hotlinks in the final body.
- Upload images in source order so the rebuilt article can preserve the original layout.
- Prefer one-by-one uploads when the draft contains multiple tall screenshots.

### 4. Publish or update through the Zhihu editor

- For a new post, use the article editor and build the article body cleanly.
- For an existing post, open the edit page directly:

```text
https://zhuanlan.zhihu.com/p/<article_id>/edit
```

- Keep the article title unchanged when the user wants the same name as other platforms.
- Click `更新` for existing posts or the normal publish action for new posts.
- Treat the redirect back to the public article page as the publish success signal.

### 5. Fix oversized phone screenshots through the draft API when needed

- Do not trust editor-side image resizing alone when the public Zhihu article still shows oversized phone screenshots.
- Treat the server-side draft HTML as the reliable place to patch image size for published output.
- Read the current draft from:

```text
https://zhuanlan.zhihu.com/api/articles/<article_id>/draft
```

- Patch the returned HTML `content` directly.
- For tall phone screenshots, update each Zhihu `img.content_image` node so it uses:
  - `data-size="small"`
  - a reduced `data-rawwidth`
  - a proportionally reduced `data-rawheight`
- Use `320` width as the repo-tested baseline for tall phone screenshots on Zhihu. Recompute height proportionally from the original width and height.
- After patching the draft HTML, send it back with a `PATCH` to the same draft endpoint.
- Re-open the edit page and click `更新` so Zhihu republishes the patched draft.

### 6. Verify the public article page

- Open the public article page after publish or update:

```text
https://zhuanlan.zhihu.com/p/<article_id>
```

- Verify the title, opening paragraph, image count, and ending paragraphs.
- Scroll so lazy-loaded images actually resolve before deciding the result is correct.
- Inspect the rendered `article img` elements and measure their real size on the public page instead of trusting only editor preview state.
- For resized phone screenshots, confirm the final public page reflects the intended smaller width and `data-size="small"`.

### 7. Sync profile name or avatar from GitHub when requested

- If the user asks to sync Zhihu profile identity, use the current GitHub profile as the source of truth.
- Update the Zhihu display name or avatar before publishing when the user explicitly asks for that sync.
- Verify the profile change on Zhihu's visible account UI before proceeding to article publish.

## Repo-specific Paths

- Source guides: `public/newcontent/...`
- Common guide images: `public/manuals/assets/...`
- Sibling publish skills: `release-skill/xiaohongshu-publish/`, `release-skill/csdn-publish/`, `release-skill/juejin-publish/`, `release-skill/bilibili-column-publish/`

## Browser Automation Notes

- Select the correct Playwright tab before snapshotting or clicking controls.
- Refresh the page snapshot before using upload or update controls.
- Zhihu's article editor is Draft.js-like, but editor entity changes alone are not the source of truth for final screenshot size fixes.
- Prefer patching the server-side draft HTML when a published article still renders giant phone screenshots.
- After a draft API patch, always return to the edit page and click `更新`; patching the draft alone is not the final publish step.
- Verify the public page with real DOM measurements such as `getBoundingClientRect()` on article images.

## Common Failure Modes

- The editor preview shows smaller images, but the public article still renders them at full width.
  Patch the draft HTML `content` directly, set the image `data-size` to `small`, reduce `data-rawwidth` and `data-rawheight`, then re-publish from the edit page.
- Only the first image size changes while the others stay large.
  The editor state change was partial or not persisted. Re-read the draft endpoint and patch every `img.content_image` node in the stored HTML.
- The article uses external image links or broken image placeholders.
  Rebuild the article with Zhihu-hosted uploads instead of external hotlinks.
- The draft looks right in the editor, but the public page is still wrong.
  Use the public article page as the source of truth and inspect actual rendered image sizes there.
- The publish action appears to succeed but the article is unchanged.
  Confirm the edit page was opened for the correct `article_id`, then patch the draft and click `更新` again.
- Placeholder or lazy-load images make verification ambiguous.
  Scroll the article, wait for image load completion, and then measure the rendered images.

## Expected End State

- The Zhihu article preserves the source guide wording and structure.
- Every guide image is hosted by Zhihu rather than by an external site.
- Existing articles can be updated in place through the Zhihu edit page.
- Tall phone screenshots can be reduced reliably by patching the draft HTML and re-publishing.
- The final public Zhihu article page renders the intended text order and image size.
