const fs = require('fs');
let c = fs.readFileSync('tests/run-tests.js', 'utf8');
const old = "{ name: 'V6-Oversight', script: 'test-v6-oversight.js' },";
const rep = "{ name: 'V6-Oversight', script: 'test-v6-oversight.js' },\n  { name: 'V6-PM', script: 'test-v6-pm.js' },";
c = c.replace(old, rep);
fs.writeFileSync('tests/run-tests.js', c, 'utf8');
console.log('DONE');
