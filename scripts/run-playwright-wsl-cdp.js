import { spawn } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const DEBUG_PORT = 9222;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}/json/version`;
const BROWSER_PATHS = [
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
  '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unexpected response ${response.status} from ${url}`);
  }

  return response.json();
}

async function waitForWebSocketEndpoint(retries = 40, delayMs = 500) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const payload = await fetchJson(DEBUG_URL);
      if (payload.webSocketDebuggerUrl) {
        return payload.webSocketDebuggerUrl;
      }
      lastError = new Error('DevTools endpoint missing webSocketDebuggerUrl');
    } catch (error) {
      lastError = error;
    }

    await sleep(delayMs);
  }

  throw lastError ?? new Error('Timed out waiting for Windows browser CDP endpoint');
}

async function closeBrowser(wsEndpoint) {
  if (!wsEndpoint) {
    return;
  }

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.connectOverCDP(wsEndpoint);
    await browser.close();
  } catch {
  }
}

function findWindowsBrowser() {
  return BROWSER_PATHS.find((browserPath) => fs.existsSync(browserPath));
}

async function run() {
  const executablePath = findWindowsBrowser();

  if (!executablePath) {
    console.error('No Windows Chrome or Edge executable found from WSL.');
    process.exit(1);
  }

  let wsEndpoint;

  try {
    const existing = await fetchJson(DEBUG_URL);
    wsEndpoint = existing.webSocketDebuggerUrl;
  } catch {
  }

  if (!wsEndpoint) {
    const browserArgs = [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=C:\\temp\\hd-playwright-profile',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ];

    const browserProcess = spawn(executablePath, browserArgs, {
      stdio: 'ignore',
      detached: true,
    });
    browserProcess.unref();

    wsEndpoint = await waitForWebSocketEndpoint();
  }

  const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];
  const testProcess = spawn('npx', playwrightArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_WS_ENDPOINT: wsEndpoint,
    },
  });

  const exitCode = await new Promise((resolve, reject) => {
    testProcess.on('error', reject);
    testProcess.on('exit', (code) => resolve(code ?? 1));
  });

  await closeBrowser(wsEndpoint);
  process.exit(exitCode);
}

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  try {
    const payload = await fetchJson(DEBUG_URL);
    await closeBrowser(payload.webSocketDebuggerUrl);
  } catch {
  }
  process.exit(1);
});