// Unit tests for scaling.js.
// Run: node tests/js/scaling.test.js

const assert = require('assert');
const S = require('../../scaling.js');

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
function eq(got, expected, msg) {
  assert.strictEqual(got, expected, msg || ('got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(expected)));
}

test('multiplies a simple integer amount', () => {
  eq(S.scaleIngredient('280g wheat flour', 2), '560g wheat flour');
});

test('leaves the amount alone when the factor is 1', () => {
  eq(S.scaleIngredient('280g wheat flour', 1), '280g wheat flour');
});

test('scales fractions', () => {
  eq(S.scaleIngredient('1/2 cup milk', 2), '1 cup milk');
  eq(S.scaleIngredient('1/2 cup milk', 0.5), '1/4 cup milk');
});

test('turns fractional results into mixed numbers', () => {
  eq(S.scaleIngredient('1 cup milk', 1.5), '1 1/2 cup milk');
});

test('scales decimals', () => {
  eq(S.scaleIngredient('1.5 cups water', 2), '3 cups water');
});

test('scales ranges', () => {
  eq(S.scaleIngredient('1-2 tbsp oil', 2), '2-4 tbsp oil');
  eq(S.scaleIngredient('70g-150g olives', 2), '140g-300g olives');
  eq(S.scaleIngredient('100–150 g sugar', 2), '200–300 g sugar');
});

test('scales amounts inside a qty span', () => {
  eq(S.scaleIngredient('<span data-qty-parse>2</span> cans beans', 3), '<span data-qty-parse>6</span> cans beans');
});

test('keeps the approximate marker', () => {
  eq(S.scaleIngredient('~100g sourdough starter', 0.5), '~50g sourdough starter');
});

test('scales an integer amount to a fraction when needed', () => {
  eq(S.scaleIngredient('3 Eggs', 0.5), '1 1/2 Eggs');
});

test('scales unicode fractions', () => {
  eq(S.scaleIngredient('½ tsp chili powder', 2), '1 tsp chili powder');
  eq(S.scaleIngredient('½ tsp chili powder', 0.5), '¼ tsp chili powder');
  eq(S.scaleIngredient('⅓ cup sugar', 3), '1 cup sugar');
});

test('does not touch lines without a leading amount', () => {
  eq(S.scaleIngredient('Some olive oil', 2), 'Some olive oil');
  eq(S.scaleIngredient('salt and pepper to taste', 2), 'salt and pepper to taste');
});

test('preserves trailing text and html', () => {
  eq(S.scaleIngredient('2 eggs (large)', 2), '4 eggs (large)');
  eq(S.scaleIngredient('1 <span class="paren">(finely chopped)</span> onion', 3), '3 <span class="paren">(finely chopped)</span> onion');
});

test('hasLeadingAmount detects amounts (incl. unicode + spans)', () => {
  eq(S.hasLeadingAmount('280g flour'), true);
  eq(S.hasLeadingAmount('½ tsp salt'), true);
  eq(S.hasLeadingAmount('<span data-qty-parse>2</span> cans'), true);
  eq(S.hasLeadingAmount('Some olive oil'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
