"""Assemble paired browser screenshots and per-photo attribution from evidence."""
import json
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent


def load(name):
    return json.loads((ROOT / name / "evidence.json").read_text(encoding="utf-8"))


def escaped(value):
    return str(value).replace("|", "&#124;").replace("\n", " ")


def license_report():
    lines = [
        "# 사진 출처와 라이선스",
        "",
        "검증된 사진의 메타데이터를 기록했다. 카카오·TourAPI의 장소 데이터 출처와 이미지 공급원은 각각 집계한다. 장소별 상세 화면에서 출처와 라이선스를 열 수 있다. 모든 사진은 원본 비율로 표시했다.",
        "",
        "TourAPI는 공식 데이터셋과 매칭 근거의 콘텐츠 ID를 제공한다. 공급 응답에 별도 저작자나 공개 원본 게시물 URL이 없는 경우 저작자를 미표기로 남기고 직접 이미지 URL과 공식 데이터셋 링크를 기록한다.",
        "",
    ]
    for mode, title in [("after", "기존 일정"), ("live", "새 실제 추천")]:
        data = load(mode)
        names = {
            "api:" + quote(row["source"], safe="") + ":" + quote(row["place_id"], safe=""): row["name"]
            for row in data["shortlist"]
        }
        decoded = {row["url"]: row["decoded"] for row in data["decodedImages"]}
        lines += [
            f"## {title}",
            "",
            "| 장소 | 공급원 | 저작자 | 라이선스 | 변경 허용 | 링크 | 동일 장소 판정 | 디코딩 |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for entry in data["photos"]:
            if not entry.get("photo"):
                continue
            photo = entry["photo"]
            author = photo["author"] or "원문 미표기"
            if photo.get("attribution") and photo["attribution"] != photo["author"]:
                author += " · " + photo["attribution"]
            row = [
                names.get(entry["id"], entry["id"]),
                photo["publisher"],
                author,
                f"[{photo['license']}](<{photo['license_url']}>)",
                "허용" if photo["can_modify"] else "금지",
                f"[사진](<{photo['url']}>) · [출처](<{photo['source_page']}>)",
                " / ".join(photo["match"]),
                "성공" if decoded.get(photo["url"]) else "미확인",
            ]
            lines.append("| " + " | ".join(escaped(x) for x in row) + " |")
        lines.append("")
    (ROOT / "PHOTO_SOURCES.md").write_text("\n".join(lines), encoding="utf-8")


def comparison():
    panels = [("03-map", "추천 지도"), ("04-list", "추천 목록"),
              ("05-detail", "장소 상세"), ("06-itinerary", "여행 일정")]
    pale = "#F7F7F1"
    ink = "#132D36"
    muted = "#4E6469"
    border = "#DCE4DD"
    w, h = 246, 532
    frame = Image.new("RGB", (1115, 1370), pale)
    draw = ImageDraw.Draw(frame)
    font_regular = Path("C:/Windows/Fonts/malgun.ttf")
    font_bold = Path("C:/Windows/Fonts/malgunbd.ttf")

    def font(size, bold=False):
        return ImageFont.truetype(str(font_bold if bold else font_regular), size)

    draw.text((34, 28), "Travel DNA  ·  장소 사진 비교", fill=ink, font=font(33, True))
    draw.text((34, 78), "같은 실제 서울 일정  ·  Expo Web 390 × 844", fill=muted, font=font(17))
    for index, (filename, label) in enumerate(panels):
        row, col = divmod(index, 2)
        x, y = 34 + col * 534, 124 + row * 610
        draw.text((x, y), label, fill=ink, font=font(21, True))
        for side, mode in enumerate(("before", "after")):
            left = x + side * (w + 12)
            draw.text((left, y + 31), "보강 전" if mode == "before" else "보강 후",
                      fill=muted, font=font(15))
            with Image.open(ROOT / mode / (filename + ".png")) as source:
                assert source.size == (390, 844)
                frame.paste(source.convert("RGB").resize((w, h), Image.Resampling.LANCZOS),
                            (left, y + 57))
            draw.rectangle((left-1, y+56, left+w, y+57+h), outline=border)
    frame.save(ROOT / "before-after.png", optimize=True)


if __name__ == "__main__":
    assert all(load(name)["completed"] for name in ("before", "after", "live"))
    license_report()
    comparison()
