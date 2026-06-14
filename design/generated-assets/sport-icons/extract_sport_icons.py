from __future__ import annotations

from pathlib import Path
from collections import deque

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
COLOR_SRC = Path.home() / "Downloads" / "Adobe Express - file(1).png"
MONO_SRC = Path.home() / "Downloads" / "Adobe Express - file.png"
ASSET_ROOT = ROOT / "public" / "assets" / "sport-icons"
DESIGN_ROOT = ROOT / "design" / "generated-assets" / "sport-icons"

CROPS = {
    "soccer": (78, 48, 430, 365),
    "basketball": (500, 42, 790, 360),
    "football": (875, 52, 1212, 356),
    "motorsport": (40, 385, 470, 640),
    "combat": (505, 360, 760, 675),
    "track": (900, 378, 1215, 642),
    "olympic": (58, 665, 248, 1012),
    "tennis": (358, 680, 660, 1016),
    "hockey": (698, 665, 965, 1016),
    "golf": (1030, 665, 1233, 1010),
    "custom": (494, 1000, 804, 1218),
}


def trim(image: Image.Image, pad: int = 8) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def remove_edge_scraps(image: Image.Image, min_area: int = 120, keep_count: int = 6) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A").load()
    seen = bytearray(width * height)
    components: list[dict[str, object]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or alpha[x, y] < 12:
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            seen[index] = 1
            points: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        next_index = ny * width + nx
                        if not seen[next_index] and alpha[nx, ny] >= 12:
                            seen[next_index] = 1
                            queue.append((nx, ny))
            if len(points) >= min_area:
                xs = [point[0] for point in points]
                ys = [point[1] for point in points]
                components.append(
                    {
                        "points": points,
                        "area": len(points),
                        "bbox": (min(xs), min(ys), max(xs), max(ys)),
                    }
                )

    components.sort(key=lambda component: int(component["area"]), reverse=True)
    keep: list[dict[str, object]] = []
    for component in components:
        left, top, right, bottom = component["bbox"]  # type: ignore[misc]
        area = int(component["area"])
        is_edge_scrap = (right < 10 or left > width - 10 or bottom < 10 or top > height - 10) and area < 8000
        if is_edge_scrap:
            continue
        keep.append(component)
        if len(keep) >= keep_count:
            break

    mask = Image.new("L", (width, height), 0)
    mask_pixels = mask.load()
    for component in keep:
        for x, y in component["points"]:  # type: ignore[union-attr]
            mask_pixels[x, y] = alpha[x, y]

    output = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    output.paste(image, (0, 0), mask)
    return output


def square(image: Image.Image, size: int = 512) -> Image.Image:
    image = trim(image).convert("RGBA")
    ratio = min((size * 0.88) / image.width, (size * 0.88) / image.height)
    resized = image.resize((max(1, int(image.width * ratio)), max(1, int(image.height * ratio))), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    output.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return output


def process(source: Path, variant: str) -> None:
    sheet = Image.open(source).convert("RGBA")
    for key, box in CROPS.items():
        crop = sheet.crop(box)
        final = square(remove_edge_scraps(crop))
        for base in (ASSET_ROOT, DESIGN_ROOT):
            final.save(base / variant / f"{key}.png", optimize=True)
        crop.save(DESIGN_ROOT / variant / f"{key}-raw-crop.png", optimize=True)


def contact_sheet() -> None:
    keys = list(CROPS.keys())
    cell = 190
    sheet = Image.new("RGBA", (cell * 4, cell * 6), (18, 15, 12, 255))
    draw = ImageDraw.Draw(sheet)
    for row, variant in enumerate(["neon-3d", "mono-glow"]):
        draw.text((10, row * cell * 3 + 8), variant, fill=(240, 230, 210, 255))
        for index, key in enumerate(keys):
            x = (index % 4) * cell
            y = row * cell * 3 + 30 + (index // 4) * cell
            icon = Image.open(ASSET_ROOT / variant / f"{key}.png").resize((128, 128), Image.Resampling.LANCZOS)
            sheet.alpha_composite(icon, (x + 31, y + 14))
            draw.text((x + 10, y + 150), key, fill=(240, 230, 210, 255))
    sheet.save(DESIGN_ROOT / "contact-sheet-desktop-export.png")


def main() -> None:
    for directory in [ASSET_ROOT / "neon-3d", ASSET_ROOT / "mono-glow", DESIGN_ROOT / "neon-3d", DESIGN_ROOT / "mono-glow"]:
        directory.mkdir(parents=True, exist_ok=True)
    process(COLOR_SRC, "neon-3d")
    process(MONO_SRC, "mono-glow")
    contact_sheet()


if __name__ == "__main__":
    main()
