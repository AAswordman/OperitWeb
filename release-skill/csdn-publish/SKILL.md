---
name: csdn-publish
description: Publish or update a CSDN article from this repo's markdown guides while preserving the original markdown structure. Use when a guide under `public/newcontent/...` must be posted to CSDN with the original headings, bold markers, paragraph flow, and inline image positions, and the guide images need to be uploaded to CSDN one by one before rebuilding the final markdown.
---

# CSDN Publish

## Overview

Use this skill when a repo guide must be published to CSDN as a markdown article, not rewritten as a long-image note. Keep the original markdown wording and structure. Upload guide images to CSDN first, replace the local image paths with CSDN image URLs, apply CSDN-native image sizing syntax when needed, then publish through browser automation.

## Workflow

### 1. Resolve the source guide

- Read the source markdown from `public/newcontent/...`.
- Extract the title, body, and image references in original order.
- Do not compress, rewrite, or reorder the original content when the requirement is markdown fidelity.

### 2. Upload images to CSDN first

- Do not rely on external GitHub raw image URLs inside the final article. CSDN often converts them into `外链图片转存失败...` placeholders.
- Preferred path: upload each image one by one through CSDN's own upload flow or its in-page upload API.
- The markdown editor uses CSDN upload with `appName: direct_blog_markdown`.
- A working in-page call is:

```js
await window.csdn.upload.uploadImg({
  appName: 'direct_blog_markdown',
  file,
  imageTemplate: ''
})
```

- The response contains the final image URL under `result[0].data.data.imageUrl`.
- Add `#pic_center` to the final markdown image URL to match CSDN's inserted markdown style.
- Keep the uploaded image URLs in the same order as the source markdown image references.

### 3. Rebuild a clean import markdown

- Create a temp markdown file under `temp/csdn_post/`.
- Start from the original markdown body.
- Replace only the image paths with the uploaded CSDN URLs.
- Preserve headings, bold markers, paragraph spacing, and image positions.
- Avoid hand-editing a dirty browser draft line by line when the editor already contains failed imports or extra upload remnants.
- If the article uses tall phone screenshots, do not rely on raw HTML like `<img style="height: 360px">` or `width` attributes for the final post. CSDN's article page strips those image sizing attributes from the rendered body.
- Use CSDN's supported markdown sizing syntax instead, for example:

```md
![用户协议及隐私政策](https://i-blog.csdnimg.cn/direct/xxx.jpeg#pic_center =180x)
```

- Treat `=180x` as a repo-tested baseline for tall phone screenshots in this guide family. Adjust the width number if the user explicitly wants larger or smaller screenshots.
- Keep `#pic_center` before the size suffix so the image stays centered and CSDN still emits a concrete `width` attribute on the published article page.

### 4. Choose the safe update path

- Use the markdown editor, not the rich-text editor.
- For a brand-new draft, importing the rebuilt file through `#import-markdown-file-input` is acceptable.
- For an already published article that must keep the same `articleId`, do not use import. CSDN may create a new draft/article instead of updating the original post in place.
- For in-place updates, open the original article's markdown editor URL and replace the markdown content directly in the existing editor, then publish that same article.
- After import or in-place replacement, set the final article title explicitly. Do not rely on the imported filename.
- Verify the editor content still ends with the original tail paragraphs and that the image count matches the source markdown.

### 5. Publish on CSDN

- Open the publish dialog from the markdown editor.
- Reuse an existing relevant tag if one is already present; otherwise add one.
- Leave optional fields alone unless the user asked for a cover, summary, column, or visibility change.
- Publish and verify that CSDN redirects to the success page.
- Treat the success page and the final article URL as the publish success signal.
- After publishing, verify image sizing on the final article page, not only in the editor preview. The article page is the source of truth.
- For screenshot-heavy guides, inspect the published `article img` elements and confirm CSDN emitted the expected `width` attribute or equivalent computed width.

## Repo-specific Paths

- Source guides: `public/newcontent/...`
- Common guide images: `public/manuals/assets/...`
- Temporary rebuilt markdown files: `temp/csdn_post/`
- Existing sibling skill: `release-skill/xiaohongshu-publish/`

## Browser Automation Notes

- Prefer the CSDN markdown editor URL pattern `https://editor.csdn.net/md?...`.
- Refresh the browser snapshot before clicking publish controls.
- If the file chooser path is flaky, using the verified in-page upload API is acceptable.
- Importing a rebuilt markdown file is safer than cleaning a partially broken new draft.
- For updates to an existing published article, keyboard-based full-content replacement in the current markdown editor is safer than import because it preserves the original article identity.

## Common Failure Modes

- External image links get replaced with `外链图片转存失败`.
  Upload images to CSDN first and rebuild the markdown with CSDN-hosted URLs.
- The published article still shows phone screenshots at full width even though the editor preview looked smaller.
  CSDN stripped the HTML sizing attributes. Replace those image lines with CSDN-native markdown sizing like `![alt](url#pic_center =180x)` and verify the final article page again.
- The draft contains extra `![在这里插入图片描述]` lines at the top.
  Rebuild a clean temp markdown file and import it again.
- The imported title becomes the temp filename.
  Overwrite the title field after import.
- Upload code returns a generic system error.
  Use CSDN's markdown upload configuration with `appName: direct_blog_markdown` instead of a generic app name.
- Importing into an existing published article opens a different article id or a new draft.
  Stop using import for that update. Re-open the original `articleId` in the markdown editor and replace the content in place.
- The publish dialog appears but the article is unchanged.
  Verify the browser actually reached CSDN's success page and capture the article URL.

## Expected End State

- The CSDN article preserves the source markdown structure.
- Every guide image uses a CSDN-hosted direct image URL.
- Tall phone screenshots use CSDN-native sizing syntax rather than HTML inline styles.
- The published article page renders the intended image width instead of falling back to full-width screenshots.
- The final draft is imported from a clean temp markdown file, or updated in place when preserving an existing article id matters.
- The article is published and has a stable CSDN article URL.
