import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(gameRoot, 'public', 'config', 'addresses.json');

function resolveAddress(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) return value;
  }
  return '';
}

const shellRunners = resolveAddress([
  'NEXT_PUBLIC_SHELLRUNNERS_ADDRESS',
  'SHELLRUNNERS_ADDRESS',
]);
const market = resolveAddress([
  'NEXT_PUBLIC_MOLTBOT_MARKET_ADDRESS',
  'NEXT_PUBLIC_SHELLRUNNERS_MARKET_ADDRESS',
  'MARKET_ADDRESS',
]);
const identity = resolveAddress([
  'NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS',
  'MOLTBOT_IDENTITY_ADDRESS',
  'IDENTITY_ADDRESS',
]);
const rewards = resolveAddress([
  'NEXT_PUBLIC_MOLTBOT_REWARDS_ADDRESS',
  'MOLTBOT_REWARDS_ADDRESS',
  'REWARDS_ADDRESS',
]);
const popt = resolveAddress([
  'NEXT_PUBLIC_MOLTBOT_POPT_ADDRESS',
  'MOLTBOT_POPT_ADDRESS',
  'POPT_ADDRESS',
]);

const missing = [];
if (!shellRunners) missing.push('shellRunners');
if (!market) missing.push('market');
if (!identity) missing.push('identity');
if (!rewards) missing.push('rewards');
if (!popt) missing.push('popt');

if (missing.length > 0) {
  console.error(`Missing required addresses in env: ${missing.join(', ')}`);
  console.error('Set NEXT_PUBLIC_* contract vars (or matching fallback vars), then rerun.');
  process.exitCode = 1;
} else {
  const payload = {
    shellRunners,
    market,
    identity,
    rewards,
    popt,
    poptId: String(process.env.NEXT_PUBLIC_MOLTBOT_POPT_ID || '').trim(),
    identityId: String(process.env.NEXT_PUBLIC_MOLTBOT_IDENTITY_ID || '').trim(),
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Updated ${target}`);
}
