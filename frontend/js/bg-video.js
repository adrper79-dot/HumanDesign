(function() {
  const vid = document.getElementById('bgVideo');
  if (!vid) return;
  
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
  
  // Pause video when page is not visible (save battery)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      vid.pause();
    } else {
      vid.play().catch(function() {});
    }
  });
})();
