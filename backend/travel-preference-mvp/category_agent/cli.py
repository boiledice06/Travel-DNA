"""CLI: numeric DNA or NL text → industries (+ optional Places).

  python -m category_agent.cli --dna-json data/sample-dna.json
  python -m category_agent.cli --text "골목 카페 좋아하고 번화가는 싫어요" --slots 12
  python -m category_agent.cli --text "..." --city 안산 --places
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from .pipeline import run_nl_to_industries
from .recommend import plan_industries_from_dna
from .schemas import DEFAULT_TOTAL_SLOTS, TravelDNA


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    os.environ.setdefault("VERTEXAI_PROJECT", "bright-anagram-505514-h2")
    os.environ.setdefault("VERTEXAI_LOCATION", "global")
    os.environ.setdefault("VERTEXAI_MODEL", "gemini-3.8-flash")
    os.environ.setdefault("TRAVEL_MVP_LLM_PROVIDER", "gemini")

    parser = argparse.ArgumentParser(
        description="NL or numeric DNA → industry name lists (optional Places)"
    )
    parser.add_argument("--text", default=None, help="Natural-language likes/dislikes")
    parser.add_argument("--city", default=None)
    parser.add_argument("--slots", type=int, default=DEFAULT_TOTAL_SLOTS)
    parser.add_argument("--micro-per", type=int, default=2)
    parser.add_argument("--dna-json", default=None)
    parser.add_argument("--dna", default=None)
    parser.add_argument(
        "--places",
        action="store_true",
        help="Run Places search when --city is set",
    )
    parser.add_argument("--places-max", type=int, default=3)
    args = parser.parse_args()

    if args.text:
        result = run_nl_to_industries(
            text=args.text,
            city=args.city,
            total_slots=args.slots,
            micro_kinds_per_keyword=args.micro_per,
            run_places=bool(args.places and args.city),
            places_max_per_keyword=args.places_max,
        )
        payload = result.model_dump_json(indent=2)
    else:
        if args.dna_json:
            raw = json.loads(Path(args.dna_json).read_text(encoding="utf-8"))
        elif args.dna:
            raw = json.loads(args.dna)
        else:
            parser.error("Provide --text or --dna-json / --dna")

        if "travel_dna" in raw and isinstance(raw["travel_dna"], dict):
            raw = raw["travel_dna"]
        dna = TravelDNA.model_validate(raw)
        result = plan_industries_from_dna(
            city=args.city,
            travel_dna=dna,
            total_slots=args.slots,
            micro_kinds_per_keyword=args.micro_per,
        )
        payload = result.model_dump_json(indent=2)

    try:
        print(payload)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((payload + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
