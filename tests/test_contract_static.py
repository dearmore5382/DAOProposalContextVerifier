import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "DAOProposalContextVerifier.py"
SOURCE = CONTRACT.read_text(encoding="ascii")
TREE = ast.parse(SOURCE)


def test_header_imports_and_class():
    assert SOURCE.splitlines()[:3] == [
        "# v0.2.16",
        '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }',
        "from genlayer import *",
    ]
    classes = [n for n in TREE.body if isinstance(n, ast.ClassDef) and any(ast.unparse(b) == "gl.Contract" for b in n.bases)]
    assert len(classes) == 1 and classes[0].name == "DAOProposalContextVerifier"
    assert SOURCE.encode("ascii")


def test_storage_profile_and_flat_public_api():
    klass = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == "DAOProposalContextVerifier")
    allowed_storage = {"u256", "TreeMap[u256, str]", "TreeMap[u256, u256]"}
    for node in klass.body:
        if isinstance(node, ast.AnnAssign):
            assert ast.unparse(node.annotation) in allowed_storage
        if isinstance(node, ast.FunctionDef) and node.decorator_list:
            assert len(node.args.args[1:]) <= 6
            assert ast.unparse(node.returns) in {"u256", "str", "typing.Any"}


def test_context_consensus_and_fail_closed_enums():
    assert "gl.eq_principle.strict_eq(run)" in SOURCE
    assert "UNCHANGED" in SOURCE and "MATERIAL_CHANGE" in SOURCE and "SOURCE_UNAVAILABLE" in SOURCE
    assert "CONTEXT_NOT_VERIFIED" in SOURCE
    run = next(n for n in ast.walk(TREE) if isinstance(n, ast.FunctionDef) and n.name == "run")
    assert "self." not in ast.unparse(run)


def test_architecture_is_not_grant_escrow_clone():
    assert "grant" not in SOURCE.lower()
    assert "milestone" not in SOURCE.lower()
    assert "proposal_hashes" in SOURCE
    assert "proposal_quorums" in SOURCE
    assert "global_vote_count" in SOURCE
