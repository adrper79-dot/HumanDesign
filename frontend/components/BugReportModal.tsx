'use client';

import { useState } from 'react';

/**
 * Bug Report Form Component
 * 
 * Auto-captures:
 * - Browser & OS info
 * - Viewport size
 * - Current page URL
 * - Error stack traces
 * - Console logs
 * - Network failures
 * - Session context (if applicable)
 */

interface BugForm {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'chart_calc' | 'profile' | 'auth' | 'payment' | 'transit' | 'ui' | 'api' | 'other';
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  screenshotUrl?: string;
  includeDebugInfo: boolean;
}

interface CapturedDebugInfo {
  userAgent: string;
  browser: string;
  osName: string;
  viewportWidth: number;
  viewportHeight: number;
  pageUrl: string;
  timestamp: string;
  consoleLogs: any[];
  networkFailures: any[];
  errorStack?: string;
}

export default function BugReportModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<BugForm>({
    title: '',
    description: '',
    severity: 'medium',
    category: 'other',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    includeDebugInfo: true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const captureDebugInfo = (): CapturedDebugInfo => {
    // Browser detection
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let osName = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) osName = 'Windows';
    else if (ua.includes('Mac')) osName = 'macOS';
    else if (ua.includes('Linux')) osName = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';
    else if (ua.includes('Android')) osName = 'Android';

    // Capture console logs from memory
    const consoleLogs = window.__DEBUG_LOGS__ || [];

    // Detect network failures
    const networkFailures = (window as any).__NETWORK_ERRORS__ || [];

    return {
      userAgent: ua,
      browser,
      osName,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageUrl: window.location.href,
      timestamp: new Date().toISOString(),
      consoleLogs,
      networkFailures
    };
  };

  const handleScreenshot = async () => {
    try {
      if (typeof html2canvas !== 'undefined') {
        const canvas = await (window as any).html2canvas(document.body);
        const dataUrl = canvas.toDataURL('image/png');
        setForm(prev => ({ ...prev, screenshotUrl: dataUrl }));
      }
    } catch (err) {
      console.warn('Screenshot capture failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const debugInfo = form.includeDebugInfo ? captureDebugInfo() : {};

      const payload = {
        ...form,
        ...debugInfo
      };

      const response = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit bug report');
      }

      const result = await response.json();
      setSuccess(true);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-slate-600 mb-6">
            Your bug report has been submitted. Our team will investigate and get back to you.
          </p>
          <p className="text-sm text-slate-500">Closing in a moment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Report a Bug</h2>
              <p className="text-red-100 text-sm mt-1">Help us fix it • Takes 2 minutes</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 w-10 h-10 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Bug Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chart calculation shows wrong date"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Severity & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as any })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              >
                <option value="low">Low - Minor inconvenience</option>
                <option value="medium">Medium - Affects workflow</option>
                <option value="high">High - Breaks feature</option>
                <option value="critical">Critical - App unusable</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as any })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              >
                <option value="chart_calc">Chart Calculation</option>
                <option value="profile">Profile/Readings</option>
                <option value="auth">Authentication</option>
                <option value="payment">Payment/Billing</option>
                <option value="transit">Transits</option>
                <option value="ui">User Interface</option>
                <option value="api">API/Data</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              placeholder="What happened? Be specific and descriptive."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Steps to Reproduce <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              placeholder="1. Navigate to...
2. Click on...
3. Observe..."
              value={form.stepsToReproduce}
              onChange={e => setForm({ ...form, stepsToReproduce: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Expected Behavior
              </label>
              <input
                type="text"
                placeholder="What should happen?"
                value={form.expectedBehavior}
                onChange={e => setForm({ ...form, expectedBehavior: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Actual Behavior
              </label>
              <input
                type="text"
                placeholder="What actually happens?"
                value={form.actualBehavior}
                onChange={e => setForm({ ...form, actualBehavior: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Debug Info Toggle */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.includeDebugInfo}
                onChange={e => setForm({ ...form, includeDebugInfo: e.target.checked })}
                className="w-4 h-4 text-red-500 rounded"
              />
              <span className="text-sm text-slate-700">
                Include debug info (browser, console logs, network errors) — helps us fix faster
              </span>
            </label>
          </div>

          {/* Screenshot Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleScreenshot}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              📸 Capture Screenshot
            </button>
            {form.screenshotUrl && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                ✓ Screenshot captured
              </span>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
            >
              {loading ? 'Submitting...' : 'Submit Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
