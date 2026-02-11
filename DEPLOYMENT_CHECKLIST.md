# MoltStation ShellRunners Deployment Checklist (Vercel)

## 1) Preflight
1. `npm install`
2. `npm run build`
3. Confirm `public/config/addresses.json` has deployed addresses.
4. Confirm backend URL is reachable from browser.

## 2) Vercel Setup
1. Create Vercel project.
2. Root directory: `MoltStation-ShellRunners`.
3. Install command: `npm install`.
4. Build command: `npm run build`.
5. Output: default Next.js output.

## 3) Required Env Vars
1. `NEXT_PUBLIC_MOLTBOT_API_URL`
2. `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`
3. `NEXT_PUBLIC_CORE_LANDING_URL`

## 4) Strongly Recommended Env Vars
1. `NEXT_PUBLIC_MOLTBOT_MARKET_ADDRESS`
2. `NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS`
3. `NEXT_PUBLIC_MOLTBOT_REWARDS_ADDRESS`
4. `NEXT_PUBLIC_MOLTBOT_POPT_ADDRESS`
5. `NEXT_PUBLIC_SHELLRUNNERS_ADDRESS`

## 5) Smoke Checks
1. Wallet connect works on Base Sepolia.
2. Identity gating blocks game start when no identity is owned.
3. Start session + score snapshot updates scorebank.
4. Payout button and cooldown render correctly.
5. Marketplace links route to core `/market`.
