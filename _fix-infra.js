const fs = require('fs');

// Fix test-structure.js
let ts = fs.readFileSync('tests/test-structure.js', 'utf8');
ts = ts.replace("test('26 command files exist'", "test('28 command files exist'");
ts = ts.replace('files.length === 26', 'files.length === 28');
ts = ts.replace('Expected 26 commands', 'Expected 28 commands');
ts = ts.replace("test('7 hook files exist'", "test('9 hook files exist'");
ts = ts.replace('files.length === 7', 'files.length === 9');
ts = ts.replace('Expected 7 hooks', 'Expected 9 hooks');
fs.writeFileSync('tests/test-structure.js', ts, 'utf8');
console.log('DONE: test-structure.js');

// Fix test-commands.js
let tc = fs.readFileSync('tests/test-commands.js', 'utf8');
tc = tc.replace("'oversight', 'settings', 'learn',", "'oversight', 'settings', 'learn', 'pm', 'progress',");
fs.writeFileSync('tests/test-commands.js', tc, 'utf8');
console.log('DONE: test-commands.js');
