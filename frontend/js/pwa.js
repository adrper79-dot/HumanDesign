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
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button (if you add one in the future)
  if (window.DEBUG) console.log('💡 PWA install prompt available');
  
  // Optional: Show a custom install banner
  const installBanner = document.createElement('div');
  installBanner.id = 'install-banner';
  installBanner.style.cssText = `
    position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #6a4fc8 0%, #c9a84c 100%);
    color: white; padding: 12px 24px; border-radius: 8px;
    box-shadow: var(--shadow); z-index: 1000;
    font-size: 0.9rem; display: flex; align-items: center; gap: 12px;
    animation: slideUp 0.3s ease-out;
  `;
  installBanner.innerHTML = `
    <span>📱 Install Prime Self as an app</span>
    <button id="install-btn" style="
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
      color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer;
      font-weight: 600; font-size: 0.85rem;
    ">Install</button>
    <button id="dismiss-install" style="
      background: transparent; border: none; color: rgba(255,255,255,0.7);
      cursor: pointer; font-size: 1.2rem; padding: 0 4px;
    ">×</button>
  `;
  
  document.body.appendChild(installBanner);
  
  document.getElementById('install-btn').addEventListener('click', async () => {
    // Hide the banner
    installBanner.remove();
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;
    if (window.DEBUG) console.log(`PWA install outcome: ${outcome}`);
    deferredPrompt = null;
  });
  
  document.getElementById('dismiss-install').addEventListener('click', () => {
    installBanner.remove();
  });
});

// Log when app is installed
window.addEventListener('appinstalled', () => {
  if (window.DEBUG) console.log('✅ PWA installed successfully');
  deferredPrompt = null;
});

// Add slide-up animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translate(-50%, 100px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }
`;
document.head.appendChild(style);
