(function() {
  const vid = document.getElementById('bgVideo');
  if (!vid) return;

  // DEF-05: Skip video on metered/slow connections to save bandwidth & GPU
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    var slowType = conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
    var lowBandwidth = typeof conn.downlink === 'number' && conn.downlink < 1.5;
    if (slowType || lowBandwidth) {
      // Remove source elements so browser won't download the video at all
      var sources = vid.querySelectorAll('source');
      sources.forEach(function(s) { s.remove(); });
      vid.load(); // cancel any in-flight network request
      return;
    }
  }

  // Also skip on reduced-motion preference (keep CSS particles, drop autoplaying video)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var sources = vid.querySelectorAll('source');
    sources.forEach(function(s) { s.remove(); });
    vid.load();
    return;
  }

  // Mark loaded when video can play — triggers CSS opacity transition
  function onReady() {
    vid.setAttribute('data-loaded', '');
  }
  
  // If video is already ready
  if (vid.readyState >= 3) {
    onReady();
  } else {
    vid.addEventListener('canplay', onReady, { once: true });
  }
  
  // Fallback: if video fails to load, keep it hidden (CSS particles still show)
  vid.addEventListener('error', function() {
    vid.style.display = 'none';
  }, { once: true });
  
  // Pause video when page is not visible (save battery/CPU)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      vid.pause();
    } else {
      vid.play().catch(function() {});
    }
  });
})();
