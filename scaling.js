// scaling.js
// Multiplies the leading quantity of an ingredient line (ex: "280g flour",
// "1/2 cup milk", "1-2 tbsp oil") without touching anything else. Kept
// separate from create-recipe.js so it can be unit tested.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  }
  else {
    root.RecipeScaling = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // a single amount: "2", "1/2", "1.5", "100", "½", optionally prefixed with "~"
  let UNICODE_FRACTIONS = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
    '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };
  let UNICODE_CHARS = Object.keys(UNICODE_FRACTIONS).join('');
  let ASCII_NUM = '\\d+(?:[.,]\\d+)?(?:\\s*[\\/⁄]\\s*\\d+)?';
  let NUM = '~?(?:' + ASCII_NUM + '|[' + UNICODE_CHARS + '])';
  let UNIT = '[A-Za-zµ%°]+';

  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }

  function parseNumber(token) {
    let tilde = /^~/.test(token);
    let s = token.replace(/^~/, '').trim();
    let comma = s.indexOf(',') !== -1;
    if (UNICODE_FRACTIONS[s]) {
      let parts = UNICODE_FRACTIONS[s].split('/');
      return { value: parseInt(parts[0], 10) / parseInt(parts[1], 10), style: 'frac', tilde: tilde, comma: false, unicode: true };
    }
    if (/[\/⁄]/.test(s)) {
      let parts = s.split(/[\/⁄]/);
      let n = parseFloat(parts[0].replace(',', '.'));
      let d = parseFloat(parts[1].replace(',', '.'));
      return { value: n / d, style: 'frac', tilde: tilde, comma: comma };
    }
    let decimal = /[.,]/.test(s);
    return { value: parseFloat(s.replace(',', '.')), style: decimal ? 'dec' : 'int', tilde: tilde, comma: comma };
  }

  function isInt(x) {
    return Math.abs(x - Math.round(x)) < 1e-6;
  }

  function trimZeros(s) {
    return s.replace(/\.?0+$/, '');
  }

  // 1.5 -> "1 1/2", 0.25 -> "1/4" (null when there is no tidy fraction)
  function toMixedFraction(x, maxDen) {
    maxDen = maxDen || 8;
    if (!isFinite(x) || x <= 0) return null;
    let whole = Math.floor(x);
    let frac = x - whole;
    if (frac < 1e-6) return String(whole);

    let best = null;
    let bestErr = 1e-3;
    for (let d = 2; d <= maxDen; d++) {
      let n = Math.round(frac * d);
      if (n <= 0 || n >= d) continue;
      let err = Math.abs(frac - n / d);
      if (err < bestErr) {
        bestErr = err;
        best = [n, d];
      }
    }
    if (!best) return null;
    let g = gcd(best[0], best[1]);
    let n = best[0] / g;
    let d = best[1] / g;
    return whole > 0 ? whole + ' ' + n + '/' + d : n + '/' + d;
  }

  let UNICODE_BY_FRACTION = {};
  Object.keys(UNICODE_FRACTIONS).forEach(function(k) {
    UNICODE_BY_FRACTION[UNICODE_FRACTIONS[k]] = k;
  });

  // "1 1/2" -> "1 ½" (only when the source used a unicode fraction)
  function toUnicodeFraction(f) {
    let parts = f.split(' ');
    let frac = parts.pop();
    let unicode = UNICODE_BY_FRACTION[frac];
    if (!unicode) return f;
    return (parts.length ? parts.join(' ') + ' ' : '') + unicode;
  }

  function formatAmount(x, style, comma, unicode) {
    function out(s) {
      return comma ? s.replace('.', ',') : s;
    }
    if (style === 'frac') {
      let f = toMixedFraction(x);
      if (f === null) return out(trimZeros(x.toFixed(2)));
      return unicode ? toUnicodeFraction(f) : f;
    }
    if (style === 'int') {
      if (isInt(x)) return String(Math.round(x));
      let f = toMixedFraction(x);
      return f !== null ? f : out(trimZeros(x.toFixed(2)));
    }
    return out(trimZeros(x.toFixed(2)));
  }

  // scale the leading amount in an ingredient's html (keeps tags intact)
  function scaleIngredient(html, factor) {
    factor = parseFloat(factor);
    if (!factor || factor === 1 || !isFinite(factor)) return html;

    let m = String(html).match(/^(\s*)(<span[^>]*>)?([\s\S]*)$/);
    if (!m) return html;
    let leadWs = m[1];
    let spanOpen = m[2] || '';
    let rest = m[3];

    // range first: "1-2", "70g-150g", "100–150"
    let rangeRe = new RegExp('^(' + NUM + ')(\\s*' + UNIT + ')?(\\s*[-–]\\s*)(' + NUM + ')');
    let rm = rest.match(rangeRe);
    if (rm) {
      let a = parseNumber(rm[1]);
      let b = parseNumber(rm[4]);
      let out = (a.tilde ? '~' : '') + formatAmount(a.value * factor, a.style, a.comma, a.unicode) +
        (rm[2] || '') + rm[3] +
        (b.tilde ? '~' : '') + formatAmount(b.value * factor, b.style, b.comma, b.unicode);
      return leadWs + spanOpen + out + rest.slice(rm[0].length);
    }

    // otherwise just the single leading amount
    let sm = rest.match(new RegExp('^(' + NUM + ')'));
    if (sm) {
      let a = parseNumber(sm[1]);
      let out = (a.tilde ? '~' : '') + formatAmount(a.value * factor, a.style, a.comma, a.unicode);
      return leadWs + spanOpen + out + rest.slice(sm[0].length);
    }

    return html;
  }

  // does this ingredient line start with an amount?
  function hasLeadingAmount(html) {
    let m = String(html).match(/^(\s*)(<span[^>]*>)?([\s\S]*)$/);
    let rest = m ? m[3] : String(html);
    return new RegExp('^' + NUM).test(rest);
  }

  return {
    scaleIngredient: scaleIngredient,
    hasLeadingAmount: hasLeadingAmount,
    toMixedFraction: toMixedFraction,
    parseNumber: parseNumber
  };
});
