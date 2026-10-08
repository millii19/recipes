// once document is loaded, get recipe from file
$(document).ready(function() {

  // create markdown converter
  let md = new showdown.Converter({ tables: true, strikethrough: true, tasklists: true });

  // extract which recipe from url anchor (names can have spaces/capitals)
  let baseFilename = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  let filename = 'recipes/' + baseFilename + '.md';

  // metadata + link graph provided by php (see recipe-data.php)
  let meta = (typeof recipeData !== 'undefined' && recipeData[baseFilename]) ? recipeData[baseFilename] : {};
  let graph = (typeof linkGraph !== 'undefined' && linkGraph[baseFilename]) ? linkGraph[baseFilename] : { forward: [], backlinks: [] };
  let recipeNames = (typeof files !== 'undefined' ? files : []).map(function(f) {
    return f.replace(/\.md$/, '');
  });

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
      recipe = recipe.replace(/^\uFEFF/, '');
      recipe = recipe.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');
      recipe = recipe.replace(/^[\s\uFEFF]+/, '');

      // normalize headings + pull out intro content
      let normalized = normalizeBody(recipe);

      // turn [[wikilinks]] into normal markdown links
      let bodyMd = convertWikilinks(normalized.md);
      let titleExtra = normalized.titleExtra.map(convertWikilinks);

      // convert markdown to html
      // (drop auto-generated header ids so they don't clash with section ids)
      let html = md.makeHtml(bodyMd).replace(/ id="[^"]*"/g, '');

      // sort the top-level elements into sections
      let buffers = { ingredients: '', steps: '', notes: '', basedon: '', info: '' };
      let current = null;
      $('<div>').html(html).children().each(function() {
        let tag = (this.tagName || '').toLowerCase();
        if (tag === 'h2') {
          let key = sectionKey($(this).text());
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
      let infoHtml = buffers.info;
      if (infoHtml.trim()) {
        let $info = $('<div>').html(infoHtml);
        let $items = $info.find('li');
        if ($items.length === 2) {
          let time = $items.eq(0).html();
          let makes = $items.eq(1).html();
          $info.html('<ul><li><span id="time">TIME </span>' + time + '</li><li><span id="makes">MAKES </span>' + makes + '</li></ul>');
        }
        $('#info').html($info.html());
      }
      else {
        $('#info').hide();
      }

      // ingredients / steps / notes
      setSection('#ingredients', buffers.ingredients);
      setSection('#steps', buffers.steps);
      setSection('#notes', buffers.notes);

      // in the ingredients, make things in parentheses a bit lighter
      // (only touches text, so <span data-qty-parse> survives)
      $('#ingredients li').each( function() {
        $(this).html(parensToSpans($(this).html()));
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
        $('#basedon').html(based);
      }
      else {
        $('#basedon').hide();
      }

      // link icon svg code
      // via: https://fontawesome.com/icons/external-link-alt
      let linkIcon = '<svg class="linkIcon" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">';
      linkIcon += '<path fill="currentColor" d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM488,0h-128c-21.37,0-32.05,25.91-17,41l35.73,35.73L135,320.37a24,24,0,0,0,0,34L157.67,377a24,24,0,0,0,34,0L435.28,133.32,471,169c15,15,41,4.5,41-17V24A24,24,0,0,0,488,0Z"></path>';
      linkIcon += '</svg>';

      // add some helper links
      let recipeName = $('h1').text().toLowerCase().replace(/ /g, '+');
      let help = '<h2>help!</h2>';
      help += '<ul>';
      for (let j in helpUrls) {
        let label = helpUrls[j].label;
        let url = helpUrls[j].url.replace('<name>', recipeName);
        help += '<li><a href="' + url + '" target="blank">' + label + '</a></li>';
      }
      help += '</ul>';
      $('#help').html(help);

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


  // map the many heading names found in obsidian recipes
  // onto the section ids used by the page
  function sectionKey(heading) {
    let h = heading.toLowerCase().replace(/[#*:]/g, '').trim().replace(/\s+/g, ' ');
    if (/^ingredient/.test(h)) return 'ingredients';
    if (/^(steps?|directions?|method|instructions?|assembly|preparation)/.test(h)) return 'steps';
    if (/^notes?/.test(h)) return 'notes';
    if (/^(based ?on|basedon|source)/.test(h)) return 'basedon';
    if (/^info/.test(h)) return 'info';
    return null;
  }


  // split off the intro (before the first heading), collect info bullets,
  // and force consistent heading levels (first of a kind = h2, rest = h3)
  function normalizeBody(body) {
    // drop the title (it is rendered separately)
    body = body.replace(/^#\s+.+?[ \t]*(?:\r?\n|$)/, '');

    let firstHeading = body.match(/^#{1,6}\s+/m);
    let intro = firstHeading ? body.slice(0, firstHeading.index) : body;
    let rest = firstHeading ? body.slice(firstHeading.index) : '';

    let infoLines = [];
    let titleExtra = [];
    intro.split(/\r?\n/).forEach(function(line) {
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
    let out = rest.split(/\r?\n/).filter(function(line) {
      return !/^[-*_]{3,}\s*$/.test(line.trim()); // drop horizontal rules
    }).map(function(line) {
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
  function convertWikilinks(text) {
    return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function(whole, target, alias) {
      target = target.trim();
      let label = (alias ? alias : target).trim();
      if (recipeNames.indexOf(target) !== -1) {
        return '[' + label + '](' + recipeLink(target) + ')';
      }
      return label;
    });
  }


  // place html in a section, or hide it when empty
  function setSection(selector, html) {
    if (html && html.trim()) {
      $(selector).html(html);
    }
    else {
      $(selector).hide();
    }
  }


  // wrap text in parentheses without touching existing html tags
  function parensToSpans(html) {
    return html.replace(/(<[^>]+>)|(\([^)]+\))/g, function(whole, tag, paren) {
      if (tag) return tag;
      return '<span class="paren">' + paren + '</span>';
    });
  }


  // small preview cards for linked/backlinked recipes
  function renderLinkCards(selector, names, heading) {
    if (!names || !names.length) {
      $(selector).hide();
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
    $(selector).html(html);
  }
});
