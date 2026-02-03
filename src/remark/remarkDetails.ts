import type { Root, Html, Code } from 'mdast';

export default function remarkDetails() {
  return (tree: Root) => {
    const children = tree.children;
    const newChildren: Array<Html | typeof children[number]> = [];
    let i = 0;

    while (i < children.length) {
      const node = children[i];
      
      // Check if this is a paragraph containing [details="..."]
      if (node.type === 'paragraph' && node.children.length > 0) {
        const firstChild = node.children[0];
        
        if (firstChild.type === 'text') {
          const text = firstChild.value;
          const detailsMatch = text.match(/^\[details="([^"]+)"\]\s*$/);
          
          if (detailsMatch) {
            const title = detailsMatch[1];
            const contentNodes: Array<Root['children'][number]> = [];
            let j = i + 1;
            
            // Find closing [/details]
            let foundClosing = false;
            while (j < children.length) {
              const nextNode = children[j];
              
              if (nextNode.type === 'paragraph' && nextNode.children.length > 0) {
                const nextFirstChild = nextNode.children[0];
                
                if (nextFirstChild.type === 'text') {
                  const nextText = nextFirstChild.value;
                  const closingMatch = nextText.match(/^\[\/details\]\s*$/);
                  
                  if (closingMatch) {
                    foundClosing = true;
                    break;
                  }
                }
              }
              
              contentNodes.push(nextNode);
              j++;
            }
            
            if (foundClosing) {
              // Convert content nodes to HTML
              const contentHtml = contentNodes.map(n => {
                if (n.type === 'code') {
                  const codeNode = n as Code;
                  return `<pre><code>${escapeHtml(codeNode.value)}</code></pre>`;
                }
                // For other node types, convert to HTML using a simple approach
                return `<div class="details-content">${nodeToHtml(n)}</div>`;
              }).join('');
              
              // Create details HTML node
              const detailsNode: Html = {
                type: 'html',
                value: `<details class="markdown-details"><summary class="markdown-details-summary">${escapeHtml(title)}</summary><div class="markdown-details-content">${contentHtml}</div></details>`
              };
              
              newChildren.push(detailsNode);
              i = j + 1; // Skip past closing [/details]
              continue;
            }
          }
        }
      }
      
      newChildren.push(node);
      i++;
    }
    
    tree.children = newChildren;
  };
}

// Helper function to escape HTML special characters
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper function to convert mdast node to HTML string
function nodeToHtml(node: Root['children'][number]): string {
  if (node.type === 'paragraph') {
    const text = node.children.map(child => {
      if (child.type === 'text') {
        return escapeHtml(child.value);
      }
      return '';
    }).join('');
    return `<p>${text}</p>`;
  }
  if (node.type === 'code') {
    return `<pre><code>${escapeHtml(node.value)}</code></pre>`;
  }
  // For other types, return a placeholder
  return `<div class="unknown-node">...</div>`;
}
