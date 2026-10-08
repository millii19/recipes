<?php
// Unit tests for recipe-data.php.
// Run: php tests/php/test-recipe-data.php

require __DIR__ . '/../../recipe-data.php';

$tests  = 0;
$failed = 0;

function check($cond, $msg) {
	global $tests, $failed;
	$tests++;
	if (!$cond) {
		$failed++;
		echo "  FAIL: $msg\n";
	}
}

function same($got, $expected, $msg) {
	global $tests, $failed;
	$tests++;
	if ($got !== $expected) {
		$failed++;
		echo "  FAIL: $msg\n";
		echo "        expected: " . var_export($expected, true) . "\n";
		echo "        got:      " . var_export($got, true) . "\n";
	}
}

// ---------------------------------------------------------------- fixtures
$tmp = sys_get_temp_dir() . '/recipes-test-' . uniqid();
mkdir($tmp . '/recipes', 0777, true);
mkdir($tmp . '/images', 0777, true);

file_put_contents($tmp . '/recipes/Alpha.md', <<<'MD'
---
tags:
  - bread
  - sourdough
type: "[[Baking]]"
url: https://example.com/alpha
url2: https://example.com/alpha2
---
# [Alpha Bread](https://example.com/alpha)

A tasty loaf.

![hero](https://example.com/alpha.jpg)

## Ingredients
* 1 portion of [[Beta]]
* 2 cups flour

## Steps
1. Mix

## Notes
* good
MD);

file_put_contents($tmp . '/recipes/Beta.md', "## ingredients\n* flour\n");

file_put_contents($tmp . '/recipes/Gamma.md', <<<'MD'
---
tags:
  - misc
type: "[[Sourdough]]"
---
## Ingredients
* 1 cup [[Missing Recipe|the missing one]]
* 2 tbsp [[Beta|the base]]

## Directions
1. stir
MD);

file_put_contents($tmp . '/images/Gamma.jpg', 'not really an image');

$scan    = recipes_scan($tmp);
$recipes = $scan['recipes'];
$graph   = $scan['graph'];

// ---------------------------------------------------------------- scanning
same(count($scan['files']), 3, 'finds all recipe files');

// ---------------------------------------------------------------- metadata
same($recipes['Alpha']['title'], 'Alpha Bread', 'h1 markdown link is flattened into the title');
same($recipes['Alpha']['category'], 'Baking', 'category parsed from type wikilink');
same($recipes['Alpha']['tags'], array('bread', 'sourdough'), 'frontmatter tag list parsed');
same($recipes['Alpha']['url'], 'https://example.com/alpha', 'frontmatter url parsed');
same($recipes['Alpha']['url2'], 'https://example.com/alpha2', 'frontmatter url2 parsed');
same($recipes['Alpha']['thumbnail'], 'https://example.com/alpha.jpg', 'first markdown image used as thumbnail');
same($recipes['Alpha']['snippet'], 'A tasty loaf.', 'snippet taken from the description paragraph');

same($recipes['Beta']['title'], 'Beta', 'title falls back to filename when there is no h1');
same($recipes['Beta']['snippet'], 'flour', 'snippet falls back to the first ingredient');
same($recipes['Beta']['tags'], array(), 'no tags without frontmatter');

same($recipes['Gamma']['thumbnail'], 'images/Gamma.jpg', 'local image preferred over a remote one');

// ---------------------------------------------------------------- links
same($graph['Alpha']['forward'], array('Beta'), 'forward link resolves to an existing recipe');
same($graph['Beta']['backlinks'], array('Alpha', 'Gamma'), 'backlinks collected from linking recipes');
same($graph['Gamma']['forward'], array('Beta'), 'generic missing recipe is dropped; alias target kept');
check(!in_array('Sourdough', $graph['Gamma']['forward'], true), 'category link [[Sourdough]] is not treated as a recipe');
check(!in_array('Missing Recipe', $graph['Gamma']['forward'], true), 'link to a non-existent recipe is ignored');

// ---------------------------------------------------------------- the real example
$real = recipes_scan(__DIR__ . '/../..');
check(isset($real['recipes']['One-Pot Chicken Biryani']), 'the example recipe is scanned');
check($real['recipes']['One-Pot Chicken Biryani']['title'] !== '', 'the example recipe has a title');

// ---------------------------------------------------------------- cleanup
foreach (glob($tmp . '/recipes/*.md') as $f) { unlink($f); }
foreach (glob($tmp . '/images/*') as $f) { unlink($f); }
rmdir($tmp . '/recipes');
rmdir($tmp . '/images');
rmdir($tmp);

echo "\n{$tests} checks, {$failed} failed\n";
exit($failed ? 1 : 0);
