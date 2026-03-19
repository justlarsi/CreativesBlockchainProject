# Phase 1 Step 6 Evidence

Date: 2026-03-19
Status: Mostly Done (awaiting additional faucet funds for full Amoy deployment)

## Implemented Scope

- Step 6 contracts are implemented and aligned to approved scope:
  - `IPRegistry`: registration + verification events/reads
  - `LicenseAgreement`: minimal purchase + validation behavior (no Step 9 payout linkage)
  - `CollaborativeWork`: deployable split/event primitives only (no Step 12 approval/payout mechanics)
- Duplicate collaborator validation fixed in `CollaborativeWork`.
- Contract tests updated for indexed-string event decoding and bigint return assertions.
- Hardhat toolchain pinned explicitly to compatible versions for Step 6 quality gates:
  - `hardhat@2.26.3`
  - `@nomicfoundation/hardhat-ethers@3.1.0`
  - `@nomicfoundation/hardhat-verify@2.1.1`
  - `solidity-coverage@0.8.16`
- `solidity-coverage` wired in `hardhat.config.ts` and coverage gate enforced via `scripts/check-coverage.js`.
- Slither config and package script are committed:
  - `contracts/slither.config.json`
  - `npm run analyze`
- Single shared ABI source is enforced through `packages/contract-artifacts` using `contracts/scripts/export-abis.js`.
- Private key format handling accepts both 0x-prefixed and raw 64-char hex values in Hardhat config.

## Verification Run Log

- `npm run compile` -> pass
- `npm run test` -> pass (**11/11 tests**)
- `npm run coverage` -> pass (**100% statements/branches/functions/lines**)
- `npm run export:abis` -> pass (generated ABIs + typed exports in `packages/contract-artifacts`)
- `npm run analyze` -> pass (**0 high/critical findings**; 4 informational detectors: locked-ether in LicenseAgreement, uninitialized-local in CollaborativeWork, timestamp usage warnings)
- `npm run deploy:amoy` -> partial (IPRegistry deployed at `0xbf559FA83ecB20f65030CF1265E2E65a12d67be3` on Amoy; LicenseAgreement + CollaborativeWork deployment blocked due to faucet account insufficient gas)
- `npm run verify:amoy` -> pending (awaiting successful deployment of all contracts)
- **Node 20 compatibility verified:** compile, test, coverage all pass with identical output (no breaking changes)

## Shared Artifact Output

Generated and present:

- `packages/contract-artifacts/abi/IPRegistry.json`
- `packages/contract-artifacts/abi/LicenseAgreement.json`
- `packages/contract-artifacts/abi/CollaborativeWork.json`
- `packages/contract-artifacts/index.js`
- `packages/contract-artifacts/index.d.ts`
- `packages/contract-artifacts/addresses/amoy.json` (IPRegistry populated; LicenseAgreement and CollaborativeWork pending additional gas funding)

## Known Findings (Non-Blocking)

**Slither detectors:**
- `locked-ether`: LicenseAgreement accepts payment but has no withdrawal mechanism (acceptable for Step 6 minimal scope; withdrawal added in Step 9 payout linkage).
- `uninitialized-local`: `totalBps` in CollaborativeWork not initialized (false positive; loop summation is safe).
- `timestamp`: Usage in IPRegistry and LicenseAgreement (acceptable for registration/expiration checks).

## Remaining Preconditions to Mark Step 6 Done

1. Obtain additional MATIC on faucet for the deployer account (`0x...` from PRIVATE_KEY) to cover gas for LicenseAgreement and CollaborativeWork deployment (~2x current transaction costs).
2. Re-run `npm run deploy:amoy` to complete deployments.
3. Run `npm run verify:amoy` to submit all three contracts to Polygonscan verification.
4. Re-run `npm run export:abis` to refresh shared artifact addresses.
5. Commit updated `packages/contract-artifacts/addresses/amoy.json` with all three deployed addresses and final timestamp.

## Notes

- Slither binary source: `/home/darkduty/project/backend/.venv/bin/slither` (installed in backend venv via `requirements.txt: slither-analyzer==0.11.5`).
- Backend `requirements.txt` also includes `eth-account==0.13.7` for Web3 integration (Step 7+).
- Node 20.20.1 verified compatible; no changes to contracts toolchain needed (all tests/coverage pass identically).


