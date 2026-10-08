// once document is loaded, get recipe from file
$(document).ready(function() {

  // create markdown converter
  let md = new showdown.Converter({ tables: true, strikethrough: true, tasklists: true });

  // recipe names (without .md) used to resolve [[wikilinks]]
  let recipeNames = (typeof files !== 'undefined' ? files : []).map(function(f) {
    return f.replace(/\.md$/, '');
  });

  // ingredient scale, kept across recipe link clicks (not across reloads)
  let selectedScale = 1;

  // which recipe is the url pointing at right now?
  function currentName() {
    return decodeURIComponent(window.location.hash.replace(/^#/, ''));
  }

  // load and render the recipe named in the url hash
  function loadRecipe() {
    let baseFilename = currentName();
    if (!baseFilename) {
      window.location.href = 'index.php';
      return;
    }
    let filename = 'recipes/' + baseFilename + '.md';

    // metadata + link graph provided by php (see recipe-data.php)
    let meta = (typeof recipeData !== 'undefined' && recipeData[baseFilename]) ? recipeData[baseFilename] : {};
    let graph = (typeof linkGraph !== 'undefined' && linkGraph[baseFilename]) ? linkGraph[baseFilename] : { forward: [], backlinks: [] };

    // reset anything left over from a previously viewed recipe
    $('#heroimage').empty();
    $('.highlight').removeClass('highlight');

    // if there's a hero image available, load and display
    if (lookForHeroImage) {
      let src = 'images/' + encodeURIComponent(baseFilename) + '.jpg';
      let img = $('<img>').attr('src', src)
        .on('load', function() {
          // if, for various reasons, the image can't be loaded let us know
          if (!this.complete || typeof this.naturalWidth == 'undefined' || this.naturalWidth == 0) {
            console.warn('Error loading hero image! Might not exist for this recipe, but if it does make sure the filename is the same as the recipe file and has a .jpg extension');
          }
          else {
            $('#heroimage').append(img);
          }
      });
    }

    // load the recipe
    $.ajax({
      url: filename,
      success: function(recipe) {

        // strip yaml frontmatter (metadata comes from php)
        recipe = RecipeParsing.stripFrontmatter(recipe);

        // normalize headings + pull out intro content
        let normalized = RecipeParsing.normalizeBody(recipe);

        // turn [[wikilinks]] into normal markdown links
        let bodyMd = RecipeParsing.convertWikilinks(normalized.md, recipeNames, recipeLink);
        let titleExtra = normalized.titleExtra.map(function(line) {
          return RecipeParsing.convertWikilinks(line, recipeNames, recipeLink);
        });

        // convert markdown to html
        // (drop auto-generated header ids so they don't clash with section ids)
        let html = md.makeHtml(bodyMd).replace(/ id="[^"]*"/g, '');

        // sort the top-level elements into sections
        let buffers = { ingredients: '', steps: '', notes: '', basedon: '', info: '' };
        let current = null;
        $('<div>').html(html).children().each(function() {
          let tag = (this.tagName || '').toLowerCase();
          if (tag === 'h2') {
            let key = RecipeParsing.sectionKey($(this).text());
            if (key) {
              current = key;
              buffers[key] += this.outerHTML;
              return;
            }
          }
          if (current) {
            buffers[current] += this.outerHTML;
          }
        });

        // title + subtitle
        let title = meta.title || baseFilename;
        $(document).prop('title', title + ' | Recipe Book');
        let titleHtml = '<h1>' + escapeHtml(title) + '</h1>';
        if (titleExtra.length) {
          titleHtml += md.makeHtml(titleExtra.join('\n\n'));
        }
        $('#title').html(titleHtml);

        // info: label time/makes only when there are exactly two bullets
        if (buffers.info.trim()) {
          let $info = $('<div>').html(buffers.info);
          let $items = $info.find('li');
          if ($items.length === 2) {
            let time = $items.eq(0).html();
            let makes = $items.eq(1).html();
            $info.html('<ul><li><span id="time">TIME </span>' + time + '</li><li><span id="makes">MAKES </span>' + makes + '</li></ul>');
          }
          put('#info', $info.html());
        }
        else {
          put('#info', '');
        }

        // ingredients / steps / notes
        put('#ingredients', buffers.ingredients);
        put('#steps', buffers.steps);
        put('#notes', buffers.notes);

        // ingredients: lighter parentheses, a quantity scaler, and
        // click-to-cross-off (display only, never saved)
        let ingredientOriginals = [];
        $('#ingredients li').each( function() {
          // only touches text, so <span data-qty-parse> survives
          $(this).html(RecipeParsing.parensToSpans($(this).html()));
          ingredientOriginals.push($(this).html());
        });
        renderScaler(ingredientOriginals);

        // click an ingredient to cross it off (ignore clicks on links)
        $('#ingredients li').off('click.crossoff').on('click.crossoff', function(e) {
          if ($(e.target).closest('a').length) return;
          $(this).toggleClass('done');
        });

        // based on: merge frontmatter urls with an explicit section
        // (ignore a section that contains nothing but its heading)
        let based = buffers.basedon;
        if (based && !/<(li|p|a)\b/i.test(based)) {
          based = '';
        }
        let urls = [meta.url, meta.url2].filter(function(u) { return u && u.trim(); });
        if (urls.length) {
          if (!based.trim()) {
            based = '<h2>based on</h2>';
          }
          based += '<ul>' + urls.map(function(u) { return '<li>' + u + '</li>'; }).join('') + '</ul>';
        }
        if (based.trim()) {
          if (autoUrlSections.includes('basedon')) {
            based = linkify(based);
          }
          if (shortenURLs) {
            let $based = $('<div>').html(based);
            $based.find('a').each( function() {
              $(this).text(getDomain($(this).text()));
            });
            based = $based.html();
          }
          put('#basedon', based);
        }
        else {
          put('#basedon', '');
        }

        // linked recipes + used in (backlinks)
        renderLinkCards('#linked', graph.forward, 'linked recipes');
        renderLinkCards('#backlinks', graph.backlinks, 'used in');

        // click a step to highlight it
        $('#steps li').click( function() {
          if ( $(this).hasClass('highlight') ) {
            $(this).removeClass('highlight');
          }
          else {
            $('.highlight').removeClass('highlight');
            $(this).addClass('highlight');
          }
        });
      },

      // no recipe listed or some problem?
      // redirect to the main page
      error: function(xhr, status, err) {
        console.log(err);
        window.location.href = 'index.php';
      }
    });
  }

  // navigating between recipes only changes the url hash, so the page must
  // be re-rendered on hashchange (otherwise the old recipe stays on screen)
  $(window).on('hashchange', function() {
    window.scrollTo(0, 0);
    loadRecipe();
  });

  loadRecipe();

  // L/R arrow keys shift the step highlight
  $(document).keydown(function(e) {
    switch(e.which) {
      case 37:                        // left
        var curr = $('.highlight');
        curr.removeClass('highlight');
        curr.prev().addClass('highlight');
        break;
      case 39:                        // right
        var curr = $('.highlight');
        curr.removeClass('highlight');
        curr.next().addClass('highlight');
        break;
      default:
        return;
    }
  });


  // place html in a section, or hide it when empty
  function put(selector, html) {
    if (html && html.trim()) {
      $(selector).html(html).show();
    }
    else {
      $(selector).empty().hide();
    }
  }


  // minimalist quantity scaler for the ingredients list
  function renderScaler(originals) {
    if (!originals.length) return;

    // only show it when at least one ingredient starts with an amount
    let hasAmount = originals.some(RecipeScaling.hasLeadingAmount);
    if (!hasAmount) return;

    let bar = '<div class="scaleBar"><span class="scaleLabel">Scale</span>'
      + '<button type="button" class="scaleBtn" data-scale="0.5">½×</button>'
      + '<button type="button" class="scaleBtn" data-scale="1">1×</button>'
      + '<button type="button" class="scaleBtn" data-scale="2">2×</button>'
      + '<button type="button" class="scaleBtn" data-scale="3">3×</button>'
      + '<span class="scaleCustom">'
      + '<input type="number" class="scaleInput" min="0.1" step="0.1" aria-label="Scale factor">'
      + '<span class="scaleTimes">×</span>'
      + '</span>'
      + '</div>';
    $('#ingredients').prepend(bar);

    let $ing = $('#ingredients');
    let $input = $ing.find('.scaleInput');
    let presets = [0.5, 1, 2, 3];

    function apply(factor) {
      $('#ingredients li').each(function(i) {
        $(this).html(RecipeScaling.scaleIngredient(originals[i], factor));
      });
    }

    // highlight the preset button matching the factor (none for custom values)
    function highlight(factor) {
      $ing.find('.scaleBtn').removeClass('active');
      presets.forEach(function(p) {
        if (Math.abs(p - factor) < 1e-9) {
          $ing.find('.scaleBtn[data-scale="' + p + '"]').addClass('active');
        }
      });
    }

    // start from the scale already chosen (persists across recipe link clicks)
    $input.val(String(selectedScale));
    highlight(selectedScale);
    apply(selectedScale);

    $ing.find('.scaleBtn').on('click', function() {
      let factor = parseFloat($(this).data('scale'));
      selectedScale = factor;
      $input.val(String(factor));
      highlight(factor);
      apply(factor);
    });

    // the textbox is always editable and shows the current scale in decimal
    $input.on('input', function() {
      let factor = parseFloat($(this).val());
      if (!(factor > 0)) return;
      selectedScale = factor;
      highlight(factor);
      apply(factor);
    });
  }


  // small preview cards for linked/backlinked recipes
  function renderLinkCards(selector, names, heading) {
    if (!names || !names.length) {
      put(selector, '');
      return;
    }
    let html = '<hr /><h2>' + escapeHtml(heading) + '</h2><ul class="recipeCards">';
    names.forEach(function(name) {
      let info = (typeof recipeData !== 'undefined' && recipeData[name]) ? recipeData[name] : {};
      let title = info.title || name;
      html += '<li class="recipeCard"><a href="' + recipeLink(name) + '">';
      if (info.thumbnail) {
        html += '<img class="cardThumb" src="' + escapeHtml(info.thumbnail) + '" alt="" loading="lazy">';
      }
      html += '<span class="cardBody">';
      html += '<span class="cardTitle">' + escapeHtml(title) + '</span>';
      if (info.snippet) {
        html += '<span class="cardSnippet">' + escapeHtml(info.snippet) + '</span>';
      }
      if (info.tags && info.tags.length) {
        html += '<span class="cardTags">';
        info.tags.forEach(function(tag) {
          html += '<span class="tag">' + escapeHtml(tag) + '</span>';
        });
        html += '</span>';
      }
      html += '</span></a></li>';
    });
    html += '</ul>';
    put(selector, html);
  }
});
