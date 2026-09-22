const fs = require('fs');

const filePath = '../frontend/src/pages/admin/AdminPages.jsx';
let src = fs.readFileSync(filePath, 'utf8');

const START = 'Deactivate supermarket ';
const END = '.`)) return;';

const startIdx = src.indexOf(START);
if (startIdx === -1) { console.error('START not found'); process.exit(1); }

const endIdx = src.indexOf(END, startIdx);
if (endIdx === -1) { console.error('END not found'); process.exit(1); }

const oldStr = src.substring(startIdx, endIdx + END.length);
console.log('OLD:', JSON.stringify(oldStr));

// Build replacement keeping the backtick-close pattern
const newStr = 'Permanently remove \u201c' + '${m.name}' + '\u201d? All products and branches will be deleted. This cannot be undone.`)) return;';

// Actually just build it simply
const replacement = src.substring(0, startIdx) +
  'Permanently remove "' + '${m.name}" ? All products, branches and data will be deleted permanently. This cannot be undone.' +
  src.substring(endIdx + END.length - END.length + END.length);

// Simpler: just slice and stitch
const fixed = src.substring(0, startIdx) +
  'Permanently remove "' + '${m.name}"? All products and branches will be permanently deleted. This cannot be undone.' +
  src.substring(endIdx);

fs.writeFileSync(filePath, fixed, 'utf8');
console.log('Patched confirm dialog.');
