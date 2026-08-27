import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import "./styles.css";
import "./layout.css";
import "./wallet.css";

const address = import.meta.env.VITE_CONTRACT_ADDRESS;
const rpcUrl = import.meta.env.VITE_RPC_URL;
let readClient = rpcUrl ? createClient({ chain: studionet, endpoint: rpcUrl }) : null;
let writeClient = null;
let accountAddress = null;

const app = document.querySelector("#app");
app.innerHTML = `
  <main id="top" class="shell">
    <nav><a class="brand" href="#top"><span class="mark">◈</span><span>Context Verifier</span></a><div class="nav-links"><button data-page="overview" class="active">How it works</button><button data-page="create">Create</button><button data-page="vote">Vote</button><button data-page="verify">Verify</button><button data-page="execute">Execute</button></div><button id="connect">Connect wallet</button></nav>
    <section id="page-overview" class="page active-page"><section class="hero"><div><p class="eyebrow">DAO GOVERNANCE INTEGRITY</p><h1>Vote on what<br/><em>actually stays true.</em></h1><p class="lede">External proposal context can drift after a vote. Context Verifier creates a semantic checkpoint before execution.</p><button class="primary hero-cta" data-page="create">Create your first proposal <span>↗</span></button></div><div class="status-card"><span class="pulse"></span><span id="network">Not connected</span><strong id="contractState">Contract not configured</strong></div></section><div class="how-grid"><div class="how-intro"><p class="eyebrow">HOW IT WORKS</p><h2>Four steps to a<br/><em>trustworthy execution.</em></h2><p>The contract locks the source, GenLayer reads the live context, and the DAO only proceeds when the meaning still matches.</p></div><div class="how-step"><span>01</span><h3>Lock the context</h3><p>Creator records a URL, content hash, quorum and deadline.</p></div><div class="how-step"><span>02</span><h3>Vote on-chain</h3><p>Wallets cast FOR or AGAINST votes against the immutable snapshot.</p></div><div class="how-step"><span>03</span><h3>Semantic check</h3><p>Validators independently fetch the source and classify meaningful change.</p></div><div class="how-step"><span>04</span><h3>Gate execution</h3><p>Only UNCHANGED + quorum + majority FOR can record an execution receipt.</p></div></div><div class="legend"><span class="legend-title">Verdict states</span><span><i class="dot green"></i>UNCHANGED · proceed</span><span><i class="dot amber"></i>MATERIAL_CHANGE · blocked</span><span><i class="dot red"></i>SOURCE_UNAVAILABLE · fail closed</span></div></section>
    <section id="page-create" class="page"><div class="page-heading"><span class="step">01</span><div><p class="eyebrow">PROPOSAL AUTHORING</p><h2>Create a context-locked proposal</h2><p>Capture the exact external source that voters are approving.</p></div></div><div class="single-panel panel"><form id="createForm"><label>Proposal title<input name="title" required placeholder="Q4 treasury allocation" /></label><label>Context URL<input name="url" required placeholder="https://forum.example.org/proposal" /></label><label>Locked content hash<input name="hash" required placeholder="Arweave transaction ID or SHA-256 digest" /></label><div class="row"><label>Quorum<input name="quorum" type="number" min="1" value="3" required /></label><label>Voting deadline<input name="deadline" type="datetime-local" required /></label></div><div class="callout"><strong>Why lock a hash?</strong><span>The hash anchors what voters saw. GenLayer later judges whether any change is material, not merely cosmetic.</span></div><button class="primary">Lock proposal context <span>↗</span></button></form></div></section>
    <section id="page-vote" class="page"><div class="page-heading"><span class="step">02</span><div><p class="eyebrow">DAO SIGNAL</p><h2>Cast your vote</h2><p>Record a FOR or AGAINST decision on the deployed Intelligent Contract.</p></div></div><div class="single-panel panel"><div class="lookup"><input id="proposalId" type="number" min="0" placeholder="Enter proposal ID" /><button id="load">Load proposal</button></div><div id="details" class="empty">Load a proposal to see its locked context and current vote count.</div><div class="vote-actions large"><button id="for">FOR — approve</button><button id="against">AGAINST — reject</button></div></div></section>
    <section id="page-verify" class="page"><div class="page-heading"><span class="step">03</span><div><p class="eyebrow">GENLAYER CONSENSUS</p><h2>Verify the live context</h2><p>Validators fetch the source independently and compare meaning against the locked snapshot.</p></div></div><div class="single-panel panel"><div class="verify-explainer"><div class="signal"><span class="pulse"></span><strong>Semantic oracle</strong></div><p>GenLayer returns one bounded verdict. UNCHANGED unlocks the execution page; every other verdict fails closed.</p></div><div class="lookup"><input id="verifyId" type="number" min="0" placeholder="Proposal ID" /><button id="verifyLoad">Load context</button></div><div id="verifyDetails" class="empty">Choose a proposal ID to inspect its source authority.</div><button id="verify" class="primary compact" disabled>Run consensus verification <span>↗</span></button></div></section>
    <section id="page-execute" class="page"><div class="page-heading"><span class="step">04</span><div><p class="eyebrow">EXECUTION GATE</p><h2>Release the execution receipt</h2><p>The final gate checks context verdict, quorum and majority before recording execution.</p></div></div><div class="single-panel panel"><div class="lookup"><input id="executeId" type="number" min="0" placeholder="Proposal ID" /><button id="executeLoad">Load status</button></div><div id="executeDetails" class="empty">Execution is unavailable until the proposal is verified as UNCHANGED.</div><input id="receipt" placeholder="Execution transaction / multisig receipt" /><button id="execute" class="primary compact" disabled>Record execution receipt <span>↗</span></button></div></section>
    <footer><span>GenLayer Intelligent Contract</span><span>Semantic integrity gate · fail-closed by design</span></footer>
  </main>`;

