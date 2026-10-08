"""The site's parity fixtures, from the Python reference engine at the vendored commit.

    python scripts/make_fixtures.py          # write tests/fixtures/site_fixtures.json
    python scripts/make_fixtures.py --check  # fail if it is out of date (CI)

For every chapter (src/data/chapter_configs.json), everything it animates and quotes, computed by
the reference from the engine's shipped data: the window task under each budget and policy (and
with the lossy summariser), BM25 views and evaluations, nearest-neighbour frames at each precision,
RRF and rerank frames, chunk boundaries and each chunking's metrics; packing views and the packing
evaluation, the long task's compaction runs and studies, every memory run, and the long-context
against retrieval grid. tests/unit/frames.test.ts recomputes them with the vendored
TS port (src/lib/engine's runChapter) and requires equality; tests/e2e/frames.spec.ts checks the
captions on the page.

The engine must be installed from git at the commit in src/lib/engine/vendor/VENDORED.json
(reference/requirements.txt pins it); this script refuses to run otherwise.
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import sys
from pathlib import Path

from agent_loop_sim.context import views
from agent_loop_sim.context.corpus import DEFAULT, default_corpus, read_data
from agent_loop_sim.context.evaluate import evaluate, relevant
from agent_loop_sim.context.retrieval import B, K1, RRF_K, Retriever
from agent_loop_sim.context.vectors import nbytes
from agent_loop_sim.context import memory as M
from agent_loop_sim.context import packing as P
from agent_loop_sim.context import tradeoff as T
from agent_loop_sim.context.window import compaction_study, task_questions, window_run

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests/fixtures/site_fixtures.json"


def installed_commit() -> str:
    d = importlib.metadata.distribution("agent-loop-sim")
    info = json.loads(d.read_text("direct_url.json") or "{}")
    return info.get("vcs_info", {}).get("commit_id", "")


C = default_corpus()
_R: dict[str, Retriever] = {}


def retriever(config: str) -> Retriever:
    if config not in _R:
        _R[config] = Retriever(C, config)
    return _R[config]


def question_info(qi: int) -> dict:
    q = C.questions[qi]
    return {"q": qi, "question": q["question"], "answer": q["answer"], "article": q["article"],
            "title": C.articles[q["article"]]["title"]}


def chunk_info(r: Retriever, c: int) -> dict:
    ch = r.chunks[c]
    return {"chunk": c, "article": ch["article"], "title": C.articles[ch["article"]]["title"], "tokens": ch["tokens"],
            "text": C.chunk_text(ch)}


def texts_of(r: Retriever, ids) -> dict:
    return {str(c): chunk_info(r, c) for c in sorted(ids)}


def summary_of(w: dict) -> dict:
    return {k: v for k, v in w.items() if k != "frames"}


def eval_summary(e: dict) -> dict:
    return {"config": e["config"], "method": e["method"], "params": e["params"], "lost": e["lost"], "mean": e["mean"]}


def bm25_query(query: str, k1: float, b: float) -> dict:
    r = retriever(DEFAULT)
    v = views.bm25_view(r, query, k1, b)
    ids = {row["chunk"] for row in v["top"]}
    for f in v["frames"]:
        ids |= {t["chunk"] for t in f["top"]}
    return dict(v, chunks=texts_of(r, ids))


def run_chapter(chapter: str, cfg: dict) -> dict:
    r = retriever(DEFAULT)
    if chapter == "window":
        task = task_questions(r, cfg["task"])
        runs = {f"{p}-{b}": window_run(r, task, b, p) for b in cfg["budgets"] for p in cfg["policies"]}
        for b in cfg["budgets"]:
            for p in cfg["lossy"]:
                runs[f"lossy-{p}-{b}"] = window_run(r, task, b, p, "lossy")
        return {"task": [question_info(qi) for qi in task], "runs": runs}
    if chapter == "packing":
        pviews, ids = {}, set()
        for qi in cfg["questions"]:
            for b in cfg["budgets"]:
                v = P.packing_view(r, qi, b)
                cands = v["candidates"]
                placed = {}
                for p in P.PACKERS:
                    ch = v["packers"][p]["chosen"]
                    placed[p] = {}
                    for pl in P.PLACEMENTS:
                        order = P.place(cands, ch, pl)
                        placed[p][pl] = {"order": order, "positions": P.positions(cands, order) if order else [],
                                         "p": P.answer_p(cands, order) if order else 0}
                pviews[f"{qi}-{b}"] = dict(v, placed=placed)
                ids |= {c["chunk"] for c in v["candidates"]}
        return {"questions": [question_info(qi) for qi in cfg["questions"]], "views": pviews,
                "eval": P.packing_eval(r, cfg["eval_budgets"]), "curve": P.position_curve(), "position": P.POSITION,
                "chunks": {str(c): {"chunk": c, "title": C.articles[r.chunks[c]["article"]]["title"], "tokens": r.chunks[c]["tokens"]}
                           for c in sorted(ids)}}
    if chapter == "compaction":
        task = task_questions(r, cfg["task"])
        runs, baselines, studies = {}, {}, {}
        seeds = list(range(1, cfg["seeds"] + 1))
        for b in cfg["budgets"]:
            for p in cfg["baselines"]:
                baselines[f"{p}-{b}"] = summary_of(window_run(r, task, b, p))
            for p in cfg["policies"]:
                for loss in cfg["losses"]:
                    runs[f"{p}-{loss}-{b}"] = (window_run(r, task, b, p, "lossy", loss, cfg["seed"]) if loss
                                               else window_run(r, task, b, p))
                    if loss and p in cfg["studies"]:
                        studies[f"{p}-{loss}-{b}"] = compaction_study(r, task, b, p, loss, seeds)
        return {"task": [question_info(qi) for qi in task], "runs": runs, "baselines": baselines, "studies": studies}
    if chapter == "memory":
        plan = M.memory_plan(r)
        runs = {name: M.memory_run(r, p, plan, name) for name, p in M.POLICIES.items()}
        sweep = {name: summary_of(M.memory_run(r, p, plan, name)) for name, p in M.SWEEP}
        qids = set(plan["learn"]) | {p["q"] for row in plan["probes"] for p in row}
        return {"plan": plan, "runs": runs, "sweep": sweep, "questions": {str(qi): question_info(qi) for qi in sorted(qids)}}
    if chapter == "tradeoff":
        sizes = T.measured_sizes(r)
        return T.tradeoff(r, [sizes["corpus"]] + cfg["sizes"], cfg["ks"], cfg["questions"])
    if chapter == "lexical":
        qs = [C.questions[qi]["question"] for qi in cfg["queries"]]
        return {
            "questions": [question_info(qi) for qi in cfg["queries"]],
            "relevant": {str(qi): relevant(r.chunks, C.questions[qi]) for qi in cfg["queries"]},
            "free": cfg["free"],
            "views": {q: bm25_query(q, K1, B) for q in qs + cfg["free"]},
            "n": r.bm25.n, "avgdl": r.bm25.avgdl, "terms": len(r.bm25.df),
            "evals": [eval_summary(evaluate(r, "bm25", {"k1": k1, "b": b})) for k1, b in cfg["evals"]],
        }
    if chapter == "dense":
        path = cfg["path"]
        frames, evals, ids = {}, {}, set()
        for p in cfg["precisions"]:
            frames[p] = views.dense_frames(r, path, p, cfg["k"])
            for f in frames[p]:
                ids |= {nb["chunk"] for nb in f["neighbours"]}
            evals[p] = eval_summary(evaluate(r, "dense", {"precision": p}))
        pca = json.loads(read_data("pca.json"))
        man = json.loads(read_data("manifest.json"))
        return {
            "questions": [question_info(qi) for qi in path], "frames": frames, "evals": evals,
            "float32": man["offline_float32"][DEFAULT],
            "bytes": {p: nbytes(384, p) for p in cfg["precisions"]},
            "pca": {"explained": pca["explained"], "chunks": pca["chunks"], "questions": [pca["questions"][qi] for qi in path],
                    "articles": [c["article"] for c in r.chunks]},
            "chunks": texts_of(r, ids), "model": man["embedder"]["repo"],
        }
    if chapter == "hybrid":
        n = cfg["n"]
        hy, ids = {}, set()
        for qi in cfg["questions"]:
            hy[str(qi)] = views.hybrid_frames(r, qi, RRF_K, 50, 10, n)
            for k in ["bm25", "dense", "fused", "reranked"]:
                ids |= set(hy[str(qi)][k])
        stages = [("bm25", "bm25", {}), ("dense", "dense", {}), ("rrf", "rrf", {}), ("weighted", "weighted", {"alpha": 0.5}),
                  ("rerank", "rerank", {"n": n})]
        rr = json.loads(read_data("rerank.json"))
        return {"questions": [question_info(qi) for qi in cfg["questions"]], "hybrid": hy,
                "evals": {k: eval_summary(evaluate(r, m, p)) for k, m, p in stages},
                "chunks": texts_of(r, ids), "model": rr["model"], "pool": rr["pool"]}
    allr = {name: retriever(name) for name in cfg["all"]}
    shown = {name: allr[name] for name in cfg["configs"]}
    s, e = cfg["excerpt"]
    table = {}
    for name, rr in allr.items():
        tok = 0
        for c in rr.chunks:
            tok += c["tokens"]
        table[name] = {"chunks": len(rr.chunks), "mean_tokens": tok / len(rr.chunks),
                       "bm25": eval_summary(evaluate(rr, "bm25")), "dense": eval_summary(evaluate(rr, "dense")),
                       "rrf": eval_summary(evaluate(rr, "rrf"))}
    return {"view": views.chunk_view(shown, cfg["article"], s, e), "text": C.articles[cfg["article"]]["text"][s:e],
            "title": C.articles[cfg["article"]]["title"], "table": table}


def build() -> str:
    vendored = json.loads((ROOT / "src/lib/engine/vendor/VENDORED.json").read_text())
    commit = installed_commit()
    if commit != vendored["commit"]:
        sys.exit(f"installed agent-loop-sim is at {commit[:7] or '?'}, the site vendors {vendored['commit'][:7]}: "
                 "pip install -r reference/requirements.txt")
    configs = json.loads((ROOT / "src/data/chapter_configs.json").read_text())
    out = {"commit": commit, "chapters": {ch: run_chapter(ch, cfg) for ch, cfg in configs.items()}}
    return json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    text = build()
    if a.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("tests/fixtures/site_fixtures.json is out of date (run python scripts/make_fixtures.py)")
        print("site fixtures up to date")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)} ({len(text)} bytes)")


if __name__ == "__main__":
    main()
