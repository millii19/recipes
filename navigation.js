// navigation.js
// In-memory "recently visited recipes" history for back-to-previous navigation.
// De-duped and bounded, so clicking between recipes never grows without limit
// and the back chain never loops. Kept separate from create-recipe.js so it
// can be unit tested.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  }
  else {
    root.RecipeNav = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function createNavHistory(options) {
    options = options || {};
    let max = options.max || 10;
    let stack = [];
    let pos = -1;

    // forward navigation to a recipe (ex: clicking a link)
    function visit(name) {
      if (!name) return;
      stack = stack.slice(0, pos + 1);      // drop any forward entries
      let existing = stack.indexOf(name);
      if (existing !== -1) stack.splice(existing, 1); // de-dupe
      stack.push(name);
      while (stack.length > max) stack.shift();       // evict oldest
      pos = stack.length - 1;
    }

    // step back; returns the recipe to show, or null when there is none
    function back() {
      if (pos > 0) {
        pos--;
        return stack[pos];
      }
      return null;
    }

    // step forward through remembered entries
    function forward() {
      if (pos < stack.length - 1) {
        pos++;
        return stack[pos];
      }
      return null;
    }

    function previous() { return pos > 0 ? stack[pos - 1] : null; }
    function next() { return pos < stack.length - 1 ? stack[pos + 1] : null; }
    function current() { return pos >= 0 ? stack[pos] : null; }
    function size() { return stack.length; }

    return {
      visit: visit,
      back: back,
      forward: forward,
      previous: previous,
      next: next,
      current: current,
      size: size
    };
  }

  return { createNavHistory: createNavHistory };
});
