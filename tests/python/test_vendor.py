"""The vendored engine files are the engine repository's files at the pinned commit, the vendored
data files are the installed reference's own (and its manifest's), and the reference installed at
that commit reproduces the engine's context fixtures."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
from importlib import resources
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
VENDORED = json.loads((ROOT / "src/lib/engine/vendor/VENDORED.json").read_text())


def test_every_vendored_file_matches_its_hash():
    assert len(VENDORED["files"]) >= 40
    for path, rec in VENDORED["files"].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == rec["sha256"], path


def test_installed_reference_is_the_vendored_commit():
    d = importlib.metadata.distribution("agent-loop-sim")
    assert json.loads(d.read_text("direct_url.json"))["vcs_info"]["commit_id"] == VENDORED["commit"]


def test_vendored_data_are_the_packages():
    pkg = resources.files("agent_loop_sim")
    merges = pkg.joinpath("data/qwen2.5-merges.txt").read_bytes()
    assert hashlib.sha256(merges).hexdigest() == VENDORED["files"]["public/tokenizer/qwen2.5-merges.txt"]["sha256"]
    man = json.loads(pkg.joinpath("data/context/manifest.json").read_text())
    for name, h in man["files"].items():
        assert hashlib.sha256(pkg.joinpath(f"data/context/{name}").read_bytes()).hexdigest() == h, name
        assert VENDORED["files"][f"public/context/{name}"]["sha256"] == h, name


def test_the_reference_reproduces_the_engine_fixtures():
    from agent_loop_sim.context.corpus import default_corpus
    from agent_loop_sim.context.evaluate import evaluate
    from agent_loop_sim.context.retrieval import Retriever

    fx = json.loads((ROOT / "tests/fixtures/context_fixtures.json").read_text())
    c = default_corpus()
    for want in fx["evals"][:8]:
        assert evaluate(Retriever(c, want["config"]), want["method"], want["params"]) == want
