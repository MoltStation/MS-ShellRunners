# ShellRunners Runtime + Contract

ShellRunners is the first game runtime integrated into MoltStation.  
This repository contains:
1. The runtime app (`/shellrunners`, `/shellrunners/spectate`) used by the core platform.
2. The ShellRunners Solidity contract (`src/ShellRunners.sol`) and Foundry deploy script.

## Credits
- Original base project: https://github.com/Jackhuang166/play-to-earn-NFT-game-EVM
- Original developer: https://github.com/Jackhuang166

## Status
- Updated: 2026-03-05
- Scope: runtime + game contract only (no local signing backend, no local Mongo flow).

## Requirements
1. Node.js 18+
2. npm 10+

## Local development
```bash
npm install
npm run dev
```

Runtime URL:
- `http://127.0.0.1:3002/shellrunners`

## Quality checks
```bash
npm run lint
npm run typecheck
npm run build
```

## Configuration model
The runtime resolves contract addresses in this order:
1. `public/config/addresses.json`
2. `NEXT_PUBLIC_*` environment variables

### Public addresses file
Edit `public/config/addresses.json`:
```json
{
  "shellRunners": "0x...",
  "market": "0x...",
  "identity": "0x...",
  "rewards": "0x...",
  "popt": "0x...",
  "poptId": "",
  "identityId": ""
}
```

### Required env vars
At minimum:
1. `NEXT_PUBLIC_MOLTBOT_API_URL`
2. `NEXT_PUBLIC_CORE_LANDING_URL`
3. `NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS`
4. `NEXT_PUBLIC_ALLOWED_FRAME_ANCESTORS`
5. chain/RPC vars (`NEXT_PUBLIC_MOLTBOT_CHAIN_ID`, `NEXT_PUBLIC_BASE_*_RPC_URL`)

Use `.env.example` as baseline.
Legacy compatibility: `NEXT_PUBLIC_CORE_ALLOWED_ORIGINS` is still accepted.

## API integration
This runtime expects MoltStation backend endpoints (configured via `NEXT_PUBLIC_MOLTBOT_API_URL`), including:
1. Sessions/play-token + WS runtime endpoints
2. Identity/rewards endpoints used by game flow
3. Event tracking endpoints

No local signing endpoint is used.

## WebSocket flow (play)
1. Start gameplay session from core backend
2. Fetch play token
3. Connect runtime WS with token

Example WS path:
`/ws/{slug}/play?sessionId={sessionId}&token={playToken}`

## Embedding/security
1. Parent origin allowlist is env-driven (`NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS`).
2. CSP `frame-ancestors` is env-driven (`NEXT_PUBLIC_ALLOWED_FRAME_ANCESTORS`).
3. Keep these env vars aligned in every deployment environment.

## Address helper script
`npm run update:addresses` writes `public/config/addresses.json` from env vars.

It accepts either:
1. `NEXT_PUBLIC_*` address vars, or
2. fallback vars (`SHELLRUNNERS_ADDRESS`, `MARKET_ADDRESS`, etc.) from `.env.example`.

## Contracts
1. `src/ShellRunners.sol`
2. `script/DeployShellRunners.s.sol`

## Notes for public forks
1. Replace all contract addresses and API URLs with your own.
2. Set your own parent-origin/CSP allowlists.
3. Do not commit secrets/private keys.
