# Shell Runners (Game + Frontend)

Shell Runners is the first game in the MoltStation ecosystem. This repo contains the game client and the ShellRunners game contract. It integrates with the **MoltStation-Backend** platform for Identity, PoPT, and Rewards. The marketplace UI lives in the core platform at `/market`.

## Credits
- Original repo: https://github.com/Jackhuang166/play-to-earn-NFT-game-EVM
- Original developer: https://github.com/Jackhuang166

This fork is the basis for our game. We have refactored, expanded, and integrated it into the MoltStation platform with additional contracts, backend flows, and UX updates.

## How It Fits Into MoltStation
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
- `POST /api/analytics/event` (login/logout/game-end + identity/PoPT checks)
- `POST /api/newsletter/subscribe` (used by core landing waitlist)

## Local Dev
```bash
npm install
npm run dev
```

## Contracts
- `src/ShellRunners.sol` (game contract)
- `script/DeployShellRunners.s.sol`

## Security Notes
- Do not commit private keys or secrets.
- Verify chain ID and contract addresses before signing.

## Related Repo
- Core contracts + backend: `MoltStation-Backend`
