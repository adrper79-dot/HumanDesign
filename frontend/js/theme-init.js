(function () {
  var savedTheme = localStorage.getItem('ps-theme');
  var prefersLight =
    !savedTheme &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;

  if (savedTheme === 'light' || prefersLight) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();