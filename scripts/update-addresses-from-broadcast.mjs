import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// On Windows, `new URL(import.meta.url).pathname` yields `/C:/...` which breaks `path.*`.
const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(gameRoot, '..');
const coreRoot = path.join(workspaceRoot, 'MoltBotArena-Core');

const GAME_CHAIN_ID = process.env.MOLTBOT_CHAIN_ID ?? process.env.CHAIN_ID ?? '84532';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const findBroadcast = (root, scriptFile) => {
  const p = path.join(root, 'broadcast', scriptFile, String(GAME_CHAIN_ID), 'run-latest.json');
  if (!fs.existsSync(p)) return null;
  return p;
};

const extractAddresses = (runJsonPath) => {
  const run = readJson(runJsonPath);
  const txs = Array.isArray(run.transactions) ? run.transactions : [];
  const out = {};
  for (const tx of txs) {
    const name = tx.contractName;
    const addr = tx.contractAddress;
    if (typeof name === 'string' && typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      out[name] = addr;
    }
  }
  return out;
};

const coreCoreRun = findBroadcast(coreRoot, 'DeployMoltBotCore.s.sol');
const coreMarketRun = findBroadcast(coreRoot, 'DeployMoltBotMarket.s.sol');
const gameRun = findBroadcast(gameRoot, 'DeployShellRunners.s.sol');

if (!coreCoreRun || !coreMarketRun || !gameRun) {
  console.error('Missing Foundry broadcast outputs. Deploy first with --broadcast, then re-run this script.');
  console.error(`Expected files (chainId=${GAME_CHAIN_ID}):`);
  console.error(`- ${path.join(coreRoot, 'broadcast', 'DeployMoltBotCore.s.sol', String(GAME_CHAIN_ID), 'run-latest.json')}`);
  console.error(`- ${path.join(coreRoot, 'broadcast', 'DeployMoltBotMarket.s.sol', String(GAME_CHAIN_ID), 'run-latest.json')}`);
  console.error(`- ${path.join(gameRoot, 'broadcast', 'DeployShellRunners.s.sol', String(GAME_CHAIN_ID), 'run-latest.json')}`);
  process.exitCode = 1;
} else {
  const coreAddrs = extractAddresses(coreCoreRun);
  const marketAddrs = extractAddresses(coreMarketRun);
  const gameAddrs = extractAddresses(gameRun);

  const identity = coreAddrs.AgentIdentity;
  const rewards = coreAddrs.Rewards;
  const popt = coreAddrs.MoltBotArenaPoPT;
  const market = marketAddrs.MoltBotArenaMarket;
  const shellRunners = gameAddrs.ShellRunners;

  const missing = [];
  if (!shellRunners) missing.push('ShellRunners');
  if (!market) missing.push('MoltBotArenaMarket');
  if (!identity) missing.push('AgentIdentity');
  if (!rewards) missing.push('Rewards');
  if (!popt) missing.push('MoltBotArenaPoPT');

  if (missing.length > 0) {
    console.error(`Broadcast files found, but missing contract addresses for: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    const target = path.join(gameRoot, 'public', 'config', 'addresses.json');
    const payload = {
      shellRunners,
      market,
      identity,
      rewards,
      popt,
      poptId: '',
      identityId: '',
    };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Updated ${target}`);
  }
}
