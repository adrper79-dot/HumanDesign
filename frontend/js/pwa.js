// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        if (window.DEBUG) console.log('✅ Service Worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// Add to Home Screen prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (window.DEBUG) console.log('💡 PWA install prompt available');
  // Show the "Install App" link in the sidebar footer
  const navBtn = document.getElementById('pwaInstallNavBtn');
  if (navBtn) navBtn.style.display = '';
});

// Triggered by sidebar "Install App" button (data-action="pwaInstallFromNav")
window.pwaInstallFromNav = async function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (window.DEBUG) console.log(`PWA install outcome: ${outcome}`);
  deferredPrompt = null;
  const navBtn = document.getElementById('pwaInstallNavBtn');
  if (navBtn) navBtn.style.display = 'none';
};

window.addEventListener('appinstalled', () => {
  if (window.DEBUG) console.log('✅ PWA installed successfully');
  deferredPrompt = null;
  const navBtn = document.getElementById('pwaInstallNavBtn');
  if (navBtn) navBtn.style.display = 'none';
});
