import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function applyEnvAlias(targetKey, sourceKeys) {
  if (process.env[targetKey] !== undefined) {
    return;
  }

  for (const sourceKey of sourceKeys) {
    const value = process.env[sourceKey];
    if (value !== undefined && value !== '') {
      process.env[targetKey] = value;
      return;
    }
  }
}

export function loadLocalEnv(filename = '.env.local') {
  const envPath = resolve(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return false;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }

  applyEnvAlias('CF_API_TOKEN', ['CLOUDFLARE_API']);
  applyEnvAlias('CLOUDFLARE_API', ['CF_API_TOKEN']);
  applyEnvAlias('CF_ACCOUNT_ID', ['CLOUDFLARE_ACCOUNT_ID', 'CLOUFLARE_ACCOUNT_ID']);
  applyEnvAlias('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID', 'CLOUFLARE_ACCOUNT_ID']);
  applyEnvAlias('CLOUFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']);

  return true;
}