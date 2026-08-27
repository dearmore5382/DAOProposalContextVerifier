# DAO Proposal Context Verifier

A GenLayer-powered Dapp that detects material changes to external DAO proposal context before execution.

## Run locally

```powershell
npm install
npm run dev
```

Set `VITE_CONTRACT_ADDRESS` and `VITE_RPC_URL` in `.env.local`. The UI reads and writes the deployed contract; it does not simulate proposal state.
