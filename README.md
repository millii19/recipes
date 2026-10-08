# RECIPE BOOK

A super minimal recipe website – great for keeping track of family recipes, mods to ones you find online, or have created yourself!

**See it in action here: [jeffreythompson.org/recipes](http://jeffreythompson.org/recipes)**

Features:
* Recipes in a simple [Markdown format](https://daringfireball.net/projects/markdown), just dump them in a folder and upload  
* List of recipes will auto-populate with quick alpha links at the top  
* Each recipe is displayed in a nice, clean format designed for use while cooking or at the grocery store – no extra 💩 or ads  
* To save your place while scrolling up around on the page, click the step you're on to highlight it; click it again to remove the highlight, or use the left/right arrow keys to advance  
* Scale a recipe's ingredient amounts with the ½× / 1× / 2× / 3× buttons, or type any factor in the decimal box – the chosen scale carries over when you follow links to other recipes  
* Click ingredients to cross them off as you go (display only, nothing is saved)  
* Link recipes to each other with `[[Wikilinks]]`; linked recipes are shown as small preview cards (and each recipe lists the recipes that use it)  
* Easily customized and code is (mostly) really well annotated 🙃  

## Try it out:
```bash
docker run --rm -it -p 8080:8080 $(docker build -q .)
```
then go to: http://localhost:8080

## MORE INFO  
* [Recipe format](#recipe-format)
* [Adding images](#adding-images)
* [Other options](#other-options)
* [Suggestions welcome!](#suggestions-welcome)


## RECIPE FORMAT  
Recipes are plain Markdown files dropped into the `recipes/` folder. Filenames may contain spaces and capitals (ex: `Banana Bread.md`, `Sourdough Focaccia.md`) – the filename is used as the title on the main page. The format is designed to work directly with an [Obsidian](https://obsidian.md) vault, so you can sync it as-is.

Use `recipe-template.md` and/or follow this format:

```markdown
---
tags:
  - bread
type: "[[Sourdough]]"
url: https://example.com/original-recipe
---

# TITLE
Optional subheader or short description

## ingredients
* 

## steps
1. 

## notes
* 

## based on
* 
```

The YAML frontmatter is optional. Supported fields:
* `tags` – list of tags (shown on the recipe preview cards)
* `type` – a category, either plain text or an Obsidian link like `"[[Sourdough]]"`
* `url` / `url2` – source recipe links, shown in the *based on* section

Section headings are flexible – any of these are understood and mapped to the right place:

| Section | Accepted headings |
| --- | --- |
| Ingredients | `ingredients`, `Ingredients` |
| Steps | `steps`, `Steps`, `Directions`, `Instructions`, `Method`, `Assembly` |
| Notes | `notes`, `Notes` |
| Based on | `based on`, `Based on`, `source` |

Extra `###` headings inside a section (ex: `### Assembly`) render as subheaders. Servings/time can be added as loose bullets right after the title; if exactly two are given they are labelled *TIME* / *MAKES*.

For example:

```markdown
---
tags:
  - drink
url: https://www.instagram.com/p/Bq3ckR8HIDE/
---

# Raspberry and Elderflower Gin and Tonic
A delicious light-red drink perfect for winter gatherings!

## ingredients
* 8 raspberries (frozen ok but should be thawed)  
* Fresh thyme (optional)  
* Gin  
* 1/2 lime  
* 1-2 tbsp St Germaine (or 1-2 tsp simple syrup)  

## steps
1. Muddle raspberries with 1.5 oz gin (and fresh thyme, if using)  
2. Add juice of half a lime  
3. Add 1-2 tbsp St Germaine (or 1-2 tsp simple syrup)  
4. Strain into glass, add ice cubes and top with tonic 

## notes
* Replace tonic with champagne for a *French 75* mashup   
```

### Linking recipes
Reference another recipe with an Obsidian wikilink using its filename (without `.md`):

```markdown
* 1 portion of [[Base Sourdough White Bread]]
```

Linked recipes appear as small preview cards at the bottom of the page, and every recipe also lists the recipes that link to it ("used in"). Links to names that don't match a recipe file are rendered as plain text (so category links like `[[Sourdough]]` are ignored).

You can optionally include info about how long the recipe takes and how many servings it makes. Put this before the `Ingredients` list:  

```## info  
* Takes about 90 minutes  
* Enough for a large biryani or a full-sized curry
```

The `Ingredients` and `Steps` sections can be split with subheaders too:

```## steps
1. Soak urad dal for 4 hours to overnight, drain  
2. Grind in blender until a smooth and thick paste (add a little water if necessary)  
3. Put in mixing bowl and whip with hands for 2-3 minutes until fluffy  
4. Add spices, herbs, and salt and whip again to combine  

To fry:
1. Heat oil over medium/medium-high heat  
2. Take a bowl of water, wet hands, and form small balls  
3. Slide into oil and cook, flipping often, until golden  
4. Drain on paper towels  
```

## ADDING IMAGES  
Thanks to a suggestion from @mpember, if you have a `jpg` image with the same filename as your recipe, it will automatically be added! 

For example: `aloo-matar.md` should have an image called `aloo-matar.jpg` in the `images` folder.

You can also include other images in the recipe using Markdown's image syntax: `![alt text](url)`. You'll probably want to update the stylesheet to size them appropriately.


## OTHER OPTIONS  
The `recipe.php` file also includes some more options you can customize:

* `lookForHeroImage`: on by default, but you can turn it off if you never intend to include hero images  
* `autoUrlSections`: list of sections where you want raw URLs (ex: www.instagram.com) to be turned into real links. Great for the `based on` section but not so good if you want to include Markdown-formatted links in other sections  
* `shortenURLs`: turns a super-long url into just the main domain name (link will still work as normal, just less cluttered). Off by default but exists if you want it


## TESTS  
The parsing, quantity scaling and cross-recipe links are covered by tests:

```bash
bash tests/run.sh
```

This runs:
* `tests/php/test-recipe-data.php` – frontmatter/metadata/link-graph parsing (PHP)
* `tests/js/parsing.test.js` – heading mapping, frontmatter stripping, wikilinks
* `tests/js/scaling.test.js` – ingredient quantity scaling
* `tests/integration/links.test.js` – drives the real page in headless Chrome to verify recipe links, backlinks, the scaler and cross-off

The integration test needs `php` on your `PATH` (or set `PHP_BIN`) and a Chromium/Chrome binary (or set `CHROME_BIN`). CI runs the same script on every push and pull request (see `.github/workflows/tests.yml`).


## SUGGESTIONS WELCOME  
If you have suggestions for improving this project, please let me know! Either [open an issue](https://github.com/jeffThompson/Recipes/issues/new) or send me an email.

