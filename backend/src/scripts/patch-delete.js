const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/controllers/supermarketController.js');
let src = fs.readFileSync(filePath, 'utf8');

// Replace soft-delete block with hard-delete
const oldLines = [
  "    // Soft-delete store + deactivate products/branches to keep history",
  "    await supabase.from('supermarkets').update({ status: 'INACTIVE' }).eq('id', id);",
  "    await supabase.from('branches').update({ status: 'INACTIVE' }).eq('supermarket_id', id);",
  "    await supabase.from('products').update({ status: 'INACTIVE' }).eq('supermarket_id', id);",
];

const newLines = [
  "    // Hard-delete: remove products, branches, then the supermarket",
  "    await supabase.from('products').delete().eq('supermarket_id', id);",
  "    await supabase.from('branches').delete().eq('supermarket_id', id);",
  "    // Clear manager binding before deleting the store",
  "    await supabase",
  "      .from('users')",
  "      .update({ supermarket_id: null, branch_id: null })",
  "      .eq('supermarket_id', id);",
  "    await supabase.from('supermarkets').delete().eq('id', id);",
];

// Try CRLF first, then LF
let oldBlock = oldLines.join('\r\n');
let newBlock = newLines.join('\r\n');

if (src.includes(oldBlock)) {
  src = src.replace(oldBlock, newBlock);
  console.log('Replaced CRLF block OK');
} else {
  oldBlock = oldLines.join('\n');
  newBlock = newLines.join('\n');
  if (src.includes(oldBlock)) {
    src = src.replace(oldBlock, newBlock);
    console.log('Replaced LF block OK');
  } else {
    console.error('Could not find soft-delete block!');
    process.exit(1);
  }
}

// Fix audit mode
src = src.replace(
  "details: { name: market.name, mode: 'soft' }",
  "details: { name: market.name, mode: 'hard' }"
);

// Fix success message
src = src.replace(
  'Managers can no longer operate it.',
  'has been permanently removed.'
);
src = src.replace(
  'deactivated. Managers',
  'has been permanently removed.'
);

// Catch-all for the full message string
src = src.replace(
  /`Supermarket "\$\{market\.name\}" deactivated\. Managers can no longer operate it\.`/,
  '`Supermarket "${market.name}" has been permanently removed.`'
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('patch-delete.js done.');
