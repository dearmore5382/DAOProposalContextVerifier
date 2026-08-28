# DAO Proposal Context Verifier

DAO voters often approve a proposal that links to a forum post, document, or snapshot. That external context can change after the vote. This project adds a GenLayer semantic execution gate: the proposal is executable only when validators independently fetch the referenced source and agree that its meaning is still unchanged.

## What the project does

1. A creator records a proposal title, source URL, locked content hash, quorum, and deadline.
2. DAO members cast `FOR` or `AGAINST` votes on-chain.
3. Before execution, GenLayer validators fetch the source and return one bounded verdict: `UNCHANGED`, `MATERIAL_CHANGE`, or `SOURCE_UNAVAILABLE`.
4. The contract derives the lifecycle state deterministically. Only `UNCHANGED + quorum reached + majority FOR` can become `EXECUTED`.

The contract is an authorization gate. It does not custody USDC/GEN or transfer treasury funds; an authorized multisig can use the recorded execution receipt after the gate opens.

## Live deployment

- Frontend: https://dao-proposal-context-verifier.pages.dev
- Cloudflare deployment: https://2b0a5394.dao-proposal-context-verifier.pages.dev
- Contract: `0x6b3FaC51490D9147f599B8e7F2d7536981A3792c`
- Network: GenLayer Studionet (`https://studio.genlayer.com/api`)
- Explorer: https://explorer-studio.genlayer.com/address/0x6b3FaC51490D9147f599B8e7F2d7536981A3792c

## Repository layout

```text
contracts/DAOProposalContextVerifier.py  GenLayer Intelligent Contract
src/main.js                              genlayer-js frontend integration
src/styles.css, src/layout.css           UI styles
scripts/lifecycle.mjs                    signed Studionet lifecycle runner
tests/test_contract_static.py             contract rule/static tests
verification/fixtures/                   immutable evidence fixture
```

## Local build and run

Requirements: Node.js 18+, Python 3.10+, and a wallet extension for browser writes.

```powershell
npm install
Copy-Item .env.example .env.local
```

Set `.env.local` (never commit it):

```dotenv
VITE_CONTRACT_ADDRESS=0x6b3FaC51490D9147f599B8e7F2d7536981A3792c
VITE_RPC_URL=https://studio.genlayer.com/api
VITE_CHAIN_ID=61999
```

Run the frontend:

```powershell
npm run dev
```

Then open the Vite URL, connect a wallet on Studionet, and use the four pages in order: Create → Vote → Verify → Execute.

Production build verification:

```powershell
npm run build
```

## Contract verification

The contract follows the workspace GenLayer rules: pinned `v0.2.16` dependency header, deterministic storage, flat `u256`/`str` public API, explicit validation, and nondeterministic web/LLM work only inside `gl.eq_principle.strict_eq`.

```powershell
python -c "import ast; ast.parse(open('contracts/DAOProposalContextVerifier.py', encoding='ascii').read()); print('AST PASS')"
pytest -q
```

The static suite checks the required header/imports, storage profile, bounded verdict enum, strict-equality usage, fail-closed behavior, and deterministic verification notes. Current result: **4 passed**.

## Evidence-based Studionet lifecycle test

The repeatable runner is `scripts/lifecycle.mjs`. It uses two funded test accounts from `.env.lifecycle` (ignored by Git), sends real signed transactions through `genlayer-js`, waits for finalized receipts, and prints transaction hash, consensus status, execution result, and readback. It never deploys a contract.

```powershell
npm run test:lifecycle
```

The successful run against the deployed contract used an immutable Pinata/IPFS fixture:

- CID: `QmXNfmPY8zBDra49NmLA9vnFAVHiygBLTJMhwHAMEfxYos`
- Gateway: https://gateway.pinata.cloud/ipfs/QmXNfmPY8zBDra49NmLA9vnFAVHiygBLTJMhwHAMEfxYos
- Gateway SHA-256: `0018052f7b3fadd0fb7f2e79658b15256423b590935025173f598a301bdcf559`

### Final positive-path receipt set

| Step | Result | Transaction hash |
|---|---|---|
| Create proposal | `VOTING\|UNVERIFIED\|0\|0` | `0x01db8a1d20f9e90a40c09d417018a9067b5eaee42e51009d8bc4c487ac6b47b7` |
| Vote wallet A | `VOTING\|UNVERIFIED\|1\|0` | `0xc877754b368d6753f5f345a4659d3d582ee240ded31cc0dcd66b468b8233417b` |
| Vote wallet B | `VOTING\|UNVERIFIED\|2\|0` | `0xa35e5ce07404b32fa6370219b351f945306b1154a3d483bd8888f650550f7d94` |
| Verify context | `READY\|UNCHANGED\|2\|0` | `0x7ca545eb2f8b298d0163b98508686dd0be04e5eb38a1841a739cd217433a95f1` |
| Execute receipt | `EXECUTED\|UNCHANGED\|2\|0` | `0x2d4f211650b308c913306169d3dd06a3b30d7bcb2ae26db719d09be8fc645140` |

This proves the complete state transition:

```text
CREATE → VOTE A → VOTE B → VERIFY UNCHANGED → EXECUTED
```

Negative-path tests were also observed during development: malformed deadlines return `INVALID_DEADLINE`, unavailable sources return `SOURCE_UNAVAILABLE`, material changes remain blocked, and failed verification leaves the proposal state unchanged.

## Consensus safety notes

The LLM is not allowed to write arbitrary prose into consensus state. Its response is normalized to bounded facts before `strict_eq`; the contract stores only deterministic notes (`UNCHANGED_VERIFIED`, `MATERIAL_CHANGE_DETECTED`, or `SOURCE_UNAVAILABLE`). Markdown-fenced JSON is normalized, and malformed JSON fails closed.

## Scope and limitations

- This is an execution-authorization gate, not a treasury or token escrow.
- Source availability depends on validator network access; immutable IPFS/Arweave publications are preferred over mutable dashboards.
- Semantic verification is performed before execution and is not a continuous monitor.
- Test private keys and API tokens must never be reused for real funds and must be rotated after testing.
