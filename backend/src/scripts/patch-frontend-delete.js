const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../frontend/src/pages/admin/AdminPages.jsx');
let src = fs.readFileSync(filePath, 'utf8');

// Fix confirmation dialog
src = src.replace(
  'Deactivate supermarket "${m.name}"? Products and branches will be deactivated.',
  'Permanently remove "${m.name}"? This deletes all its products and branches and cannot be undone.'
);

// Fix toast fallback message
src = src.replace(
  "'Supermarket deactivated'",
  "'Supermarket permanently removed'"
);

// Fix button tooltip
src = src.replace(
  'title="Deactivate" className="ss-icon-btn ss-icon-danger"',
  'title="Remove permanently" className="ss-icon-btn ss-icon-danger"'
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('Frontend AdminPages.jsx patched.');
