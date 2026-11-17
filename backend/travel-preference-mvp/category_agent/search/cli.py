"""CLI for one Places search (user-triggered; do not batch-explore).

  uv run python -m category_agent.search.cli --city 교토 --keyword 갤러리
  uv run python -m category_agent.search.cli --city 교토 --from-plan path.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from category_agent.schemas import IndustryPlanResponse

from .kakao_client import places_configured
from .schemas import PlacesSearchRequest
from .service import search_places


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env")
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Places Text Search for industry keywords")
    parser.add_argument("--city", required=True)
    parser.add_argument(
        "--keyword",
        action="append",
        default=[],
        help="Repeatable industry keyword (e.g. --keyword 갤러리)",
    )
    parser.add_argument(
        "--from-plan",
        default=None,
        help="IndustryPlanResponse JSON (industries + micro_industries name lists)",
    )
    parser.add_argument("--max", type=int, default=5)
    parser.add_argument(
        "--check-config",
        action="store_true",
        help="Only report whether GOOGLE_PLACES_API_KEY is set (no API call)",
    )
    args = parser.parse_args()

    if args.check_config:
        print(json.dumps({"places_configured": places_configured()}, ensure_ascii=False))
        return

    keywords: list[str] = list(args.keyword)
    industries: list[str] = []
    micros: list[str] = []
    if args.from_plan:
        raw = json.loads(Path(args.from_plan).read_text(encoding="utf-8"))
        # tolerate older object-shaped industries
        if raw.get("industries") and isinstance(raw["industries"][0], dict):
            raw["industries"] = [
                x.get("industry_ko") or x.get("name") for x in raw["industries"] if isinstance(x, dict)
            ]
        if raw.get("micro_industries") and isinstance(raw["micro_industries"][0], dict):
            raw["micro_industries"] = [
                x.get("industry_ko") or x.get("name")
                for x in raw["micro_industries"]
                if isinstance(x, dict)
            ]
        plan = IndustryPlanResponse.model_validate(raw)
        industries = list(plan.industries)
        micros = list(plan.micro_industries)

    if not keywords and not industries and not micros:
        parser.error("Provide --keyword and/or --from-plan")

    if not places_configured():
        print(
            "ERROR: KAKAO_REST_API_KEY not set in env/.env",
            file=sys.stderr,
        )
        sys.exit(1)

    result = search_places(
        PlacesSearchRequest(
            city=args.city,
            keywords=keywords,
            industries=industries,
            micro_industries=micros,
            max_results_per_keyword=args.max,
        )
    )
    payload = result.model_dump_json(indent=2)
    try:
        print(payload)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((payload + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
