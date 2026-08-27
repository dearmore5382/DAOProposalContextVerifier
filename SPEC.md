# DAO Proposal Context Verifier

## Product boundary

This Dapp verifies whether a DAO proposal's external context remains semantically unchanged before an execution receipt is recorded. It does not execute arbitrary treasury calls, provide legal governance advice, guarantee a URL is truthful, or replace the DAO's vote process.

## Do not use when

- the source is private or requires authentication;
- proposals require continuous real-time conditions;
- execution needs arbitrary contract calldata or token custody;
- a binary byte-for-byte hash comparison is sufficient.

## Architecture difference / anti-clone

This product is a proposal context integrity gate, not a grant escrow or milestone payout system. Its core state is a quorum vote plus a semantic comparison of a locked external context. It has no grant, commitment, artifact payout, reviewer settlement, treasury custody, or evidence revision lifecycle. The only downstream effect is recording an execution receipt after `UNCHANGED`, quorum, and majority approval.

## Integration oracle view

Integrators may rely on `proposal_state` and `proposal_context`. `UNCHANGED` is the only context result that permits execution; `MATERIAL_CHANGE` and `SOURCE_UNAVAILABLE` are fail-closed.

