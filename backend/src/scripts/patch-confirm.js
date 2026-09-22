const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../frontend/src/pages/admin/AdminPages.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Find and replace the confirm line
const idx = src.indexOf('Deactivate supermarket "');
if (idx === -1) { console.error('Not found!'); process.exit(1); }

// Replace the whole confirm string content
src = src.replace(
  'Deactivate supermarket "${m.name}"? Products and branches will be deactivated.',
  'Permanently remove "${m.name}"? All products and branches will be deleted. This cannot be undone.'
);

const idx2 = src.indexOf('title="Deactivate"');
if (idx2 !== -1) {
  src = src.replace('title="Deactivate"', 'title="Remove permanently"');
}

fs.writeFileSync(filePath, src, 'utf8');
console.log('Done. Confirm text at index', src.indexOf('Permanently remove'));
