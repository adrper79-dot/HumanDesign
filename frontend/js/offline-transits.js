/**
 * Offline Transit Calculator — BL-MOB-005
 *
 * Caches transit data in IndexedDB for offline access:
 *   1. Stores today's transit response when online
 *   2. Pre-fetches 7-day forecast for offline availability
 *   3. Stores the user's natal chart data for offline reference
 *   4. Shows "Offline Mode" indicator when disconnected
 *   5. Syncs any generated charts when back online
 *
 * IndexedDB schema:
 *   Store: transits  — { date (key), data, fetchedAt }
 *   Store: charts     — { id (key), chart, fetchedAt }
 *   Store: syncQueue  — { id (autoIncrement), action, payload, createdAt }
 *
 * Usage:
 *   // Auto-initializes on DOMContentLoaded
 *   // From any script:
 *   const transits = await window.offlineTransits.getTransits('2026-03-07');
 *   const chart    = await window.offlineTransits.getChart('last');
 */
(function () {
  'use strict';

  const DB_NAME = 'prime-self-offline';
  const DB_VERSION = 1;
  const STORE_TRANSITS = 'transits';
  const STORE_CHARTS = 'charts';
  const STORE_SYNC = 'syncQueue';
  const PREFETCH_DAYS = 7;
  const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  let db = null;
  let isOnline = navigator.onLine;

  // ─── IndexedDB Setup ─────────────────────────────────────────────

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;

        if (!idb.objectStoreNames.contains(STORE_TRANSITS)) {
          idb.createObjectStore(STORE_TRANSITS, { keyPath: 'date' });
        }
        if (!idb.objectStoreNames.contains(STORE_CHARTS)) {
          const chartsStore = idb.createObjectStore(STORE_CHARTS, { keyPath: 'id' });
          chartsStore.createIndex('fetchedAt', 'fetchedAt');
        }
        if (!idb.objectStoreNames.contains(STORE_SYNC)) {
          idb.createObjectStore(STORE_SYNC, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ─── Generic IDB helpers ─────────────────────────────────────────

  async function idbGet(storeName, key) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(storeName, value) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGetAll(storeName) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(storeName, key) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function idbClear(storeName) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Transit caching ────────────────────────────────────────────

  /**
   * Get transits for a specific date. Returns cached data if available.
   * Falls back to API if online and cache is stale/missing.
   *
   * @param {string} [date] - ISO date string (YYYY-MM-DD), defaults to today
   * @returns {Promise<Object|null>} Transit data or null
   */
  async function getTransits(date) {
    const targetDate = date || todayISO();

    // Check cache first
    const cached = await idbGet(STORE_TRANSITS, targetDate);
    if (cached && (Date.now() - cached.fetchedAt) < MAX_CACHE_AGE_MS) {
      return { ...cached.data, _cached: true, _cachedAt: cached.fetchedAt };
    }

    // If online, fetch fresh
    if (isOnline && typeof window.apiFetch === 'function') {
      try {
        const resp = await window.apiFetch(`/api/transits/today`);
        if (resp && resp.ok) {
          await cacheTransit(targetDate, resp);
          return { ...resp, _cached: false };
        }
      } catch (err) {
        console.warn('[offline] Transit fetch failed:', err.message);
      }
    }

    // Return stale cache if available (better than nothing)
    if (cached) {
      return { ...cached.data, _cached: true, _stale: true, _cachedAt: cached.fetchedAt };
    }

    return null;
  }

  /**
   * Store transit data in IndexedDB.
   */
  async function cacheTransit(date, data) {
    try {
      await idbPut(STORE_TRANSITS, {
        date,
        data,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[offline] Failed to cache transit:', err.message);
    }
  }

  /**
   * Pre-fetch transit data for the next N days.
   * Runs in background when online.
   */
  async function prefetchTransits() {
    if (!isOnline || typeof window.apiFetch !== 'function') return;

    // Check if user is authenticated and has a birth chart
    // Before attempting to fetch personalized forecasts
    let userChart = null;
    try {
      const meResp = await window.apiFetch('/api/auth/me');
      if (meResp && meResp.ok) {
        const meData = await meResp.json();
        if (meData.user && meData.user.default_birth_date) {
          userChart = {
            birthDate: meData.user.default_birth_date,
            birthTime: meData.user.default_birth_time || '12:00',
            birthTimezone: meData.user.default_birth_timezone || 'UTC',
            lat: meData.user.default_birth_lat || 0,
            lng: meData.user.default_birth_lng || 0,
          };
        }
      }
    } catch {
      // User not authenticated — will use generic transits only
    }

    const today = new Date();
    let fetched = 0;

    for (let i = 0; i < PREFETCH_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      // Skip if already cached and fresh
      const cached = await idbGet(STORE_TRANSITS, dateStr);
      if (cached && (Date.now() - cached.fetchedAt) < MAX_CACHE_AGE_MS) continue;

      try {
        // For today, use generic transits (works for everyone)
        // For future dates with user chart, use personalized forecast
        let endpoint;
        if (i === 0) {
          endpoint = '/api/transits/today';
        } else if (userChart) {
          // User authenticated with birth data — fetch personalized forecast
          const params = new URLSearchParams({
            birthDate: userChart.birthDate,
            birthTime: userChart.birthTime,
            birthTimezone: userChart.birthTimezone,
            lat: userChart.lat,
            lng: userChart.lng,
            startDate: dateStr,
            endDate: dateStr,
          });
          endpoint = `/api/transits/forecast?${params.toString()}`;
        } else {
          // Not authenticated — skip forecast (would return 400)
          continue;
        }

        const resp = await window.apiFetch(endpoint);
        if (resp && resp.ok) {
          await cacheTransit(dateStr, resp);
          fetched++;
        }
      } catch {
        // Non-critical, stop prefetching on error
        break;
      }

      // Small delay between requests to avoid overloading
      if (i < PREFETCH_DAYS - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (fetched > 0) {
      console.log(`[offline] Pre-fetched ${fetched} days of transit data`);
    }
  }

  // ─── Chart caching ──────────────────────────────────────────────

  /**
   * Cache a natal chart for offline access.
   * @param {string} id - Chart identifier (or 'last' for most recent)
   * @param {Object} chart - Chart data
   */
  async function cacheChart(id, chart) {
    try {
      await idbPut(STORE_CHARTS, {
        id,
        chart,
        fetchedAt: Date.now(),
      });
      // Also always update 'last' pointer
      if (id !== 'last') {
        await idbPut(STORE_CHARTS, {
          id: 'last',
          chart,
          fetchedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[offline] Failed to cache chart:', err.message);
    }
  }

  /**
   * Get a cached chart.
   * @param {string} [id='last'] - Chart ID or 'last'
   * @returns {Promise<Object|null>}
   */
  async function getChart(id = 'last') {
    const record = await idbGet(STORE_CHARTS, id);
    return record ? record.chart : null;
  }

  // ─── Sync queue ──────────────────────────────────────────────────

  /**
   * Queue an action for sync when back online.
   * @param {string} action - Action type (e.g. 'save-chart', 'diary-entry')
   * @param {Object} payload - Request payload
   */
  async function queueForSync(action, payload) {
    try {
      await idbPut(STORE_SYNC, {
        action,
        payload,
        createdAt: Date.now(),
      });
      console.log(`[offline] Queued ${action} for sync`);
    } catch (err) {
      console.warn('[offline] Failed to queue sync:', err.message);
    }
  }

  /**
   * Process all queued sync actions. Called when going back online.
   */
  async function processQueue() {
    if (!isOnline || typeof window.apiFetch !== 'function') return;

    const items = await idbGetAll(STORE_SYNC);
    if (items.length === 0) return;

    console.log(`[offline] Processing ${items.length} queued actions`);

    const endpoints = {
      'save-chart': { method: 'POST', path: '/api/chart/save' },
      'diary-entry': { method: 'POST', path: '/api/diary' },
      'checkin': { method: 'POST', path: '/api/checkin' },
    };

    let processed = 0;

    for (const item of items) {
      const config = endpoints[item.action];
      if (!config) {
        await idbDelete(STORE_SYNC, item.id);
        continue;
      }

      try {
        await window.apiFetch(config.path, {
          method: config.method,
          body: JSON.stringify(item.payload),
        });
        await idbDelete(STORE_SYNC, item.id);
        processed++;
      } catch (err) {
        console.warn(`[offline] Sync failed for ${item.action}:`, err.message);
        // Leave in queue for next sync attempt
      }
    }

    if (processed > 0) {
      console.log(`[offline] Synced ${processed}/${items.length} queued actions`);
      showNotification(`Synced ${processed} offline ${processed === 1 ? 'action' : 'actions'}`);
    }
  }

  // ─── Offline UI indicator ────────────────────────────────────────

  let offlineBanner = null;

  function createOfflineBanner() {
    if (offlineBanner) return;

    offlineBanner = document.createElement('div');
    offlineBanner.id = 'offline-indicator';
    offlineBanner.className = 'offline-indicator';
    offlineBanner.innerHTML = `
      <span class="offline-icon">⚡</span>
      <span class="offline-text">${window.t ? window.t('offline.offlineMode') : 'Offline Mode — Using cached data'}</span>
    `;
    offlineBanner.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 400;
      background: linear-gradient(135deg, #1a1a24 0%, #2a2a3a 100%);
      color: #c9a84c; text-align: center; padding: 8px 16px;
      font-size: 0.82rem; font-weight: 500; display: none;
      border-top: 1px solid #c9a84c33;
      animation: slideUpBanner 0.3s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('offline-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'offline-banner-styles';
      style.textContent = `
        @keyframes slideUpBanner {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .offline-indicator .offline-icon { margin-right: 6px; }
        .offline-indicator.online {
          background: linear-gradient(135deg, #1a2420 0%, #2a3a30 100%);
          color: #50c878;
          border-top-color: #50c87833;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(offlineBanner);
  }

  function updateOnlineStatus(online) {
    isOnline = online;
    createOfflineBanner();

    if (!online) {
      offlineBanner.querySelector('.offline-text').textContent = window.t ? window.t('offline.offlineMode') : 'Offline Mode — Using cached data';
      offlineBanner.className = 'offline-indicator';
      offlineBanner.style.display = 'block';
    } else {
      offlineBanner.querySelector('.offline-text').textContent = window.t ? window.t('offline.backOnline') : 'Back online — Syncing…';
      offlineBanner.className = 'offline-indicator online';
      offlineBanner.style.display = 'block';

      // Process queued actions and prefetch
      processQueue().then(() => prefetchTransits());

      // Hide banner after 3 seconds
      setTimeout(() => {
        if (isOnline && offlineBanner) {
          offlineBanner.style.display = 'none';
        }
      }, 3000);
    }
  }

  function showNotification(message) {
    if (!offlineBanner) return;
    offlineBanner.querySelector('.offline-text').textContent = message;
    offlineBanner.style.display = 'block';
    setTimeout(() => {
      if (isOnline && offlineBanner) offlineBanner.style.display = 'none';
    }, 3000);
  }

  // ─── Cache cleanup ───────────────────────────────────────────────

  /**
   * Remove transit cache entries older than 14 days.
   */
  async function cleanupStaleCache() {
    try {
      const allTransits = await idbGetAll(STORE_TRANSITS);
      const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
      let removed = 0;
      for (const entry of allTransits) {
        if (entry.fetchedAt < cutoff) {
          await idbDelete(STORE_TRANSITS, entry.date);
          removed++;
        }
      }
      if (removed > 0) console.log(`[offline] Cleaned ${removed} stale transit entries`);
    } catch { /* non-critical */ }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Get cache stats for debugging / health display.
   */
  async function getCacheStats() {
    try {
      const transits = await idbGetAll(STORE_TRANSITS);
      const charts = await idbGetAll(STORE_CHARTS);
      const queue = await idbGetAll(STORE_SYNC);
      return {
        transitDaysCached: transits.length,
        chartsCached: charts.length,
        queuedActions: queue.length,
        oldestTransit: transits.length > 0
          ? transits.reduce((min, e) => e.fetchedAt < min ? e.fetchedAt : min, Infinity)
          : null,
        isOnline,
      };
    } catch {
      return { error: 'IndexedDB unavailable' };
    }
  }

  // ─── Intercept API calls for offline support ─────────────────────

  /**
   * Wrap the existing apiFetch to intercept transit and chart requests
   * when offline, returning cached data instead.
   */
  function installOfflineInterceptor() {
    const originalFetch = window.apiFetch;
    if (!originalFetch) return;

    window.apiFetch = async function offlineFetch(path, options) {
      // If online, fetch normally but cache the response
      if (isOnline) {
        try {
          const result = await originalFetch(path, options);

          // Cache transit responses
          if (path.startsWith('/api/transits/today') && result && result.ok) {
            cacheTransit(todayISO(), result);
          }

          // Cache chart responses
          if (path.startsWith('/api/chart/') && result && result.ok && result.data) {
            const chartId = result.data.id || 'last';
            cacheChart(chartId, result.data);
          }

          return result;
        } catch (err) {
          // Network failed — try offline fallback
          if (!navigator.onLine) {
            return handleOfflineRequest(path, options);
          }
          throw err;
        }
      }

      // Offline — return cached data
      return handleOfflineRequest(path, options);
    };
  }

  async function handleOfflineRequest(path, options) {
    // Transit request
    if (path.startsWith('/api/transits/today')) {
      const data = await getTransits();
      if (data) return data;
      return { ok: false, error: 'No cached transit data available' };
    }

    // Chart request
    if (path.startsWith('/api/chart/') && (!options || options.method === 'GET' || !options.method)) {
      const chart = await getChart('last');
      if (chart) return { ok: true, data: chart, _cached: true };
      return { ok: false, error: 'No cached chart data available' };
    }

    // POST requests: queue for sync
    if (options && options.method === 'POST') {
      const action = path.includes('/diary') ? 'diary-entry'
                   : path.includes('/checkin') ? 'checkin'
                   : path.includes('/chart/save') ? 'save-chart'
                   : null;
      if (action) {
        try {
          const payload = options.body ? JSON.parse(options.body) : {};
          await queueForSync(action, payload);
          return { ok: true, _queued: true, message: 'Queued for sync when online' };
        } catch { /* fall through */ }
      }
    }

    return { ok: false, error: 'Offline — this feature requires an internet connection' };
  }

  // ─── Initialize ──────────────────────────────────────────────────

  async function init() {
    try {
      await openDB();
    } catch (err) {
      console.warn('[offline] IndexedDB not available:', err.message);
      return;
    }

    // Online/offline listeners
    window.addEventListener('online', () => updateOnlineStatus(true));
    window.addEventListener('offline', () => updateOnlineStatus(false));

    // Install the fetch interceptor
    // Delay slightly to ensure apiFetch is defined by the main script
    setTimeout(() => {
      installOfflineInterceptor();
    }, 100);

    // Show banner if currently offline
    if (!navigator.onLine) {
      updateOnlineStatus(false);
    }

    // Background tasks (only when online)
    if (isOnline) {
      // Prefetch 7 days of transits (delayed to not block initial load)
      setTimeout(() => prefetchTransits(), 5000);

      // Cleanup stale cache
      setTimeout(() => cleanupStaleCache(), 10000);
    }
  }

  // ─── Expose API ──────────────────────────────────────────────────

  window.offlineTransits = {
    getTransits,
    getChart,
    cacheChart,
    cacheTransit,
    queueForSync,
    processQueue,
    getCacheStats,
    prefetchTransits,
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
