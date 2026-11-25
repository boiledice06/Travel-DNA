from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SAMPLES = [
    ("01-intro", "서울 인트로"),
    ("05-likert", "취향 설문"),
    ("06-chat", "취향 대화"),
    ("09-confirmed-dna", "취향 확정"),
    ("12-day2", "Day 2 지도"),
    ("17-my-trips", "내 여행"),
]
PHONE_WIDTH = 228
PHONE_HEIGHT = round(PHONE_WIDTH * 844 / 390)
PAIR_SPACING = 12
CELL_WIDTH = 2 * PHONE_WIDTH + PAIR_SPACING
COLUMN_GAP = 33
ROW_HEIGHT = PHONE_HEIGHT + 85
PAD = 45
TOP = 126
BOTTOM = 45
FONT_DIR = Path("C:/Windows/Fonts")

canvas = Image.new(
    "RGB",
    (2 * PAD + 3 * CELL_WIDTH + 2 * COLUMN_GAP, TOP + 2 * ROW_HEIGHT + BOTTOM),
    "#F7F7F1",
)
draw = ImageDraw.Draw(canvas)


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ("malgunbd.ttf" if bold else "malgun.ttf")), size)


draw.text((PAD, 27), "Travel DNA  ·  화면 비교", font=font(35, bold=True), fill="#132D36")
draw.text(
    (PAD, 81),
    "Expo Web 390 × 844  ·  동일한 검증용 추천 응답으로 실행",
    font=font(17),
    fill="#4E6469",
)

for index, (filename, title) in enumerate(SAMPLES):
    row, column = divmod(index, 3)
    left = PAD + column * (CELL_WIDTH + COLUMN_GAP)
    top = TOP + row * ROW_HEIGHT
    draw.text((left, top), title, font=font(21, bold=True), fill="#132D36")
    for variant, stage in enumerate(("before", "after")):
        x = left + variant * (PHONE_WIDTH + PAIR_SPACING)
        caption = "수정 전" if stage == "before" else "수정 후"
        draw.text((x, top + 32), caption, font=font(15), fill="#4E6469")
        file = ROOT / stage / "390x844" / f"{filename}.png"
        with Image.open(file) as screenshot:
            assert screenshot.size == (390, 844), f"Unexpected screenshot size: {file}"
            canvas.paste(
                screenshot.convert("RGB").resize((PHONE_WIDTH, PHONE_HEIGHT), Image.Resampling.LANCZOS),
                (x, top + 58),
            )
        draw.rectangle(
            (x - 1, top + 57, x + PHONE_WIDTH, top + 58 + PHONE_HEIGHT),
            outline="#DCE4DD",
        )

draw.text(
    (PAD, canvas.height - 38),
    "원본 캡처는 before/ 및 after/에 있습니다.",
    font=font(14),
    fill="#4E6469",
)
canvas.save(ROOT / "contact-sheet.png", optimize=True)
