import { ethers } from "ethers";
import "./styles.css";

const address = import.meta.env.VITE_CONTRACT_ADDRESS;
const rpcUrl = import.meta.env.VITE_RPC_URL;
const abi = [
  "function create_proposal(string,string,string,uint256,string) returns (uint256)",
  "function vote(uint256,string) returns (string)",
  "function verify_context(uint256) returns (string)",
  "function execute(uint256,string) returns (string)",
  "function proposal_state(uint256) view returns (string)",
  "function proposal_context(uint256) view returns (string)"
];

let provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
let signer = null;
let contract = provider && address ? new ethers.Contract(address, abi, provider) : null;

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

const $ = (s) => document.querySelector(s);
function flash(message, kind = "info") { const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 4200); }
async function connect() {
  if (!window.ethereum) return flash("Install a wallet extension first.", "error");
  const browser = new ethers.BrowserProvider(window.ethereum); await browser.send("eth_requestAccounts", []); signer = await browser.getSigner(); contract = new ethers.Contract(address, abi, signer); $("#connect").textContent = `${(await signer.getAddress()).slice(0, 6)}…${(await signer.getAddress()).slice(-4)}`; $("#network").textContent = "Wallet connected"; $("#contractState").textContent = address;
}
$("#connect").onclick = connect;
$("#createForm").onsubmit = async (e) => { e.preventDefault(); if (!signer) return flash("Connect wallet first.", "error"); const f = new FormData(e.target); const date = new Date(f.get("deadline")).toISOString().replace(".000", ""); try { const tx = await contract.create_proposal(f.get("title"), f.get("url"), f.get("hash"), f.get("quorum"), date); flash(`Proposal transaction sent: ${tx.hash.slice(0, 12)}…`); await tx.wait(); flash("Proposal locked on-chain.", "success"); } catch (err) { flash(err.shortMessage || err.message, "error"); } };
async function loadProposal() { if (!contract) return flash("Configure the contract address first.", "error"); const id = $("#proposalId").value; if (id === "") return; try { const [state, context] = await Promise.all([contract.proposal_state(id), contract.proposal_context(id)]); const [status, result, yes, no] = state.split("|"); const [url, hash, note] = context.split("|"); $("#details").className = "details"; $("#details").innerHTML = `<div class="badges"><span class="badge ${status.toLowerCase()}">${status}</span><span class="badge ${result.toLowerCase()}">${result}</span></div><dl><dt>Context source</dt><dd>${url}</dd><dt>Locked hash</dt><dd>${hash}</dd><dt>Votes</dt><dd>${yes} FOR · ${no} AGAINST</dd><dt>Validator note</dt><dd>${note || "—"}</dd></dl>`; $("#verify").disabled = false; $("#execute").disabled = false; } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#load").onclick = loadProposal;
async function writeAction(method, ...args) { if (!signer) return flash("Connect wallet first.", "error"); try { const tx = await contract[method](...args); flash(`Transaction sent: ${tx.hash.slice(0, 12)}…`); await tx.wait(); flash(`${method} confirmed.`, "success"); await loadProposal(); } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#verify").onclick = () => writeAction("verify_context", $("#proposalId").value);
$("#execute").onclick = () => writeAction("execute", $("#proposalId").value, `receipt-${Date.now()}`);
$("#for").onclick = () => writeAction("vote", $("#proposalId").value, "FOR");
$("#against").onclick = () => writeAction("vote", $("#proposalId").value, "AGAINST");
