# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import typing


class DAOProposalContextVerifier(gl.Contract):
    proposal_count: u256
    global_vote_count: u256
    proposals: TreeMap[u256, str]
    proposal_authors: TreeMap[u256, str]
    proposal_urls: TreeMap[u256, str]
    proposal_hashes: TreeMap[u256, str]
    proposal_quorums: TreeMap[u256, u256]
    proposal_deadlines: TreeMap[u256, str]
    proposal_statuses: TreeMap[u256, str]
    proposal_for_votes: TreeMap[u256, u256]
    proposal_against_votes: TreeMap[u256, u256]
    proposal_context_results: TreeMap[u256, str]
    proposal_verification_notes: TreeMap[u256, str]
    proposal_execution_receipts: TreeMap[u256, str]
    proposal_vote_count: TreeMap[u256, u256]
    vote_proposal_ids: TreeMap[u256, u256]
    vote_voters: TreeMap[u256, str]
    vote_choices: TreeMap[u256, str]

    def __init__(self):
        self.proposal_count = u256(0)
        self.global_vote_count = u256(0)

    def _address_text(self, value: str) -> str:
        text = str(value)
        if text.startswith("addr#"):
            return "0x" + text[5:]
        return text

    def _sender(self) -> str:
        return self._address_text(gl.message.sender_address)

    def _text(self, value: str, maximum: u256) -> str:
        normalized = str(value)
        if len(normalized) == 0 or u256(len(normalized)) > maximum:
            return "INVALID_TEXT"
        return "OK"

    def _hash(self, value: str) -> str:
        if len(value) < 32 or len(value) > 128 or " " in value:
            return "INVALID_HASH"
        return "OK"

    @gl.public.write
    def create_proposal(self, title: str, context_url: str, context_hash: str, quorum: u256, deadline: str) -> typing.Any:
        if self._text(title, u256(160)) != "OK":
            return "INVALID_TITLE"
        if self._text(context_url, u256(300)) != "OK":
            return "INVALID_CONTEXT_URL"
        if self._hash(context_hash) != "OK":
            return "INVALID_CONTEXT_HASH"
        if quorum == u256(0):
            return "ZERO_QUORUM"
        if len(deadline) != 20 or not deadline.endswith("Z"):
            return "INVALID_DEADLINE"
        proposal_id = self.proposal_count
        self.proposals[proposal_id] = title
        self.proposal_authors[proposal_id] = self._sender()
        self.proposal_urls[proposal_id] = context_url
        self.proposal_hashes[proposal_id] = context_hash
        self.proposal_quorums[proposal_id] = quorum
        self.proposal_deadlines[proposal_id] = deadline
        self.proposal_statuses[proposal_id] = "VOTING"
        self.proposal_for_votes[proposal_id] = u256(0)
        self.proposal_against_votes[proposal_id] = u256(0)
        self.proposal_context_results[proposal_id] = "UNVERIFIED"
        self.proposal_verification_notes[proposal_id] = ""
        self.proposal_execution_receipts[proposal_id] = ""
        self.proposal_vote_count[proposal_id] = u256(0)
        self.proposal_count = proposal_id + u256(1)
        return proposal_id

    @gl.public.write
    def vote(self, proposal_id: u256, choice: str) -> typing.Any:
        if proposal_id >= self.proposal_count:
            return "PROPOSAL_NOT_FOUND"
        if self.proposal_statuses[proposal_id] != "VOTING":
            return "VOTING_CLOSED"
        if choice != "FOR" and choice != "AGAINST":
            return "INVALID_CHOICE"
        vote_id = self.proposal_vote_count[proposal_id]
        global_vote_id = self.global_vote_count
        self.vote_proposal_ids[global_vote_id] = proposal_id
        self.vote_voters[global_vote_id] = self._sender()
        self.vote_choices[global_vote_id] = choice
        self.proposal_vote_count[proposal_id] = vote_id + u256(1)
        self.global_vote_count = global_vote_id + u256(1)
        if choice == "FOR":
            self.proposal_for_votes[proposal_id] = self.proposal_for_votes[proposal_id] + u256(1)
        else:
            self.proposal_against_votes[proposal_id] = self.proposal_against_votes[proposal_id] + u256(1)
        return "VOTE_RECORDED"

    @gl.public.write
    def verify_context(self, proposal_id: u256) -> typing.Any:
        if proposal_id >= self.proposal_count:
            return "PROPOSAL_NOT_FOUND"
        if self.proposal_statuses[proposal_id] != "VOTING":
            return "VERIFICATION_NOT_ALLOWED"
        context_url = self.proposal_urls[proposal_id]
        locked_hash = self.proposal_hashes[proposal_id]
        title = self.proposals[proposal_id]

        def run() -> str:
            body = ""
            try:
                body = gl.nondet.web.get(context_url).body.decode("utf-8")[:5000]
            except Exception:
                body = "[SOURCE_UNAVAILABLE]"
            prompt = (
                "Compare the current DAO proposal context against its locked snapshot. "
                "Return ONLY one JSON object with exactly these keys: result, hash_matches, material_change, note. "
                "result must be UNCHANGED, MATERIAL_CHANGE, or SOURCE_UNAVAILABLE. "
                "hash_matches and material_change must be JSON booleans. note must be a short string. "
                "Do not use markdown fences, code blocks, or extra text. "
                "Example: {\"result\":\"UNCHANGED\",\"hash_matches\":true,\"material_change\":false,\"note\":\"No material change\"}. "
                "Do not treat formatting-only changes as material. Title: " + title
                + " locked hash: " + locked_hash + " current context: " + body
            )
            return gl.nondet.exec_prompt(prompt)

        result_json = gl.eq_principle.strict_eq(run)
        try:
            normalized_json = result_json.strip()
            if normalized_json.startswith("```"):
                first_line_end = normalized_json.find("\n")
                if first_line_end >= 0:
                    normalized_json = normalized_json[first_line_end + 1:]
                if normalized_json.endswith("```"):
                    normalized_json = normalized_json[:-3].strip()
            data = json.loads(normalized_json)
            result = data["result"]
            note = data["note"]
            if result != "UNCHANGED" and result != "MATERIAL_CHANGE" and result != "SOURCE_UNAVAILABLE":
                return "INVALID_CONTEXT_RESULT"
            if result == "UNCHANGED" and data["hash_matches"] != True:
                result = "MATERIAL_CHANGE"
        except Exception:
            return "INVALID_CONTEXT_JSON"
        self.proposal_context_results[proposal_id] = result
        self.proposal_verification_notes[proposal_id] = str(note)[:240]
        self.proposal_statuses[proposal_id] = "READY" if result == "UNCHANGED" else "BLOCKED"
        return result

    @gl.public.write
    def execute(self, proposal_id: u256, execution_receipt: str) -> typing.Any:
        if proposal_id >= self.proposal_count:
            return "PROPOSAL_NOT_FOUND"
        if self.proposal_statuses[proposal_id] != "READY":
            return "CONTEXT_NOT_VERIFIED"
        total_votes = self.proposal_for_votes[proposal_id] + self.proposal_against_votes[proposal_id]
        if total_votes < self.proposal_quorums[proposal_id]:
            return "QUORUM_NOT_REACHED"
        if self.proposal_for_votes[proposal_id] <= self.proposal_against_votes[proposal_id]:
            return "VOTE_NOT_APPROVED"
        if self._text(execution_receipt, u256(160)) != "OK":
            return "INVALID_EXECUTION_RECEIPT"
        self.proposal_execution_receipts[proposal_id] = execution_receipt
        self.proposal_statuses[proposal_id] = "EXECUTED"
        return "EXECUTED"

    @gl.public.view
    def proposal_state(self, proposal_id: u256) -> str:
        if proposal_id >= self.proposal_count:
            return "NOT_FOUND"
        return self.proposal_statuses[proposal_id] + "|" + self.proposal_context_results[proposal_id] + "|" + str(self.proposal_for_votes[proposal_id]) + "|" + str(self.proposal_against_votes[proposal_id])

    @gl.public.view
    def proposal_context(self, proposal_id: u256) -> str:
        if proposal_id >= self.proposal_count:
            return "NOT_FOUND"
        return self.proposal_urls[proposal_id] + "|" + self.proposal_hashes[proposal_id] + "|" + self.proposal_verification_notes[proposal_id]