if (!address || !rpcUrl || address === "0x0000000000000000000000000000000000000000") {
  document.querySelector("#network").textContent = "genlayer-js loaded - awaiting config";
  document.querySelector("#contractState").textContent = "Set VITE_CONTRACT_ADDRESS + VITE_RPC_URL";
} else {
  document.querySelector("#network").textContent = "genlayer-js ready - wallet not connected";
  document.querySelector("#contractState").textContent = address;
}

const $ = (s) => document.querySelector(s);
const currentId = () => $("#proposalId").value || $("#verifyId").value || $("#executeId").value;
document.querySelectorAll("[data-page]").forEach((button) => button.onclick = () => {
  const page = button.dataset.page;
  document.querySelectorAll(".page").forEach((el) => el.classList.toggle("active-page", el.id === `page-${page}`));
  document.querySelectorAll(".nav-links button").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
  if (page === "create" || page === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
});
function flash(message, kind = "info") { const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 4200); }
async function connect() {
  if (!window.ethereum) return flash("Install a wallet extension first.", "error");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }); accountAddress = accounts[0];
  if (address && rpcUrl && address !== "0x0000000000000000000000000000000000000000") writeClient = createClient({ chain: studionet, endpoint: rpcUrl, account: accountAddress, provider: window.ethereum });
  $("#connect").textContent = `${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}`; $("#network").textContent = "Wallet connected via genlayer-js"; $("#contractState").textContent = address;
}
$("#connect").onclick = connect;
$("#createForm").onsubmit = async (e) => { e.preventDefault(); if (!writeClient) return flash("Connect wallet first.", "error"); const f = new FormData(e.target); const date = new Date(f.get("deadline")).toISOString().replace(".000", ""); try { const txHash = await writeClient.writeContract({ address, functionName: "create_proposal", args: [f.get("title"), f.get("url"), f.get("hash"), BigInt(f.get("quorum")), date] }); flash(`Proposal transaction sent: ${txHash.slice(0, 12)}…`); await readClient.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED" }); flash("Proposal locked on-chain.", "success"); } catch (err) { flash(err.shortMessage || err.message, "error"); } };
async function loadProposal() { if (!readClient) return flash("Configure the contract address first.", "error"); const id = currentId(); if (id === "") return; ["#proposalId", "#verifyId", "#executeId"].forEach((s) => $(s).value = id); try { const [state, context] = await Promise.all([readClient.readContract({ address, functionName: "proposal_state", args: [BigInt(id)] }), readClient.readContract({ address, functionName: "proposal_context", args: [BigInt(id)] })]); const [status, result, yes, no] = state.split("|"); const [url, hash, note] = context.split("|"); const html = `<div class="badges"><span class="badge ${status.toLowerCase()}">${status}</span><span class="badge ${result.toLowerCase()}">${result}</span></div><dl><dt>Context source</dt><dd>${url}</dd><dt>Locked hash</dt><dd>${hash}</dd><dt>Votes</dt><dd>${yes} FOR · ${no} AGAINST</dd><dt>Validator note</dt><dd>${note || "—"}</dd></dl>`; ["#details", "#verifyDetails", "#executeDetails"].forEach((s) => { $(s).className = "details"; $(s).innerHTML = html; }); $("#verify").disabled = false; $("#execute").disabled = result !== "UNCHANGED" || status !== "READY"; } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#load").onclick = loadProposal;
async function writeAction(method, args) { if (!writeClient) return flash("Connect wallet first.", "error"); try { const txHash = await writeClient.writeContract({ address, functionName: method, args }); flash(`Transaction sent: ${txHash.slice(0, 12)}…`); await readClient.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED" }); flash(`${method} confirmed.`, "success"); await loadProposal(); } catch (err) { flash(err.shortMessage || err.message, "error"); } }
$("#verifyLoad").onclick = loadProposal;
$("#executeLoad").onclick = loadProposal;
$("#verify").onclick = () => writeAction("verify_context", [BigInt(currentId())]);
$("#execute").onclick = () => writeAction("execute", [BigInt(currentId()), $("#receipt").value || `receipt-${Date.now()}`]);
$("#for").onclick = () => writeAction("vote", [BigInt(currentId()), "FOR"]);
$("#against").onclick = () => writeAction("vote", [BigInt(currentId()), "AGAINST"]);
