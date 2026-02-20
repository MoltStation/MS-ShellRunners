# MoltStation ShellRunners Roadmap

## Current Status (2026-02-15)
1. Repo split from previous combined setup completed --DONE
2. ShellRunners client + contract code moved into dedicated game repo --DONE
3. Env template added (`.env.example`) --DONE
4. Vercel deployment checklist added (`DEPLOYMENT_CHECKLIST.md`) --DONE
5. Backend signing/mint flow redirected to backend service endpoint --DONE
6. Game now sends analytics events (login/logout/game-end + identity/PoPT checks) to backend Mongo tracking --DONE
7. Analytics route switched to neutral endpoint (`/api/events/track`) to avoid client-side blocker false-positives --DONE
8. Core web routes are now hosted in `MoltStation-Frontend`; ShellRunners repo is runtime-focused --DONE
9. Legacy core pages removed from runtime repo --DONE
10. Runtime root now redirects to `/shellrunners` (`/game` kept as compatibility redirect) --DONE
11. TypeScript build bypass removed from `next.config.js` --DONE
12. Runtime quality gates added (`lint`, `typecheck`, `build`) --DONE
13. Embedded runtime exit flow implemented (`Exit Game` + parent `postMessage` close) --DONE
14. Runtime startup stabilized to prevent scene reboot/flicker during live telemetry refresh --DONE
15. Embedded wallet gate added (`Connect Wallet` overlay before runtime start) --DONE
16. Pause/resume logic fixed (removed global tween/time freeze deadlock) --DONE
17. Audio playback now defers safely until browser unlock gesture (BGM/SFX stability) --DONE
18. Default dev port pinned to `3002` to avoid local port collisions with core frontend --DONE
19. Vercel runtime hosting scaffolding added (`vercel.json`, `.vercelignore`) --DONE

## Open Product/Architecture Decision
1. Re-discuss NFT model:
2. Current model: Identity NFT + ShellRunner NFT + PoPT NFT.
3. Requested model candidate: PoPT and ShellRunner merged into one NFT.
4. If merged, contracts, mint/update flow, and UI copy must be redesigned and redeployed.

## Next Steps
1. Finalize single-NFT vs multi-NFT decision.
2. Lock final game session/snapshot/highscore mint/update rules.
3. Finalize marketplace UX for single owned runner per wallet/agent.
4. Run full e2e test pass against deployed Base Sepolia contracts.
5. Add explicit UI telemetry for failed snapshot/payout retries.
6. Replace GPU browser bundle with a Turbopack-friendly import path to remove remaining build warnings.
## 2026-02-20 Update
1. Identity transfer + listing guard for open payouts implemented across contracts/UI. --DONE
2. Deployed new MSID + Rewards on Base Sepolia and rewired required roles. --DONE
3. Updated local + Railway + Vercel env addresses to new MSID/Rewards. --DONE
