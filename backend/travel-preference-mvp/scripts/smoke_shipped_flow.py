# -*- coding: utf-8 -*-
"""One-shot smoke: TripProfile → Likert → DNA chat → constraints → seoul-find."""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "http://127.0.0.1:8765"
OUT = Path(__file__).resolve().parents[1] / "data" / "shipped_flow_demo_last.json"
KST = timezone(timedelta(hours=9))

LIKERT_IDS = [
    "ax_authenticity",
    "ax_energy",
    "ax_density",
    "ax_novelty",
    "ax_setting",
]


def req(method: str, path: str, body=None, timeout: int = 300):
    data = None
    headers: dict[str, str] = {}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw)


def main() -> int:
    summary: dict = {
        "ok": False,
        "started_at": datetime.now(KST).isoformat(),
        "url": BASE,
        "steps": [],
        "shortlist_sample_names": [],
        "error": None,
    }
    try:
        print("1 health")
        st, h = req("GET", "/api/health", timeout=30)
        summary["steps"].append(
            {
                "health": {
                    "status": st,
                    "mode": h.get("mode"),
                    "travel_dna": h.get("travel_dna"),
                    "model": h.get("vertex_model"),
                    "places": h.get("places_configured"),
                    "adc": h.get("adc_file_present"),
                }
            }
        )
        if not h.get("ok") or not h.get("places_configured"):
            raise RuntimeError("health/places not ready")
        if h.get("travel_dna") != "likert_then_chat":
            raise RuntimeError(f"unexpected travel_dna mode: {h.get('travel_dna')}")

        print("2 trip-profile")
        st, p = req(
            "POST",
            "/api/trip-profile",
            {
                "party_size": "2",
                "companion_type": "couple",
                "age_band": "skip",
                "gender": "skip",
                "duration": "full_day",
                "lodging": "none",
                "lodging_area": None,
                "transport": "walk_subway",
                "mobility_preference": "balanced",
                "budget_level": "mid",
                "budget_note": None,
                "time_window": "afternoon",
            },
            timeout=30,
        )
        summary["steps"].append(
            {
                "trip_profile": {
                    "status": st,
                    "id": p["id"],
                    "city": p.get("city"),
                    "has_must_avoid_field": "must_avoid" in p,
                }
            }
        )
        profile_id = p["id"]

        print("3 dna start (likert)")
        st, start = req("POST", "/api/dna-chat/start", timeout=120)
        session_id = start["session_id"]
        items = start.get("likert_items") or []
        summary["steps"].append(
            {
                "dna_start": {
                    "status": st,
                    "session_id": session_id,
                    "phase": start.get("phase"),
                    "likert_count": len(items),
                }
            }
        )
        if start.get("phase") != "likert" or len(items) != 5:
            raise RuntimeError("start must return phase=likert with 5 items")
        got_ids = [it.get("id") for it in items]
        if got_ids != list(LIKERT_IDS):
            raise RuntimeError(f"unexpected likert ids: {got_ids}")

        print("4 dna likert submit")
        answers = [
            {"id": "ax_authenticity", "value": 5},
            {"id": "ax_energy", "value": 2},
            {"id": "ax_density", "value": 2},
            {"id": "ax_novelty", "value": 4},
            {"id": "ax_setting", "value": 3},
        ]
        st, likert = req(
            "POST",
            "/api/dna-chat/likert",
            {"session_id": session_id, "answers": answers},
            timeout=60,
        )
        summary["steps"].append(
            {
                "dna_likert": {
                    "status": st,
                    "phase": likert.get("phase"),
                    "has_seed": likert.get("seed_dna") is not None,
                    "followups": len(likert.get("followups") or []),
                }
            }
        )
        if likert.get("phase") != "asking" or not likert.get("seed_dna"):
            raise RuntimeError("likert must seed DNA and enter asking")

        answers_chat = [
            "골목 카페·독립서점 분위기요",
            "로컬 감성, 조용한 실내 전시 쪽",
        ]
        phase = "asking"
        for i, message in enumerate(answers_chat, 1):
            print(f"5.{i} dna message")
            st, m = req(
                "POST",
                "/api/dna-chat/message",
                {"session_id": session_id, "message": message},
                timeout=180,
            )
            phase = m.get("phase")
            summary["steps"].append(
                {
                    f"dna_msg{i}": {
                        "status": st,
                        "phase": phase,
                        "turn": m.get("turn"),
                        "has_draft": m.get("draft_dna") is not None,
                    }
                }
            )
            if phase == "constraints":
                break
        if phase != "constraints":
            print("5.extra nudge")
            st, m = req(
                "POST",
                "/api/dna-chat/message",
                {"session_id": session_id, "message": "이 정도면 충분해요"},
                timeout=180,
            )
            phase = m.get("phase")
            summary["steps"].append(
                {
                    "dna_msg_extra": {
                        "status": st,
                        "phase": phase,
                        "turn": m.get("turn"),
                    }
                }
            )
        if phase != "constraints":
            raise RuntimeError(f"expected constraints phase, got {phase}")

        print("6 dna constraints")
        st, c = req(
            "POST",
            "/api/dna-chat/constraints",
            {
                "session_id": session_id,
                "must_have": "독립서점, 작은 카페",
                "must_avoid": "클럽, 너무 시끄러운 술집",
            },
            timeout=60,
        )
        summary["steps"].append(
            {
                "dna_constraints": {
                    "status": st,
                    "phase": c.get("phase"),
                    "must_have": c.get("must_have"),
                    "must_avoid": c.get("must_avoid"),
                }
            }
        )
        if c.get("phase") != "draft":
            raise RuntimeError("constraints must move to draft")

        print("7 dna finalize")
        st, f = req(
            "POST",
            "/api/dna-chat/finalize",
            {"session_id": session_id, "confirm": True},
            timeout=120,
        )
        dna = f.get("travel_dna") or {}
        summary["steps"].append(
            {
                "dna_finalize": {
                    "status": st,
                    "phase": f.get("phase"),
                    "pillars": dna.get("pillars"),
                    "must_have": f.get("must_have"),
                    "must_avoid": f.get("must_avoid"),
                }
            }
        )

        print("8 seoul-find")
        st, r = req(
            "POST",
            "/api/seoul-find",
            {
                "profile_id": profile_id,
                "dna_session_id": session_id,
                "total_slots": 12,
                "shortlist_size": 16,
                "run_places": True,
            },
            timeout=300,
        )
        names = [x.get("name") for x in (r.get("shortlist") or [])][:16]
        summary["steps"].append(
            {
                "seoul_find": {
                    "status": st,
                    "model": r.get("model"),
                    "industry_count": len(r.get("industries") or []),
                    "industries": r.get("industries"),
                    "shortlist_count": len(r.get("shortlist") or []),
                    "filters_applied": r.get("filters_applied"),
                    "constraints": {
                        "must_have": (r.get("constraints") or {}).get("must_have"),
                        "must_avoid": (r.get("constraints") or {}).get("must_avoid"),
                    },
                }
            }
        )
        summary["shortlist_sample_names"] = names
        summary["ok"] = len(names) > 0
        if not summary["ok"]:
            summary["error"] = "empty shortlist"
    except Exception as e:  # noqa: BLE001 — smoke summary
        summary["error"] = str(e)
        print("SMOKE FAIL:", e)

    summary["finished_at"] = datetime.now(KST).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)
    print("ok=", summary["ok"])
    for i, n in enumerate(summary["shortlist_sample_names"], 1):
        print(i, n)
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
