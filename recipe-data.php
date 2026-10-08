<?php
// recipe-data.php
// Scans recipes/*.md once and builds:
//   $files      - list of recipe filenames (basenames)
//   $recipeData - metadata per recipe (title, tags, thumbnail, snippet, ...)
//   $linkGraph  - forward/back link relationships between recipes
// Included by index.php and recipe.php.

if (!function_exists('recipes_scan')) {

	// minimal YAML frontmatter parser (scalars + simple lists only)
	function recipes_parse_frontmatter($raw) {
		$data = array();
		$current = null;
		foreach (preg_split('/\r?\n/', $raw) as $line) {
			if (preg_match('/^([A-Za-z0-9_]+):\s*(.*)$/', $line, $m)) {
				$current = $m[1];
				$val = trim($m[2]);
				$data[$current] = ($val === '') ? array() : recipes_unquote($val);
			}
			else if ($current !== null && preg_match('/^\s*-\s*(.*)$/', $line, $m)) {
				if (!is_array($data[$current])) {
					$data[$current] = array();
				}
				$data[$current][] = recipes_unquote(trim($m[1]));
			}
		}
		return $data;
	}

	function recipes_unquote($s) {
		$s = trim($s);
		if (strlen($s) >= 2) {
			$first = $s[0];
			$last  = substr($s, -1);
			if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
				return substr($s, 1, -1);
			}
		}
		return $s;
	}

	// flatten markdown/html to plain text for previews
	function recipes_clean_text($s) {
		$s = preg_replace('/<[^>]*>/', '', $s);                 // html tags
		$s = preg_replace('/!\[[^\]]*\]\([^)]*\)/', '', $s);    // images
		$s = preg_replace('/\[([^\]]*)\]\([^)]*\)/', '$1', $s); // links -> text
		$s = preg_replace('/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/', '$1', $s); // wikilinks
		$s = str_replace(array('**', '__', '`', '*', '_'), '', $s);
		return trim(preg_replace('/\s+/', ' ', $s));
	}

	function recipes_scan($root) {
		$paths   = glob($root . '/recipes/*.md');
		$files   = array();
		$recipes = array();
		$forward = array();

		foreach ($paths as $path) {
			$key    = basename($path, '.md');
			$files[] = basename($path);

			$raw = file_get_contents($path);
			$raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw); // strip BOM
			$raw = ltrim($raw, "\r\n");

			// split optional YAML frontmatter from the body
			$front = array();
			$body  = $raw;
			if (preg_match('/^---\s*\r?\n(.*?)\r?\n---\s*\r?\n?/s', $raw, $m)) {
				$front = recipes_parse_frontmatter($m[1]);
				$body  = substr($raw, strlen($m[0]));
			}

			// title: first H1 (link syntax flattened), else filename
			$title = $key;
			if (preg_match('/^#\s+(.+?)\s*$/m', $body, $tm)) {
				$title = recipes_clean_text($tm[1]);
				$body  = preg_replace('/^#\s+.+?\s*$/m', '', $body, 1);
			}

			// category from type: "[[Sourdough]]"
			$category = '';
			if (isset($front['type']) && is_string($front['type'])) {
				if (preg_match('/\[\[([^\]|]+)/', $front['type'], $cm)) {
					$category = $cm[1];
				}
				else {
					$category = $front['type'];
				}
			}

			// tags
			$tags = array();
			if (isset($front['tags'])) {
				$tags = is_array($front['tags']) ? $front['tags'] : array($front['tags']);
			}

			// thumbnail: local images/<key>.jpg, else first markdown image
			$thumbnail = null;
			$local     = $root . '/images/' . $key . '.jpg';
			if (is_file($local)) {
				$thumbnail = 'images/' . rawurlencode($key) . '.jpg';
			}
			else if (preg_match('/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/', $body, $im)) {
				$thumbnail = trim($im[1]);
			}

			// snippet: description paragraph after the title, else first ingredient
			$intro = $body;
			if (preg_match('/^#{1,6}\s+/m', $body, $hm, PREG_OFFSET_CAPTURE)) {
				$intro = substr($body, 0, $hm[0][1]);
			}
			$snippet = '';
			foreach (preg_split('/\r?\n/', $intro) as $line) {
				$t = trim($line);
				if ($t === '' || $t[0] === '#' || $t[0] === '!' || $t[0] === '|') {
					continue;
				}
				if (preg_match('/^[*-]\s+/', $t)) {
					continue; // prefer a paragraph over a bullet
				}
				$snippet = recipes_clean_text($t);
				break;
			}
			if ($snippet === '') {
				foreach (preg_split('/\r?\n/', $intro) as $line) {
					if (preg_match('/^[*-]\s+(.+)$/', trim($line), $lm)) {
						$snippet = recipes_clean_text($lm[1]);
						break;
					}
				}
			}
			if ($snippet === '') {
				foreach (preg_split('/\r?\n/', $body) as $line) {
					if (preg_match('/^[*-]\s+(.+)$/', trim($line), $lm)) {
						$snippet = recipes_clean_text($lm[1]);
						break;
					}
				}
			}
			$len = function_exists('mb_strlen') ? mb_strlen($snippet) : strlen($snippet);
			if ($len > 140) {
				$cut     = function_exists('mb_substr') ? mb_substr($snippet, 0, 137) : substr($snippet, 0, 137);
				$snippet = $cut . '...';
			}

			// wikilinks found in the body (frontmatter excluded)
			$links = array();
			if (preg_match_all('/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/', $body, $lm)) {
				foreach ($lm[1] as $target) {
					$target = trim($target);
					if ($target !== '') {
						$links[] = $target;
					}
				}
			}

			$recipes[$key] = array(
				'title'     => $title,
				'file'      => basename($path),
				'tags'      => array_values($tags),
				'category'  => $category,
				'url'       => (isset($front['url']) && is_string($front['url'])) ? $front['url'] : '',
				'url2'      => (isset($front['url2']) && is_string($front['url2'])) ? $front['url2'] : '',
				'thumbnail' => $thumbnail,
				'snippet'   => $snippet,
			);
			$forward[$key] = array_values(array_unique($links));
		}

		// resolve forward links to existing recipes, then derive backlinks
		$graph = array();
		foreach ($recipes as $key => $r) {
			$fwd = array();
			foreach ($forward[$key] as $target) {
				if (isset($recipes[$target])) {
					$fwd[] = $target;
				}
			}
			$graph[$key] = array('forward' => array_values(array_unique($fwd)), 'backlinks' => array());
		}
		foreach ($graph as $key => $g) {
			foreach ($g['forward'] as $target) {
				if ($target !== $key) {
					$graph[$target]['backlinks'][] = $key;
				}
			}
		}
		foreach ($graph as $key => $g) {
			$graph[$key]['backlinks'] = array_values(array_unique($g['backlinks']));
		}

		natcasesort($files);

		return array(
			'files'   => array_values($files),
			'recipes' => $recipes,
			'graph'   => $graph,
		);
	}

	$__recipe_scan = recipes_scan(__DIR__);
	$files         = $__recipe_scan['files'];
	$recipeData    = $__recipe_scan['recipes'];
	$linkGraph     = $__recipe_scan['graph'];
}
