// parsing.js
// Pure helpers for turning an Obsidian-style recipe into the sections used
// by recipe.php. Kept separate from create-recipe.js so they can be unit
// tested (loaded as a plain script in the browser, or required in Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  }
  else {
    root.RecipeParsing = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // map the many heading names found in obsidian recipes
  // onto the section ids used by the page
  function sectionKey(heading) {
    let h = String(heading).toLowerCase().replace(/[#*:]/g, '').trim().replace(/\s+/g, ' ');
    if (/^ingredient/.test(h)) return 'ingredients';
    if (/^(steps?|directions?|method|instructions?|assembly|preparation)/.test(h)) return 'steps';
    if (/^notes?/.test(h)) return 'notes';
    if (/^(based ?on|basedon|source)/.test(h)) return 'basedon';
    if (/^info/.test(h)) return 'info';
    return null;
  }

  // strip a byte-order mark, yaml frontmatter and leading blank lines
  function stripFrontmatter(raw) {
    let s = String(raw).replace(/^\uFEFF/, '');
    s = s.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');
    return s.replace(/^[\s\uFEFF]+/, '');
  }

  // split off the intro (before the first heading), collect info bullets,
  // and force consistent heading levels (first of a kind = h2, rest = h3)
  function normalizeBody(body) {
    // drop the title (it is rendered separately)
    body = String(body).replace(/^#\s+.+?[ \t]*(?:\r?\n|$)/, '');

    let firstHeading = body.match(/^#{1,6}\s+/m);
    let intro = firstHeading ? body.slice(0, firstHeading.index) : body;
    let rest = firstHeading ? body.slice(firstHeading.index) : '';

    let infoLines = [];
    let titleExtra = [];
    intro.split(/\r?\n/).forEach(function (line) {
      let t = line.trim();
      if (t === '') return;
      if (/^[*-]\s+/.test(t)) {
        infoLines.push(t);
      }
      else {
        titleExtra.push(t);
      }
    });

    let counts = {};
    let out = rest.split(/\r?\n/).filter(function (line) {
      return !/^[-*_]{3,}\s*$/.test(line.trim()); // drop horizontal rules
    }).map(function (line) {
      let m = line.match(/^(#{1,6})\s+(.*?)\s*$/);
      if (!m) return line;
      let key = sectionKey(m[2]);
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
        return (counts[key] === 1 ? '## ' : '### ') + m[2];
      }
      return '### ' + m[2];
    });

    let outMd = out.join('\n');
    if (infoLines.length) {
      outMd = '## info\n' + infoLines.join('\n') + '\n' + outMd;
    }
    return { md: outMd, titleExtra: titleExtra };
  }

  // obsidian [[wikilinks]] -> normal markdown links (only for real recipes)
  function convertWikilinks(text, recipeNames, linkFn) {
    let names = recipeNames || [];
    return String(text).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (whole, target, alias) {
      target = target.trim();
      let label = (alias ? alias : target).trim();
      if (names.indexOf(target) !== -1) {
        return '[' + label + '](' + linkFn(target) + ')';
      }
      return label;
    });
  }

  // wrap text in parentheses without touching existing html tags
  function parensToSpans(html) {
    return String(html).replace(/(<[^>]+>)|(\([^)]+\))/g, function (whole, tag, paren) {
      if (tag) return tag;
      return '<span class="paren">' + paren + '</span>';
    });
  }

  return {
    sectionKey: sectionKey,
    stripFrontmatter: stripFrontmatter,
    normalizeBody: normalizeBody,
    convertWikilinks: convertWikilinks,
    parensToSpans: parensToSpans
  };
});
