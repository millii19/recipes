<?php include 'recipe-data.php'; ?>
<!doctype html>
<html profile="http://www.w3.org/2005/10/profile">
	<head>
		<title>Recipe Book</title>

		<!-- basics -->
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
		<link rel="icon" type="image/png" href="http://www.jeffreythompson.org/graphics/favicon.png">

		<!-- font and styles -->
		<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap" rel="stylesheet">
		<link href="stylesheet.css" rel="stylesheet" type="text/css">

		<script>
			// RECIPE OPTIONS
			// below are some options to customize how your recipes appear
			// (these are mostly things that folks might want to change, but
			// of course you can customize the code too)

			// look in a folder called 'images' for an image to display
			// at the top of the recipe?
			// (must be named the same thing as the recipe and have a .jpg ext)
			// (ex: aloo-matar.md would have an image aloo-matar.jpg)
			// will fail gracefully if an image doesn't exist, but you can
			// turn it off entirely if you want
			let lookForHeroImage = true;

			// turn text-only urls to links in these sections
			// (in other sections, markdown links will work as normal)
			let autoUrlSections = [ 'basedon' ];

			// trim display text for long urls in 'based on' section
			// ex:           https://www.seriouseats.com/recipes/2012/01/aloo-matar.html
			// would become: https://www.seriouseats.com
			let shortenURLs = false;
		</script>

		<!-- showdown (markdown parser) -->
		<!-- https://github.com/showdownjs -->
		<script
			src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js"
			integrity="sha384-GP2+CwBlakZSDJUr+E4JvbxpM75i1i8+RKkieQxzuyDZLG+5105E1OfHIjzcXyWH"
			crossorigin="anonymous">
		</script>

		<!-- jquery -->
		<script
			src="https://code.jquery.com/jquery-4.0.0.min.js"
			integrity="sha384-fgGyf7Mo7DURSOMnOy7ed+dkq5Job205Gnzu6QIg0BOHKaqt4D76Dt8VlDCzcMHV"
			crossorigin="anonymous">
		</script>
	</head>

	<body>
		<div id="wrapper" class="recipe">

			<!-- back to previous recipe + home -->
			<!-- icons via: https://fontawesome.com/icons/arrow-left and /house -->
			<p id="back">
				<a href="#" id="backPrev" class="backPrev">
					<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
						<path fill="currentColor" d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z"></path>
					</svg>
					<img class="backPrevThumb" alt="">
					<span class="backPrevText">
						<span class="backPrevLabel">back to</span>
						<span class="backPrevName"></span>
					</span>
				</a>
				<a href="index.php" id="homeLink" class="homeLink" title="All recipes">
					<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
						<path fill="currentColor" d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"></path>
					</svg>
				</a>
			</p>

			<!-- recipe (details inserted with js) -->
			<section id="heroimage"></section>
			<section id="title"></section>
			<section id="info"></section>
			<section id="ingredients"></section>
			<section id="steps"></section>
			<hr />
			<section id="notes"></section>
			<section id="basedon"></section>
			<section id="linked"></section>
			<section id="backlinks"></section>
		</div>
	</body>

	<!-- recipe metadata + link graph (from php) -->
	<script>
  	let files = <?php echo json_encode($files) ?>;
  	let linkGraph = <?php echo json_encode($linkGraph) ?>;
  	let recipeData = <?php echo json_encode($recipeData) ?>;
	</script>

	<!-- parses and displays recipe -->
	<script src="parsing.js"></script>
	<script src="scaling.js"></script>
	<script src="navigation.js"></script>
	<script src="utils.js"></script>
	<script src="create-recipe.js"></script>
</html>
