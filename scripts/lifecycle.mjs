import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && !line.startsWith("#")) {
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv(process.env.LIFECYCLE_ENV || ".env.lifecycle");

const contractAddress = process.env.CONTRACT_ADDRESS;
const rpcUrl = process.env.RPC_URL || "https://studio.genlayer.com/api";
const keyA = process.env.WALLET_A_PRIVATE_KEY;
const keyB = process.env.WALLET_B_PRIVATE_KEY;
const contextUrl = process.env.CONTEXT_URL || "https://example.com/";
const contextTitle = process.env.CONTEXT_TITLE || `Lifecycle evidence proposal ${Date.now()}`;

if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress || "")) throw new Error("CONTRACT_ADDRESS is missing or invalid");
if (!/^(0x)?[0-9a-fA-F]{64}$/.test(keyA || "") || !/^(0x)?[0-9a-fA-F]{64}$/.test(keyB || "")) {
  throw new Error("Both lifecycle wallet private keys are required");
}

const accountA = createAccount(keyA.startsWith("0x") ? keyA : `0x${keyA}`);
const accountB = createAccount(keyB.startsWith("0x") ? keyB : `0x${keyB}`);
const reader = createClient({ chain: studionet, endpoint: rpcUrl });
const writerA = createClient({ chain: studionet, endpoint: rpcUrl, account: accountA });
const writerB = createClient({ chain: studionet, endpoint: rpcUrl, account: accountB });

console.log(`Contract: ${contractAddress}`);
console.log(`Wallet A: ${accountA.address}`);
console.log(`Wallet B: ${accountB.address}`);

async function state(id) {
  return reader.readContract({ address: contractAddress, functionName: "proposal_state", args: [BigInt(id)], stateStatus: "accepted" });
}

async function findNextProposalId(limit = 100) {
  for (let id = 0; id < limit; id += 1) if ((await state(id)) === "NOT_FOUND") return id;
  throw new Error(`No free proposal id found below ${limit}`);
}

async function transact(client, label, functionName, args) {
  const hash = await client.writeContract({ address: contractAddress, functionName, args, value: 0n });
  console.log(`${label} tx: ${hash}`);
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, retries: 120, interval: 3000, fullTransaction: true });
  const result = receipt.txExecutionResultName;
  console.log(`${label} consensus: ${receipt.statusName || receipt.status || "FINALIZED"}`);
  console.log(`${label} execution: ${result || "UNKNOWN"}`);
  if (result && result !== ExecutionResult.FINISHED_WITH_RETURN) throw new Error(`${label} failed: ${result}`);
  return { hash, receipt };
}

const beforeId = await findNextProposalId();
const contextBody = await (await fetch(contextUrl)).text();
const contextHash = `sha256:${createHash("sha256").update(contextBody).digest("hex")}`;
const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + "Z";

await transact(writerA, "create", "create_proposal", [
  contextTitle,
  contextUrl,
  contextHash,
  2n,
  deadline,
]);
console.log(`create readback: ${await state(beforeId)}`);
await transact(writerA, "capture-snapshot", "capture_snapshot", [BigInt(beforeId)]);

await transact(writerA, "vote-A", "vote", [BigInt(beforeId), "FOR"]);
await transact(writerA, "duplicate-vote-A", "vote", [BigInt(beforeId), "FOR"]);
const afterDuplicate = await state(beforeId);
if (!afterDuplicate.endsWith("|1|0")) throw new Error(`duplicate vote mutated tally: ${afterDuplicate}`);
await transact(writerB, "vote-B", "vote", [BigInt(beforeId), "FOR"]);
console.log(`vote readback: ${await state(beforeId)}`);

await transact(writerA, "verify", "verify_context", [BigInt(beforeId)]);
const verified = await state(beforeId);
console.log(`verify readback: ${verified}`);

if (verified.startsWith("READY|UNCHANGED|")) {
  await transact(writerA, "execute", "execute", [BigInt(beforeId), `lifecycle-${Date.now()}`]);
  console.log(`execute readback: ${await state(beforeId)}`);
} else {
  console.log("execute skipped: semantic verdict did not authorize execution");
}

console.log(`Proposal ID: ${beforeId}`);

const expiredId = await findNextProposalId();
await transact(writerA, "create-expired", "create_proposal", [
  `${contextTitle} expired`, contextUrl, contextHash, 1n, "2000-01-01T00:00:00Z",
]);
await transact(writerB, "vote-after-deadline", "vote", [BigInt(expiredId), "FOR"]);
const expiredVoteState = await state(expiredId);
if (!expiredVoteState.endsWith("|0|0")) throw new Error(`deadline vote mutated tally: ${expiredVoteState}`);
await transact(writerA, "verify-after-deadline", "verify_context", [BigInt(expiredId)]);
const expiredVerifyState = await state(expiredId);
if (expiredVerifyState !== "VOTING|UNVERIFIED|0|0") throw new Error(`deadline verification mutated state: ${expiredVerifyState}`);
console.log(`Expired proposal negative paths PASS: ${expiredId}`);
