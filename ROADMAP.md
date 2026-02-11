# MoltStation ShellRunners Roadmap

## Current Status (2026-02-11)
1. Repo split from previous combined setup completed --DONE
2. ShellRunners client + contract code moved into dedicated game repo --DONE
3. Env template added (`.env.example`) --DONE
4. Vercel deployment checklist added (`DEPLOYMENT_CHECKLIST.md`) --DONE
5. Backend signing/mint flow redirected to backend service endpoint --DONE

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
