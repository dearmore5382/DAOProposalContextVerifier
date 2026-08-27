import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import "./styles.css";

const address = import.meta.env.VITE_CONTRACT_ADDRESS;
const rpcUrl = import.meta.env.VITE_RPC_URL;
let readClient = rpcUrl ? createClient({ chain: studionet, endpoint: rpcUrl }) : null;
let writeClient = null;
let accountAddress = null;

const app = document.querySelector("#app");
app.innerHTML = `
  <main class="shell">
    <nav><div class="brand"><span class="mark">◈</span><span>Context Verifier</span></div><button id="connect">Connect wallet</button></nav>
    <section class="hero"><div><p class="eyebrow">DAO GOVERNANCE INTEGRITY</p><h1>Vote on what<br/><em>actually stays true.</em></h1><p class="lede">Lock the proposal context. Let GenLayer detect material changes before execution.</p></div><div class="status-card"><span class="pulse"></span><span id="network">Not connected</span><strong id="contractState">Contract not configured</strong></div></section>
    <section class="grid">
      <div class="panel create"><div class="panel-head"><span class="step">01</span><div><h2>Create proposal</h2><p>Commit the external context snapshot.</p></div></div><form id="createForm"><label>Title<input name="title" required placeholder="Q4 treasury allocation" /></label><label>Context URL<input name="url" required placeholder="https://forum.example.org/proposal" /></label><label>Locked content hash<input name="hash" required placeholder="Arweave or SHA-256 digest" /></label><div class="row"><label>Quorum<input name="quorum" type="number" min="1" value="3" required /></label><label>Deadline<input name="deadline" type="datetime-local" required /></label></div><button class="primary">Lock proposal context <span>↗</span></button></form></div>
      <div class="panel inspect"><div class="panel-head"><span class="step">02</span><div><h2>Inspect & verify</h2><p>Consensus-check the live source.</p></div></div><div class="lookup"><input id="proposalId" type="number" min="0" placeholder="Proposal ID" /><button id="load">Load</button></div><div id="details" class="empty">Enter a proposal ID to inspect its locked context.</div><div class="actions"><button id="verify" disabled>Verify context</button><button id="execute" disabled>Execute receipt</button></div></div>
    </section>
    <section class="vote-panel"><div><p class="eyebrow">03 / CONSENSUS SIGNAL</p><h2>Cast your vote</h2><p>Voting is recorded on the deployed Intelligent Contract.</p></div><div class="vote-actions"><button id="for">FOR</button><button id="against">AGAINST</button></div></section>
    <footer><span>GenLayer Intelligent Contract</span><span>Semantic integrity gate · fail-closed by design</span></footer>
  </main>`;

if (!address || !rpcUrl || address === "0x0000000000000000000000000000000000000000") {
  document.querySelector("#network").textContent = "genlayer-js loaded - awaiting config";
  document.querySelector("#contractState").textContent = "Set VITE_CONTRACT_ADDRESS + VITE_RPC_URL";
  document.querySelector("#connect").disabled = true;
}

const $ = (s) => document.querySelector(s);
function flash(message, kind = "info") { const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 4200); }
async function connect() {
  if (!window.ethereum) return flash("Install a wallet extension first.", "error");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }); accountAddress = accounts[0];
  writeClient = createClient({ chain: studionet, endpoint: rpcUrl, account: accountAddress, provider: window.ethereum });
  $("#connect").textContent = `${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}`; $("#network").textContent = "Wallet connected via genlayer-js"; $("#contractState").textContent = address;
}
$("#connect").onclick = connect;
$("#createForm").onsubmit = async (e) => { e.preventDefault(); if (!writeClient) return flash("Connect wallet first.", "error"); const f = new FormData(e.target); const date = new Date(f.get("deadline")).toISOString().replace(".000", ""); try { const txHash = await writeClient.writeContract({ address, functionName: "create_proposal", args: [f.get("title"), f.get("url"), f.get("hash"), BigInt(f.get("quorum")), date] }); flash(`Proposal transaction sent: ${txHash.slice(0, 12)}…`); await readClient.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED" }); flash("Proposal locked on-chain.", "success"); } catch (err) { flash(err.shortMessage || err.message, "error"); } };
async function loadProposal() { if (!readClient) return flash("Configure the contract address first.", "error"); const id = $("#proposalId").value; if (id === "") return; try { const [state, context] = await Promise.all([readClient.readContract({ address, functionName: "proposal_state", args: [BigInt(id)] }), readClient.readContract({ address, functionName: "proposal_context", args: [BigInt(id)] })]); const [status, result, yes, no] = state.split("|"); const [url, hash, note] = context.split("|"); $("#details").className = "details"; $("#details").innerHTML = `<div class="badges"><span class="badge ${status.toLowerCase()}">${status}</span><span class="badge ${result.toLowerCase()}">${result}</span></div><dl><dt>Context source</dt><dd>${url}</dd><dt>Locked hash</dt><dd>${hash}</dd><dt>Votes</dt><dd>${yes} FOR · ${no} AGAINST</dd><dt>Validator note</dt><dd>${note || "—"}</dd></dl>`; $("#verify").disabled = false; $("#execute").disabled = false; } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#load").onclick = loadProposal;
async function writeAction(method, args) { if (!writeClient) return flash("Connect wallet first.", "error"); try { const txHash = await writeClient.writeContract({ address, functionName: method, args }); flash(`Transaction sent: ${txHash.slice(0, 12)}…`); await readClient.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED" }); flash(`${method} confirmed.`, "success"); await loadProposal(); } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#verify").onclick = () => writeAction("verify_context", [BigInt($("#proposalId").value)]);
$("#execute").onclick = () => writeAction("execute", [BigInt($("#proposalId").value), `receipt-${Date.now()}`]);
$("#for").onclick = () => writeAction("vote", [BigInt($("#proposalId").value), "FOR"]);
$("#against").onclick = () => writeAction("vote", [BigInt($("#proposalId").value), "AGAINST"]);
