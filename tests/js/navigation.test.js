// Unit tests for navigation.js.
// Run: node tests/js/navigation.test.js

const assert = require('assert');
const { createNavHistory } = require('../../navigation.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  }
  catch (e) {
    failed++;
    console.error('  FAIL: ' + name + '\n        ' + e.message);
  }
}

test('a chain unwinds in order', () => {
  let nav = createNavHistory();
  nav.visit('A');
  nav.visit('B');
  nav.visit('C');
  assert.strictEqual(nav.current(), 'C');
  assert.strictEqual(nav.previous(), 'B');
  assert.strictEqual(nav.back(), 'B');
  assert.strictEqual(nav.previous(), 'A');
  assert.strictEqual(nav.back(), 'A');
  assert.strictEqual(nav.previous(), null);
  assert.strictEqual(nav.back(), null);
});

test('de-dupes so A->B->C->B->A does not loop or grow', () => {
  let nav = createNavHistory();
  ['A', 'B', 'C', 'B', 'A'].forEach(n => nav.visit(n));
  assert.strictEqual(nav.current(), 'A');
  assert.strictEqual(nav.size(), 3);
  assert.strictEqual(nav.previous(), 'B');
  assert.strictEqual(nav.back(), 'B');
  assert.strictEqual(nav.back(), 'C');
  assert.strictEqual(nav.back(), null);
});

test('clicking back and forth stays bounded', () => {
  let nav = createNavHistory();
  ['A', 'B', 'A', 'B', 'A', 'B'].forEach(n => nav.visit(n));
  assert.strictEqual(nav.size(), 2);
  assert.strictEqual(nav.current(), 'B');
  assert.strictEqual(nav.previous(), 'A');
  assert.strictEqual(nav.back(), 'A');
  assert.strictEqual(nav.previous(), null);
});

test('forward steps back through remembered entries', () => {
  let nav = createNavHistory();
  nav.visit('A');
  nav.visit('B');
  nav.visit('C');
  assert.strictEqual(nav.back(), 'B');
  assert.strictEqual(nav.next(), 'C');
  assert.strictEqual(nav.forward(), 'C');
  assert.strictEqual(nav.next(), null);
});

test('a fresh visit drops the forward entries', () => {
  let nav = createNavHistory();
  nav.visit('A');
  nav.visit('B');
  nav.visit('C');
  nav.back();       // at B, C is ahead
  nav.visit('D');   // new navigation
  assert.strictEqual(nav.current(), 'D');
  assert.strictEqual(nav.previous(), 'B');
  assert.strictEqual(nav.size(), 3);
});

test('history is capped, evicting the oldest', () => {
  let nav = createNavHistory({ max: 10 });
  for (let i = 1; i <= 12; i++) nav.visit('R' + i);
  assert.strictEqual(nav.size(), 10);
  assert.strictEqual(nav.current(), 'R12');
  assert.strictEqual(nav.previous(), 'R11');
  let steps = 0;
  while (nav.back()) steps++;
  assert.strictEqual(steps, 9);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
