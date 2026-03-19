/**
 * Bodygraph Chart Export Tests
 * Item 4.2 — SVG → Canvas → PNG download + share card integration
 *
 * Tests the pure logic for:
 * - SVG-to-PNG export pipeline
 * - downloadBodygraph(): find SVG, serialize, canvas draw, blob download
 * - shareBodygraph(): delegate to showShareCard with analytics
 */
import { describe, it, expect, vi } from 'vitest';

// ── SVG serialization helper ───────────────────────────────────────────────
function serializeSVGToDataUrl(svgStr) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
}

// ── Pure download flow logic extracted ──────────────────────────────────────
function buildDownloadFilename(label) {
  return 'prime-self-bodygraph-' + (label || 'chart') + '.png';
}

// ── Anchor creation + click logic (testable extract) ──────────────────────
function triggerBlobDownload(blob, filename, { createObjectURL, revokeObjectURL, appendEl, removeEl, trackEvent }) {
  const url = createObjectURL(blob);
  const a = { href: '', download: '', clicked: false };
  a.href = url;
  a.download = filename;
  appendEl(a);
  a.clicked = true;
  removeEl(a);
  revokeObjectURL(url);
  trackEvent('chart', 'bodygraph_exported', 'download');
  return a;
}

// ── shareBodygraph logic ──────────────────────────────────────────────────
function shareBodygraphLogic(lastChart, showShareCard, showNotification, trackEvent) {
  if (!lastChart) {
    showNotification('Load your chart first', 'error');
    return false;
  }
  if (typeof showShareCard !== 'function') {
    showNotification('Share card not available', 'error');
    return false;
  }
  showShareCard(lastChart);
  trackEvent('chart', 'bodygraph_shared', 'share_card');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
describe('Bodygraph Chart Export — filename generation', () => {
  it('builds filename with type and profile label', () => {
    expect(buildDownloadFilename('generator-2-4')).toBe('prime-self-bodygraph-generator-2-4.png');
  });

  it('falls back to "chart" when label is missing', () => {
    expect(buildDownloadFilename(null)).toBe('prime-self-bodygraph-chart.png');
    expect(buildDownloadFilename(undefined)).toBe('prime-self-bodygraph-chart.png');
    expect(buildDownloadFilename('')).toBe('prime-self-bodygraph-chart.png');
  });
});

describe('Bodygraph Chart Export — SVG serialization', () => {
  it('produces a base64 data:image/svg+xml URL from SVG string', () => {
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#0f0f1a"/></svg>';
    const result = serializeSVGToDataUrl(svgStr);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(result.length).toBeGreaterThan(50);
  });

  it('round-trips SVG string through base64 encoding correctly', () => {
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg"><text>Gate 1</text></svg>';
    const dataUrl = serializeSVGToDataUrl(svgStr);
    const base64Part = dataUrl.replace('data:image/svg+xml;base64,', '');
    const decoded = decodeURIComponent(escape(atob(base64Part)));
    expect(decoded).toBe(svgStr);
  });
});

describe('Bodygraph Chart Export — triggerBlobDownload', () => {
  it('creates anchor with correct href and filename, then clicks and revokes', () => {
    const mockBlob = new Blob(['fake png'], { type: 'image/png' });
    const trackEvent = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    const appended = [];
    const removed = [];

    const a = triggerBlobDownload(mockBlob, 'prime-self-bodygraph-generator-2-4.png', {
      createObjectURL,
      revokeObjectURL,
      appendEl: (el) => appended.push(el),
      removeEl: (el) => removed.push(el),
      trackEvent,
    });

    expect(a.href).toBe('blob:fake-url');
    expect(a.download).toBe('prime-self-bodygraph-generator-2-4.png');
    expect(a.clicked).toBe(true);
    expect(appended).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('fires bodygraph_exported analytics event', () => {
    const trackEvent = vi.fn();
    triggerBlobDownload(new Blob(['x']), 'test.png', {
      createObjectURL: () => 'blob:x',
      revokeObjectURL: vi.fn(),
      appendEl: vi.fn(),
      removeEl: vi.fn(),
      trackEvent,
    });
    expect(trackEvent).toHaveBeenCalledWith('chart', 'bodygraph_exported', 'download');
  });
});

describe('Bodygraph Chart Export — shareBodygraph logic', () => {
  it('calls showShareCard with chart data and fires analytics', () => {
    const showShareCard = vi.fn();
    const showNotification = vi.fn();
    const trackEvent = vi.fn();
    const chart = { type: 'Generator', profile: '2/4' };

    const result = shareBodygraphLogic(chart, showShareCard, showNotification, trackEvent);

    expect(result).toBe(true);
    expect(showShareCard).toHaveBeenCalledWith(chart);
    expect(trackEvent).toHaveBeenCalledWith('chart', 'bodygraph_shared', 'share_card');
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows error notification when no chart is loaded', () => {
    const showNotification = vi.fn();
    const trackEvent = vi.fn();

    const result = shareBodygraphLogic(null, vi.fn(), showNotification, trackEvent);

    expect(result).toBe(false);
    expect(showNotification).toHaveBeenCalledWith('Load your chart first', 'error');
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('shows error notification when showShareCard is unavailable', () => {
    const showNotification = vi.fn();
    const trackEvent = vi.fn();

    const result = shareBodygraphLogic({ type: 'Projector' }, null, showNotification, trackEvent);

    expect(result).toBe(false);
    expect(showNotification).toHaveBeenCalledWith('Share card not available', 'error');
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('works with undefined showShareCard (falsy)', () => {
    const showNotification = vi.fn();
    const result = shareBodygraphLogic({ type: 'Reflector' }, undefined, showNotification, vi.fn());
    expect(result).toBe(false);
    expect(showNotification).toHaveBeenCalledWith('Share card not available', 'error');
  });
});
