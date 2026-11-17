"""
Live Vertex batch: several Travel DNA personas → industry plans.
Run: uv run python scripts/batch_industry_test.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

os.environ.setdefault("VERTEXAI_PROJECT", "bright-anagram-505514-h2")
os.environ.setdefault("VERTEXAI_LOCATION", "global")
os.environ.setdefault("VERTEXAI_MODEL", "gemini-3.8-flash")
os.environ.setdefault("TRAVEL_MVP_LLM_PROVIDER", "vertex")

from category_agent.recommend import plan_industries
from category_agent.schemas import IndustryPlanRequest, PreferenceAxes, TourismPillars, TravelDNA

STORE_INTERNAL = Path(
    r"C:\Users\semin\AppData\Local\Cursor\AgentStores\cursor_agent_stores"
    r"\bc-f697f031-e73b-4c7c-8d37-f8a4af0ddb54\files\internal"
)
STORE_DOCS = Path(
    r"C:\Users\semin\AppData\Local\Cursor\AgentStores\cursor_agent_stores"
    r"\bc-f697f031-e73b-4c7c-8d37-f8a4af0ddb54\files\docs"
)
REPO_INTERNAL = ROOT / "internal"
REPO_DATA = ROOT / "data"

SLOTS_PER = 16  # 8 personas × 16 = 128 main kinds (+ micro pass extras)

PERSONAS: list[dict] = [
    {
        "id": "quiet_local",
        "label": "Quiet local cafe lingerer",
        "travel_dna": {
            "pillars": {"do_play": 0.10, "see_learn": 0.15, "stay_vibe": 0.50, "eat_local": 0.25},
            "axes": {
                "authenticity": 0.65,
                "energy": -0.55,
                "density": -0.70,
                "novelty": 0.10,
                "setting": -0.20,
            },
            "micro_keywords": ["독립서점"],
        },
    },
    {
        "id": "high_energy_indoor",
        "label": "High-energy indoor activity",
        "travel_dna": {
            "pillars": {"do_play": 0.55, "see_learn": 0.10, "stay_vibe": 0.20, "eat_local": 0.15},
            "axes": {
                "authenticity": 0.05,
                "energy": 0.85,
                "density": 0.35,
                "novelty": 0.35,
                "setting": -0.75,
            },
            "micro_keywords": [],
        },
    },
    {
        "id": "see_learn",
        "label": "See & Learn museum-goer",
        "travel_dna": {
            "pillars": {"do_play": 0.10, "see_learn": 0.55, "stay_vibe": 0.20, "eat_local": 0.15},
            "axes": {
                "authenticity": 0.10,
                "energy": -0.25,
                "density": -0.15,
                "novelty": -0.25,
                "setting": -0.45,
            },
            "micro_keywords": [],
        },
    },
    {
        "id": "eat_local",
        "label": "Eat & Local food-first",
        "travel_dna": {
            "pillars": {"do_play": 0.10, "see_learn": 0.10, "stay_vibe": 0.20, "eat_local": 0.60},
            "axes": {
                "authenticity": 0.45,
                "energy": 0.15,
                "density": 0.20,
                "novelty": 0.25,
                "setting": -0.10,
            },
            "micro_keywords": ["시장"],
        },
    },
    {
        "id": "famous_landmark",
        "label": "Famous / landmark lean",
        "travel_dna": {
            "pillars": {"do_play": 0.25, "see_learn": 0.40, "stay_vibe": 0.20, "eat_local": 0.15},
            "axes": {
                "authenticity": -0.75,
                "energy": 0.20,
                "density": 0.55,
                "novelty": -0.45,
                "setting": -0.15,
            },
            "micro_keywords": [],
        },
    },
    {
        "id": "high_novelty",
        "label": "High novelty / distinctive",
        "travel_dna": {
            "pillars": {"do_play": 0.30, "see_learn": 0.20, "stay_vibe": 0.30, "eat_local": 0.20},
            "axes": {
                "authenticity": 0.40,
                "energy": 0.25,
                "density": -0.20,
                "novelty": 0.85,
                "setting": 0.10,
            },
            "micro_keywords": [],
        },
    },
    {
        "id": "micro_cat",
        "label": "Micro #고양이",
        "travel_dna": {
            "pillars": {"do_play": 0.10, "see_learn": 0.15, "stay_vibe": 0.45, "eat_local": 0.30},
            "axes": {
                "authenticity": 0.50,
                "energy": -0.35,
                "density": -0.45,
                "novelty": 0.30,
                "setting": -0.25,
            },
            "micro_keywords": ["고양이"],
        },
    },
    {
        "id": "mixed_balanced",
        "label": "Mixed / balanced explorer",
        "travel_dna": {
            "pillars": {"do_play": 0.25, "see_learn": 0.25, "stay_vibe": 0.25, "eat_local": 0.25},
            "axes": {
                "authenticity": 0.05,
                "energy": 0.05,
                "density": 0.00,
                "novelty": 0.05,
                "setting": 0.05,
            },
            "micro_keywords": [],
        },
    },
]


def _call_with_backoff(req: IndustryPlanRequest, *, max_attempts: int = 5):
    delay = 2.0
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return plan_industries(req)
        except Exception as exc:  # noqa: BLE001 — batch must continue
            last_exc = exc
            msg = str(exc).lower()
            retryable = any(
                k in msg
                for k in ("429", "resource exhausted", "rate", "quota", "unavailable", "503", "500")
            )
            if attempt == max_attempts or not retryable:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 60.0)
    assert last_exc is not None
    raise last_exc


def main() -> None:
    model = os.getenv("VERTEXAI_MODEL", "gemini-3.8-flash")
    started = datetime.now(timezone.utc).isoformat()
    results: list[dict] = []
    failures: list[dict] = []
    total_industries = 0

    print(f"model={model} personas={len(PERSONAS)} slots_each={SLOTS_PER}", flush=True)

    for i, persona in enumerate(PERSONAS, start=1):
        dna = TravelDNA(
            pillars=TourismPillars(**persona["travel_dna"]["pillars"]),
            axes=PreferenceAxes(**persona["travel_dna"]["axes"]),
            micro_keywords=list(persona["travel_dna"].get("micro_keywords") or []),
        )
        req = IndustryPlanRequest(travel_dna=dna, total_slots=SLOTS_PER, city=None)
        print(f"[{i}/{len(PERSONAS)}] {persona['id']} …", flush=True)
        try:
            out = _call_with_backoff(req)
            payload = out.model_dump()
            n = len(out.industries)
            nm = len(out.micro_industries)
            total_industries += n + nm
            results.append(
                {
                    "persona_id": persona["id"],
                    "label": persona["label"],
                    "ok": True,
                    "slots_requested": SLOTS_PER,
                    "industries_returned": n,
                    "micro_industries_returned": nm,
                    "slot_allocation": payload.get("slot_allocation"),
                    "summary": payload.get("summary"),
                    "industries": payload.get("industries"),
                    "micro_industries": payload.get("micro_industries"),
                    "provider": payload.get("provider"),
                    "model": payload.get("model"),
                }
            )
            print(f"  ok · {n} industries + {nm} micro · model={out.model}", flush=True)
        except Exception as exc:  # noqa: BLE001
            failures.append(
                {
                    "persona_id": persona["id"],
                    "label": persona["label"],
                    "ok": False,
                    "error": str(exc),
                }
            )
            print(f"  FAIL · {exc}", flush=True)
        # gentle pacing between personas
        time.sleep(1.0)

    finished = datetime.now(timezone.utc).isoformat()
    bundle = {
        "meta": {
            "started_at": started,
            "finished_at": finished,
            "model_env": model,
            "provider": "vertex",
            "personas": len(PERSONAS),
            "slots_per_persona": SLOTS_PER,
            "expected_min_industries": len(PERSONAS) * SLOTS_PER,
            "total_industries_ok": total_industries,
            "successes": len(results),
            "failures": len(failures),
            "region_agnostic": True,
        },
        "personas_input": PERSONAS,
        "results": results,
        "failures": failures,
    }

    STORE_INTERNAL.mkdir(parents=True, exist_ok=True)
    STORE_DOCS.mkdir(parents=True, exist_ok=True)
    REPO_INTERNAL.mkdir(parents=True, exist_ok=True)
    REPO_DATA.mkdir(parents=True, exist_ok=True)

    json_path = STORE_INTERNAL / "batch-industry-results.json"
    mirror_json = REPO_DATA / "batch-industry-results.json"
    json_text = json.dumps(bundle, ensure_ascii=False, indent=2)
    json_path.write_text(json_text, encoding="utf-8")
    mirror_json.write_text(json_text, encoding="utf-8")

    report = _render_report(bundle)
    report_path = STORE_DOCS / "batch-industry-test-report.md"
    report_path.write_text(report, encoding="utf-8")
    (REPO_INTERNAL / "batch-industry-test-report.md").write_text(report, encoding="utf-8")

    print(
        f"DONE successes={len(results)} failures={len(failures)} "
        f"total_industries={total_industries}\n"
        f"JSON: {json_path}\nREPORT: {report_path}",
        flush=True,
    )
    if failures:
        sys.exit(2)


def _render_report(bundle: dict) -> str:
    meta = bundle["meta"]
    lines = [
        "---",
        'cursor:',
        '  subagentId: "bc-753a2a42-9883-5e0c-be7c-21de81970b88"',
        "---",
        "",
        "# Batch industry-plan test report",
        "",
        f"- **Model:** `{meta['model_env']}` (Vertex ADC)",
        f"- **Personas:** {meta['personas']}",
        f"- **Slots / persona:** {meta['slots_per_persona']}",
        f"- **Total industries (ok):** {meta['total_industries_ok']} "
        f"(expected ≥ {meta['expected_min_industries']})",
        f"- **Successes / failures:** {meta['successes']} / {meta['failures']}",
        f"- **Window (UTC):** {meta['started_at']} → {meta['finished_at']}",
        f"- **Raw JSON:** `internal/batch-industry-results.json`",
        "",
        "## Personas",
        "",
    ]
    for p in bundle["personas_input"]:
        axes = p["travel_dna"]["axes"]
        micros = p["travel_dna"].get("micro_keywords") or []
        lines.append(
            f"- **{p['id']}** — {p['label']}: "
            f"auth={axes['authenticity']}, energy={axes['energy']}, dens={axes['density']}, "
            f"nov={axes['novelty']}, set={axes['setting']}; micro={micros}"
        )

    lines += ["", "## Sample rows (per persona)", ""]
    for r in bundle["results"]:
        lines.append(f"### {r['persona_id']} — {r['label']}")
        lines.append(f"- allocation: `{r.get('slot_allocation')}`")
        if r.get("summary"):
            lines.append(f"- summary: {r['summary']}")
        lines.append("")
        lines.append("| # | pillar | industry_ko | en | reason |")
        lines.append("|---|--------|-------------|----|--------|")
        for ind in (r.get("industries") or [])[:8]:
            lines.append(
                f"| {ind.get('slot_index')} | {ind.get('pillar')} | {ind.get('industry_ko')} | "
                f"{ind.get('industry_en') or ''} | {(ind.get('reason') or '')[:40]} |"
            )
        micros = r.get("micro_industries") or []
        if micros:
            lines.append("")
            lines.append("Micro:")
            for m in micros:
                lines.append(
                    f"- #{m.get('micro_keyword')}: {m.get('industry_ko')}"
                )
        lines.append("")

    if bundle["failures"]:
        lines += ["## Failures", ""]
        for f in bundle["failures"]:
            lines.append(f"- **{f['persona_id']}**: `{f['error']}`")
        lines.append("")

    lines += [
        "## Notes",
        "",
        "- Lean schema: short industry nouns; micros in separate `micro_industries` pass.",
        "- Default slots raised (batch uses 16/persona).",
        "",
        "## Scope",
        "",
        "Industry kinds only — no Places, no ABSA.",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
