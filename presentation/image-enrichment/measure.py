"""Measure photo lookup on a recorded public shortlist without changing its order."""
import argparse
from collections import Counter
import json
from pathlib import Path
from time import perf_counter
from urllib.parse import quote
from urllib.request import Request, urlopen


def read_photo_batches(places, base):
    started = perf_counter()
    timings = []
    results = []
    for offset in range(0, len(places), 4):
        batch = places[offset:offset + 4]
        batch_start = perf_counter()
        request = Request(
            f"{base}/api/place-photos",
            data=json.dumps({"places": batch}, ensure_ascii=False).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urlopen(request, timeout=10) as response:
            rows = json.load(response)
            assert [item["id"] for item in rows] == [item["id"] for item in batch]
            results.extend(rows)
        timings.append(round((perf_counter() - batch_start) * 1000))
    return results, timings, round((perf_counter() - started) * 1000)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--server", default="http://127.0.0.1:8778")
    args = parser.parse_args()
    shortlist = json.loads(args.input.read_text(encoding="utf-8-sig"))["shortlist"]
    fields = ("name", "address", "lat", "lng", "place_id", "source", "source_keyword", "image_url", "category")
    public = [{key: row[key] for key in fields if key in row} for row in shortlist if row.get("lat") and row.get("lng")]
    places = [
        {"id": "api:" + quote(row["source"], safe="") + ":" + quote(row["place_id"], safe=""),
         "name": row["name"], "address": row["address"], "latitude": row["lat"], "longitude": row["lng"]}
        for row in public
    ]
    verified, batch, total = read_photo_batches(places, args.server)
    _, warm_batch, warm_total = read_photo_batches(places, args.server)
    inferred = [item["photo"] for item in verified if item.get("photo")]
    lookup = {item["id"]: item for item in verified}
    outcome = {
        "shortlist": public, "photos": [lookup[place["id"]] for place in places],
        "places": len(places),
        "legacy_image_count": sum(bool(row.get("image_url")) for row in public),
        "verified_image_count": len(inferred),
        "providers": Counter(photo["provider"] for photo in inferred),
        "known_authors": sum(bool(photo["author"]) for photo in inferred),
        "cold_ms": total, "cold_batches_ms": batch,
        "warm_ms": warm_total, "warm_batches_ms": warm_batch,
    }
    args.output.write_text(json.dumps(outcome, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in outcome.items() if k not in {"shortlist", "photos"}}))


if __name__ == "__main__":
    main()
