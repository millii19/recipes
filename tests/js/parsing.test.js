// Unit tests for parsing.js.
// Run: node tests/js/parsing.test.js

const assert = require('assert');
const P = require('../../parsing.js');

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

// ------------------------------------------------------------------ sectionKey
test('sectionKey maps ingredient headings', () => {
  assert.strictEqual(P.sectionKey('Ingredients'), 'ingredients');
  assert.strictEqual(P.sectionKey('ingredients'), 'ingredients');
  assert.strictEqual(P.sectionKey('## Ingredients'), 'ingredients');
});

test('sectionKey maps all step synonyms', () => {
  ['steps', 'Steps', 'Directions', 'Instructions', 'Method', 'Assembly', 'Preparation'].forEach(h => {
    assert.strictEqual(P.sectionKey(h), 'steps', h);
  });
});

test('sectionKey maps notes, based on and info', () => {
  assert.strictEqual(P.sectionKey('Notes'), 'notes');
  assert.strictEqual(P.sectionKey('notes'), 'notes');
  assert.strictEqual(P.sectionKey('Based on'), 'basedon');
  assert.strictEqual(P.sectionKey('source'), 'basedon');
  assert.strictEqual(P.sectionKey('info'), 'info');
});

test('sectionKey returns null for unknown headings', () => {
  assert.strictEqual(P.sectionKey('Random heading'), null);
});

// -------------------------------------------------------------- stripFrontmatter
test('stripFrontmatter removes yaml frontmatter and blank lines', () => {
  const raw = '\uFEFF---\ntags:\n  - x\n---\n\n## Ingredients\n* a\n';
  const body = P.stripFrontmatter(raw);
  assert.ok(body.startsWith('## Ingredients'));
  assert.ok(body.indexOf('tags') === -1);
});

test('stripFrontmatter leaves plain markdown untouched', () => {
  const raw = '## Ingredients\n* a\n';
  assert.strictEqual(P.stripFrontmatter(raw), raw);
});

// ----------------------------------------------------------------- normalizeBody
test('normalizeBody pulls out info bullets and title extras', () => {
  const body = '# Title\nA description\n\n* takes 10 min\n* serves 2\n\n## Ingredients\n* a\n';
  const n = P.normalizeBody(body);
  assert.deepStrictEqual(n.titleExtra, ['A description']);
  assert.ok(n.md.startsWith('## info\n* takes 10 min\n* serves 2'), n.md);
  assert.ok(n.md.indexOf('# Title') === -1);
});

test('normalizeBody maps synonyms and keeps subheadings as h3', () => {
  const body = '# T\n## Directions\n1. one\n### Assembly\n2. two\n## Notes\n* n\n';
  const n = P.normalizeBody(body);
  assert.ok(n.md.indexOf('## Directions') !== -1);
  assert.ok(n.md.indexOf('### Assembly') !== -1);
  assert.ok(n.md.indexOf('## Notes') !== -1);
});

test('normalizeBody drops horizontal rules', () => {
  const body = '# T\n## Steps\n1. a\n-----\n## Notes\n* n\n';
  assert.ok(!/^-{3,}\s*$/m.test(P.normalizeBody(body).md));
});

// --------------------------------------------------------------- convertWikilinks
test('convertWikilinks turns known recipes into links', () => {
  const out = P.convertWikilinks('see [[Beta]] now', ['Beta'], n => 'LINK:' + n);
  assert.strictEqual(out, 'see [Beta](LINK:Beta) now');
});

test('convertWikilinks supports aliases', () => {
  const out = P.convertWikilinks('[[Beta|the base]]', ['Beta'], () => 'L');
  assert.strictEqual(out, '[the base](L)');
});

test('convertWikilinks leaves unknown targets as plain text', () => {
  assert.strictEqual(P.convertWikilinks('use [[Sourdough]] here', [], () => 'L'), 'use Sourdough here');
});

// ------------------------------------------------------------------ parensToSpans
test('parensToSpans wraps parentheses but never tags', () => {
  const out = P.parensToSpans('(a) <span data-x>1</span> (b)');
  assert.strictEqual(out, '<span class="paren">(a)</span> <span data-x>1</span> <span class="paren">(b)</span>');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
