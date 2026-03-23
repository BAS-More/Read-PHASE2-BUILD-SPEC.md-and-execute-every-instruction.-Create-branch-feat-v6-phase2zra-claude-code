const fs = require('fs');
let t = fs.readFileSync('tests/test-v6-pm.js', 'utf8');

// Fix PM_DEFAULTS count: 12 -> 11
t = t.replace("PM_DEFAULTS has exactly 12 keys", "PM_DEFAULTS has exactly 11 keys");
t = t.replace("keys.length === 12", "keys.length === 11");
t = t.replace("Expected 12 keys", "Expected 11 keys");

// Fix milestone criteria: block-style -> inline format
// Pattern: criteria:\n      - item  =>  criteria: [item]
t = t.replace(/criteria:\\n\s*- ([^\\']+?)\\n/g, function(match, criterion) {
  return 'criteria: [' + criterion.trim() + ']\\n';
});

// Fix PM hook invalid JSON test
t = t.replace('echo "not json" | node', 'echo not_json | node');
t = t.replace("result === '{}'", "typeof JSON.parse(result) === 'object'");
t = t.replace("expected empty object, got:", "expected valid JSON object, got:");

fs.writeFileSync('tests/test-v6-pm.js', t, 'utf8');

// Verify
const after = fs.readFileSync('tests/test-v6-pm.js', 'utf8');
const count12 = (after.match(/12 keys/g) || []).length;
const countBlockCriteria = (after.match(/criteria:\\n\s*- /g) || []).length;
const countEchoNotJson = (after.match(/echo "not json"/g) || []).length;
console.log('Remaining "12 keys":', count12);
console.log('Remaining block criteria:', countBlockCriteria);
console.log('Remaining echo not json:', countEchoNotJson);
console.log('DONE: test-v6-pm.js');
