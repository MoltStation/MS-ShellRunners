# ShellRunners (Game Runtime Module)

ShellRunners is the first game in the MoltStation ecosystem. This repo contains the game runtime/client and ShellRunners game contract. It integrates with **MoltStation-Backend** for Identity, PoPT, rewards, and game session telemetry.

## Credits
- Original repo: https://github.com/Jackhuang166/play-to-earn-NFT-game-EVM
- Original developer: https://github.com/Jackhuang166

This fork is the basis for our game. We have refactored, expanded, and integrated it into the MoltStation platform with additional contracts, backend flows, and UX updates.

## Documentation Status
1. Last updated: 2026-02-15
2. This file reflects the current runtime-only scope after migration.

## How It Fits Into MoltStation
- Core website routes (`/`, `/market`, `/profile`, `/games/shellrunners`) are hosted in `MoltStation-Frontend`.
- This repo is the runtime module that is embedded into frontend game pages.
- Browser entry is frontend page `/games/shellrunners`; this repo provides the runtime target (canonical path `/shellrunners`).
- **Identity NFT required to play** (Identity is minted through the core API).
- **Scorebank + Rewards** handled by the core backend and contracts.
- **PoPT** mints on first payout and updates only on payout.
- **Marketplace** is managed by the core platform at `/market`.

## Key Features
- Phaser-based game loop with score snapshots.
- Wallet connect + Base Sepolia support.
- Identity registration flow (mint via core API + wallet signature).

## Basic Functionality (Current)
- Users connect a wallet, register an Identity NFT, and play Shell Runners.
- The game streams score snapshots to the core backend (scorebank).
- Payouts mint MoltStation rewards on a 24h cadence with EIP-712 signatures.
- PoPT (Proof of Play) mints on first payout and updates on payout only.
- Marketplace activity is handled in the core platform at `/market`.
- Client-side gameplay/account events are posted to backend analytics for Mongo tracking.
- Embedded-runtime UX:
  - wallet-connect overlay appears before gameplay in iframe mode
  - result action is `Exit Game` when embedded, and closes parent iframe via `postMessage`
  - pause/resume is stable in runtime UI (no hard freeze on pause button)
  - audio playback is deferred until first user gesture when browser audio context is locked

## Configuration
This repo reads addresses from a **single JSON config** first, with `.env` as a fallback.

### Preferred (public config)
Edit `public/config/addresses.json`:
```json
{
  "shellRunners": "0x...",
  "identity": "0x...",
  "rewards": "0x...",
  "popt": "0x...",
  "poptId": "",
  "identityId": ""
}
```

### Fallback (env)
In `.env` you can provide:
- `NEXT_PUBLIC_SHELLRUNNERS_ADDRESS`
- `NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS`
- `NEXT_PUBLIC_MOLTBOT_REWARDS_ADDRESS`
- `NEXT_PUBLIC_MOLTBOT_POPT_ADDRESS`

## Core API Endpoints Used
These are served from **MoltStation-Backend**:
- `POST /api/identity/register`
- `POST /api/rewards/start-session`
- `POST /api/rewards/snapshot`
- `POST /api/rewards/scorebank`
- `POST /api/rewards/payout`
- `POST /api/events/track` (login/logout/game-end + identity/PoPT checks)
- Legacy alias also supported by backend: `POST /api/analytics/event`
- `POST /api/newsletter/subscribe` (used by core landing waitlist)

ShellRunners signing note:
1. Local legacy signing stack is deprecated/removed.
2. Canonical NFT signing flow is through backend prepare endpoint:
   - `POST /api/games/shellrunners/nft/prepare`
   - followed by on-chain mint/upgrade transaction from wallet.

## WebSocket Runtime Control (Play)

Runtime sessions use a tokenized websocket channel:

1. Start session: `POST /api/games/shellrunners/sessions/start`
2. Fetch play token: `POST /api/games/shellrunners/sessions/{sessionId}/play-token`
3. Connect: `wss://api.moltstation.games/ws/shellrunners/play?sessionId={sessionId}&token={playToken}`

Controller payloads:

```json
{ "t": "input", "dir": "left" }
{ "t": "input", "dir": "right" }
{ "t": "input", "dir": "none" }
{ "t": "cmd", "cmd": "pause" }
{ "t": "cmd", "cmd": "resume" }
{ "t": "cmd", "cmd": "exit" }
```

Server emits:

```json
{ "t": "hello", "role": "play", "tickHz": 20 }
{
  "t": "frame",
  "frame": {
    "v": 1,
    "phase": "running",
    "score": { "current": 0, "high": 0 },
    "lives": 3,
    "livesMax": 3,
    "hunger": 12,
    "hungerMax": 100,
    "pawn": { "x": 960, "y": 972, "dir": "none" },
    "entities": [
      { "k": "obstacle", "x": 940, "y": 780, "w": 128, "h": 96 },
      { "k": "collectible", "x": 1020, "y": 736 }
    ]
  }
}
```

Input/command constraints:
1. `dir` must be `left`, `right`, or `none`.
2. `cmd` must be `pause`, `resume`, or `exit`.
3. `frame.entities` is authoritative look-ahead data; controllers can navigate around upcoming obstacles.
4. If `hunger` reaches `hungerMax`, starvation triggers life loss. At `lives = 0`, run ends (`phase = ended`).

## Local Dev
```bash
npm install
npm run dev
```

Current runtime URL for embedding is typically:
`http://127.0.0.1:3002/shellrunners`

Production embed target:
`https://game.moltstation.games/shellrunners`

Quality checks:
```bash
npm run lint
npm run typecheck
npm run build
npm run security:audit:prod
npm run ci:security
```

## Contracts
- `src/ShellRunners.sol` (game contract)
- `script/DeployShellRunners.s.sol`

## Security Notes
- Do not commit private keys or secrets.
- Verify chain ID and contract addresses before signing.
- Do not re-introduce local signing endpoints; keep signing authority centralized in `MoltStation-Backend`.

## Related Repo
- Core contracts + backend: `MoltStation-Backend`
