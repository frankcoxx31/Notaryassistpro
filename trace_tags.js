
const fs = require('fs');

const content = fs.readFileSync('src/components/NewSigningModal.tsx', 'utf8');
const lines = content.split('\n');

const stack = [];
const tags = [
  { open: '<div', close: '</div' },
  { open: '<motion.div', close: '</motion.div' },
  { open: '<AnimatePresence', close: '</AnimatePresence' }
];

lines.forEach((line, i) => {
  const lineNum = i + 1;
  
  // Very crude tag parser
  let pos = 0;
  while (pos < line.length) {
    let found = false;
    
    // Check for closing tags first to avoid partial matches
    for (const tag of tags) {
      if (line.slice(pos).startsWith(tag.close)) {
        if (stack.length === 0) {
          console.log(`ERROR: Extra closing tag ${tag.close} at line ${lineNum}`);
        } else {
          const last = stack.pop();
          if (last.tag !== tag.open) {
            console.log(`ERROR: Mismatched closing tag ${tag.close} at line ${lineNum}. Expected closer for ${last.tag} from line ${last.line}`);
          }
        }
        pos += tag.close.length;
        found = true;
        break;
      }
    }
    
    if (found) continue;
    
    // Check for opening tags (ignoring self-closing)
    for (const tag of tags) {
      if (line.slice(pos).startsWith(tag.open)) {
        // Check if self-closing
        const endOfTag = line.indexOf('>', pos);
        if (endOfTag !== -1 && line.slice(endOfTag - 1, endOfTag) === '/') {
          // Self-closing, skip
        } else {
          stack.push({ tag: tag.open, line: lineNum });
        }
        pos += tag.open.length;
        found = true;
        break;
      }
    }
    
    if (!found) pos++;
  }
});

stack.forEach(unclosed => {
  console.log(`ERROR: Unclosed tag ${unclosed.tag} from line ${unclosed.line}`);
});
