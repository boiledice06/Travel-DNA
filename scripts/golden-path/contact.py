"""Create a labeled contact sheet from the original Expo Web captures."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


LABELS = (
    "Brand intro", "Trip setup", "Likert survey", "AI conversation",
    "Requirements", "Confirmed DNA", "Recommendation motion", "All recommendations",
    "Day 1 map", "Day 2 map", "Day 3 map", "Expanded sheet",
    "Place and photo", "Saved places", "My trip", "DNA profile",
)


def main():
    output = Path(__file__).resolve().parents[2] / "presentation" / "final"
    inputs = [path for path in sorted((output / "screenshots").glob("[0-1][0-9]-*.png")) if int(path.name[:2]) <= len(LABELS)]
    if len(inputs) != len(LABELS):
        raise SystemExit(f"Expected {len(LABELS)} screen captures, found {len(inputs)}")
    width, height = 240, 520
    padding, gap, top = 33, 24, 100
    sheet = Image.new("RGB", (2 * padding + 4 * width + 3 * gap, top + 4 * (height + 55)), "#101928")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.load_default(size=28)
    label = ImageFont.load_default(size=16)
    draw.text((padding, 25), "Travel DNA | Seoul Golden Path", font=title, fill="#ffffff")
    draw.text((padding, 61), "Expo Web  /  390 x 844 CSS px  /  DPR 3", font=label, fill="#a7bdc9")
    for index, (path, name) in enumerate(zip(inputs, LABELS, strict=True)):
        x = padding + (index % 4) * (width + gap)
        y = top + (index // 4) * (height + 55)
        with Image.open(path) as image:
            if image.size != (1170, 2532):
                raise SystemExit(f"Unexpected capture size {image.size} for {path.name}")
            sheet.paste(image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS), (x, y))
        draw.text((x, y + height + 10), f"{index + 1:02}  {name}", font=label, fill="#d5efe9")
    sheet.save(output / "contact-sheet.png", optimize=True)


if __name__ == "__main__":
    main()
