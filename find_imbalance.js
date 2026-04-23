const fs = require('fs');
const content = fs.readFileSync('src/components/NewSigningModal.tsx', 'utf8');

const tags = [];
const regex = /<(\/)?(div|motion\.div|AnimatePresence)(?:\s|>|\/)/g;
let match;

while ((match = regex.exec(content)) !== null) {
  const isClosing = !!match[1];
  const tagName = match[2];
  const line = content.substring(0, match.index).split('\n').length;

  if (isClosing) {
    if (tags.length === 0) {
      console.log(`Extra closing tag </${tagName}> at line ${line}`);
    } else {
      const last = tags.pop();
      if (last.tagName !== tagName) {
        console.log(`Mismatched closing tag </${tagName}> at line ${line}. Expected </${last.tagName}> (opened at line ${last.line})`);
      }
    }
  } else {
    // Check if it's self-closing (approximate)
    const after = content.substring(match.index, match.index + 100);
    const isSelfClosing = after.split('>')[0].endsWith('/');
    if (!isSelfClosing) {
      tags.push({ tagName, line });
    }
  }
}

tags.forEach(tag => {
  console.log(`Unclosed tag <${tag.tagName}> opened at line ${tag.line}`);
});
