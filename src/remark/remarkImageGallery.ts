import type { Root, Paragraph, Image, PhrasingContent, Html } from 'mdast';
import { visit } from 'unist-util-visit';

// Helper to check if a node is an insignificant text node (whitespace/newline)
const isWhitespaceText = (node: PhrasingContent): boolean => {
  return node.type === 'text' && node.value.trim() === '';
};

// Helper to check if a node is an Image node
const isImage = (node: PhrasingContent): node is Image => {
  return node.type === 'image';
};

export default function remarkImageGallery() {
  return (tree: Root) => {
    // Visit every paragraph node in the tree
    visit(tree, 'paragraph', (node: Paragraph) => {
      // We are going to rebuild the children of this paragraph
      const newChildren: PhrasingContent[] = [];
      let i = 0;

      while (i < node.children.length) {
        const currentNode = node.children[i];

        // Find the start of a potential gallery (an image node)
        if (isImage(currentNode)) {
          const galleryGroup: Image[] = [currentNode];
          let j = i + 1;

          // Look ahead for more images, allowing for whitespace nodes between them
          while (j < node.children.length) {
            const nextNode = node.children[j];
            
            if (isWhitespaceText(nextNode)) {
              j++;
              continue;
            }

            if (isImage(nextNode)) {
              galleryGroup.push(nextNode);
              j++;
            } else {
              // The sequence of images is broken by a non-image, non-whitespace node
              break;
            }
          }

          // If we found more than one image, create a gallery div
          if (galleryGroup.length > 1) {
            const galleryNode: Html = {
              type: 'html',
              value: `<div class="image-gallery">${galleryGroup
                .map(
                  img =>
                    `<div class="image-container"><img src="${img.url}" alt="${
                      img.alt || ''
                    }" title="${img.title || ''}" loading="lazy"></div>`,
                )
                .join('')}</div>`,
            };
            newChildren.push(galleryNode);
            // Move the main index past this entire processed group
            i = j;
          } else {
            // It was a solitary image, not a gallery, so just add it back
            newChildren.push(currentNode);
            i++;
          }
        } else {
          // This node is not an image, so just add it and move to the next one
          newChildren.push(currentNode);
          i++;
        }
      }

      // Replace the paragraph's old children with our new, rebuilt list
      node.children = newChildren;
    });
  };
} 