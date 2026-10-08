// handy function to create links in the markdown text
// via: https://stackoverflow.com/a/3890175/1167783
function linkify(str) {
  // urls starting with http://, https://, or ftp://
  let httpPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
  str = str.replace(httpPattern, '<a href="$1" target="_blank">$1</a>');

  // urls starting with "www." (without // before it, or it'd re-link the ones done above)
  let wwwPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
  str = str.replace(wwwPattern, '$1<a href="http://$2" target="_blank">$2</a>');

  // change email addresses to mailto: links
  let emailPattern = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
  str = str.replace(emailPattern, '<a href="mailto:$1">$1</a>');

  return str;
}


// a little function to get only the domain from a full url
// https://stackoverflow.com/a/8498668/1167783
function getDomain(url) {
  let a = document.createElement('a');
  a.href = url;
  return a.hostname;
}


// build a link to another recipe (names may contain spaces/capitals)
function recipeLink(name) {
  return 'recipe.php#' + encodeURIComponent(name);
}


// escape a string so it can be safely dropped into html
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
