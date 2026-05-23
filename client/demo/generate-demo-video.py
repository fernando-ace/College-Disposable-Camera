"""Generate the EventFilm landing-page guest upload demo video.

This script is intentionally self-contained so the demo can be regenerated
without hand-editing video software. It writes:

- client/public/demo/guest-upload-demo.mp4
- client/public/demo/guest-upload-demo.webm
- client/public/demo/guest-upload-poster.webp

Dependencies: pillow, numpy, imageio, imageio-ffmpeg.
"""

from __future__ import annotations

import argparse
import io
import math
import random
import urllib.request
from pathlib import Path

import imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "demo"
WIDTH = 780
HEIGHT = 1688
FPS = 25
SOURCE_DURATION = 25.0
SPEED = 2.0
OUTPUT_DURATION = SOURCE_DURATION / SPEED
FRAME_COUNT = int(OUTPUT_DURATION * FPS)

INK = (24, 24, 27)
MUTED = (93, 86, 78)
ORANGE = (220, 55, 18)
AMBER = (255, 247, 237)
STONE = (250, 250, 249)
LINE = (231, 229, 228)
GREEN = (18, 128, 91)


def box_center(box: tuple[int, int, int, int]) -> tuple[int, int]:
    return ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2)

SOURCE_PHOTO_URLS = [
    "https://images.unsplash.com/photo-1758272133833-3a2277d426e4?auto=format&fit=crop&fm=jpg&q=80&w=1400",
    "https://images.unsplash.com/photo-1758272134073-39aced2153e6?auto=format&fit=crop&fm=jpg&q=80&w=1400",
    "https://images.unsplash.com/photo-1758272133754-0f2759e44523?auto=format&fit=crop&fm=jpg&q=80&w=1400",
    "https://images.unsplash.com/photo-1760310509217-758725053b02?auto=format&fit=crop&fm=jpg&q=80&w=1400",
    "https://images.unsplash.com/photo-1768776184097-cf035ece5dd9?auto=format&fit=crop&fm=jpg&q=80&w=1400",
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONTS = {
    "tiny": font(16),
    "tiny_b": font(16, True),
    "small": font(20),
    "small_b": font(20, True),
    "body": font(24),
    "body_b": font(24, True),
    "mid": font(32, True),
    "large": font(44, True),
    "xl": font(62, True),
}


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - pow(1 - x, 3)


def lerp(a: float, b: float, x: float) -> float:
    return a + (b - a) * x


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy, value: str, fill=INK, f=None, anchor=None):
    draw.text(xy, value, fill=fill, font=f or FONTS["body"], anchor=anchor)


def text_size(draw: ImageDraw.ImageDraw, value: str, f) -> tuple[int, int]:
    box = draw.textbbox((0, 0), value, font=f)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, value: str, max_width: int, f) -> list[str]:
    words = value.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if text_size(draw, candidate, f)[0] <= max_width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def grain(img: Image.Image, amount: int = 16) -> Image.Image:
    arr = np.array(img).astype(np.int16)
    noise = np.random.default_rng(7).normal(0, amount, arr.shape[:2])
    arr[:, :, 0] = np.clip(arr[:, :, 0] + noise, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] + noise * 0.65, 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] + noise * 0.35, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def square_crop(img: Image.Image, w: int = 420, h: int = 420) -> Image.Image:
    img = img.convert("RGB")
    src_w, src_h = img.size
    side = min(src_w, src_h)
    left = (src_w - side) // 2
    top = (src_h - side) // 2
    cropped = img.crop((left, top, left + side, top + side)).resize((w, h), Image.Resampling.LANCZOS)
    return film_grade(cropped)


def film_grade(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    warm = Image.new("RGB", img.size, (255, 220, 176))
    img = Image.blend(img, warm, 0.08)
    d = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    d.ellipse((-w * 0.35, -h * 0.32, w * 0.85, h * 0.78), fill=(255, 255, 255, 22))
    vignette = Image.new("L", img.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-w // 8, -h // 8, w + w // 8, h + h // 8), fill=170)
    shade = Image.new("RGBA", img.size, (18, 12, 8, 58))
    img = Image.composite(img.convert("RGBA"), Image.alpha_composite(img.convert("RGBA"), shade), vignette).convert("RGB")
    return grain(img.filter(ImageFilter.GaussianBlur(0.18)), 8)


def load_remote_photos() -> list[Image.Image]:
    photos: list[Image.Image] = []
    for url in SOURCE_PHOTO_URLS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "EventFilm demo renderer"})
            with urllib.request.urlopen(req, timeout=20) as response:
                photos.append(square_crop(Image.open(io.BytesIO(response.read()))))
        except Exception:
            continue
    return photos


def make_photo(seed: int, w: int = 420, h: int = 420) -> Image.Image:
    rng = random.Random(seed)
    base = Image.new("RGB", (w, h), (35, 29, 30))
    px = base.load()
    top = rng.choice([(251, 177, 92), (242, 140, 124), (120, 181, 198), (198, 150, 204)])
    bottom = rng.choice([(26, 112, 76), (236, 204, 129), (76, 69, 96), (180, 79, 76)])
    for y in range(h):
        a = y / h
        for x in range(w):
            flash = 36 * max(0, 1 - math.hypot((x - w * 0.5) / w, (y - h * 0.24) / h) * 2.2)
            px[x, y] = tuple(int(lerp(top[i], bottom[i], a) + flash) for i in range(3))

    d = ImageDraw.Draw(base, "RGBA")

    # String lights and ambient bokeh.
    for i in range(10):
        x = int(i * w / 9)
        y = int(48 + 24 * math.sin(i * 0.9 + seed))
        d.line((x - 30, y - 8, x + 30, y + 8), fill=(255, 236, 190, 80), width=2)
        r = rng.randint(10, 20)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 236, 176, 150))

    # Blurry people/candid silhouettes.
    for _ in range(4):
        cx = rng.randint(60, w - 60)
        cy = rng.randint(168, h - 54)
        shirt = rng.choice([(250, 245, 230, 205), (243, 112, 83, 210), (52, 123, 163, 210), (245, 190, 70, 210)])
        skin = rng.choice([(116, 71, 48, 230), (186, 126, 83, 230), (221, 166, 116, 230)])
        d.ellipse((cx - 24, cy - 90, cx + 24, cy - 42), fill=skin)
        d.rounded_rectangle((cx - 42, cy - 44, cx + 42, cy + 70), radius=26, fill=shirt)

    # Table/cups/foreground detail.
    d.rounded_rectangle((20, h - 90, w - 20, h + 24), radius=34, fill=(42, 30, 26, 150))
    for _ in range(5):
        x = rng.randint(40, w - 60)
        y = rng.randint(h - 112, h - 62)
        d.rounded_rectangle((x, y, x + 28, y + 46), radius=8, fill=(255, 255, 255, 145), outline=(255, 255, 255, 190), width=2)

    base = base.filter(ImageFilter.GaussianBlur(0.65))
    d = ImageDraw.Draw(base, "RGBA")
    d.ellipse((-w * 0.25, -h * 0.26, w * 0.8, h * 0.72), fill=(255, 255, 255, 22))
    base = grain(base, 11)

    # Disposable camera vignette.
    vignette = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-w // 6, -h // 6, w + w // 6, h + h // 5), fill=170)
    shade = Image.new("RGBA", (w, h), (16, 10, 8, 78))
    base = Image.composite(base.convert("RGBA"), Image.alpha_composite(base.convert("RGBA"), shade), vignette).convert("RGB")
    return base


PHOTOS = load_remote_photos()
if len(PHOTOS) < 4:
    PHOTOS = [make_photo(i) for i in range(1, 7)]
else:
    while len(PHOTOS) < 6:
        PHOTOS.append(make_photo(len(PHOTOS) + 1))


def backdrop() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), (250, 248, 244))
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(HEIGHT):
        a = y / HEIGHT
        color = (
            int(252 - 6 * a),
            int(248 - 3 * a),
            int(240 + 9 * a),
            255,
        )
        d.line((0, y, WIDTH, y), fill=color)
    d.ellipse((-130, 1040, 910, 1850), fill=(237, 228, 216, 105))
    d.ellipse((420, -160, 1060, 520), fill=(255, 226, 199, 72))
    return img


def draw_step(draw: ImageDraw.ImageDraw, number: int, label: str, alpha: float = 1.0):
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    fill = (255, 250, 244, int(245 * alpha))
    outline = (247, 196, 145, int(140 * alpha))
    rounded(d, (64, 46, WIDTH - 64, 186), 32, fill, outline, 2)
    text(d, (92, 80), f"STEP {number}", (ORANGE[0], ORANGE[1], ORANGE[2], int(255 * alpha)), FONTS["tiny_b"])
    text(d, (92, 108), label, (INK[0], INK[1], INK[2], int(255 * alpha)), FONTS["large"])
    return layer


def draw_qr(d: ImageDraw.ImageDraw, x: int, y: int, size: int):
    rounded(d, (x, y, x + size, y + size), 22, (255, 255, 255), LINE, 2)
    cell = size // 9
    pattern = [
        "111010111",
        "101000101",
        "111011101",
        "000100000",
        "110010101",
        "001101010",
        "101010111",
        "100111001",
        "111001101",
    ]
    pad = (size - cell * 9) // 2
    for row, line in enumerate(pattern):
        for col, bit in enumerate(line):
            if bit == "1":
                d.rounded_rectangle(
                    (x + pad + col * cell + 2, y + pad + row * cell + 2, x + pad + (col + 1) * cell - 2, y + pad + (row + 1) * cell - 2),
                    radius=4,
                    fill=(18, 20, 32),
                )


def intro_scene(t: float) -> Image.Image:
    img = backdrop().convert("RGBA")
    img.alpha_composite(draw_step(ImageDraw.Draw(img), 1, "Scan QR code or open link"))
    d = ImageDraw.Draw(img, "RGBA")
    p = ease(min(1, max(0, (t - 0.15) / 0.9)))
    card_w, card_h = 520, 610
    x = int(lerp(130, 130, p))
    y = int(lerp(690, 560, p))
    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded(sd, (x, y + 28, x + card_w, y + card_h + 28), 36, (0, 0, 0, int(34 * p)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    img.alpha_composite(shadow)
    rounded(d, (x, y, x + card_w, y + card_h), 34, (255, 255, 255, int(255 * p)), (228, 226, 224, int(255 * p)), 2)
    text(d, (x + 48, y + 52), "Summer Party", INK + (255,), FONTS["xl"])
    text(d, (x + 48, y + 114), "Demo", INK + (255,), FONTS["xl"])
    text(d, (x + 48, y + 194), "Guests scan a QR code or open the", MUTED + (255,), FONTS["body"])
    text(d, (x + 48, y + 232), "event link.", MUTED + (255,), FONTS["body"])
    draw_qr(d, x + 168, y + 282, 184)
    text(d, (x + card_w // 2, y + 502), "OR OPEN", MUTED, FONTS["tiny_b"], "mm")
    rounded(d, (x + 84, y + 520, x + card_w - 84, y + 574), 27, (255, 248, 238), (246, 211, 170), 2)
    text(d, (x + card_w // 2, y + 547), "eventfilm.app/e/summer", (176, 60, 20), FONTS["body_b"], "mm")
    return img.convert("RGB")


PHONE_X = 142
PHONE_Y = 248
PHONE_W = 496
PHONE_H = 1190
BEZEL = 18
SCREEN_X = PHONE_X + BEZEL
SCREEN_Y = PHONE_Y + BEZEL
SCREEN_W = PHONE_W - BEZEL * 2
SCREEN_H = PHONE_H - BEZEL * 2


def phone_shell(img: Image.Image) -> ImageDraw.ImageDraw:
    d = ImageDraw.Draw(img, "RGBA")
    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded(sd, (PHONE_X + 8, PHONE_Y + 28, PHONE_X + PHONE_W + 8, PHONE_Y + PHONE_H + 28), 62, (0, 0, 0, 50))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    rounded(d, (PHONE_X, PHONE_Y, PHONE_X + PHONE_W, PHONE_Y + PHONE_H), 48, (17, 17, 17), None)
    rounded(d, (SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H), 34, (255, 255, 255), None)
    return d


def app_header(d: ImageDraw.ImageDraw):
    text(d, (SCREEN_X + 24, SCREEN_Y + 26), "EventFilm", INK, FONTS["small_b"])
    button = (SCREEN_X + SCREEN_W - 116, SCREEN_Y + 15, SCREEN_X + SCREEN_W - 18, SCREEN_Y + 51)
    text(d, (button[0] - 18, SCREEN_Y + 33), "Host login", INK, FONTS["tiny_b"], "rm")
    rounded(d, button, 14, ORANGE)
    text(d, box_center(button), "Book beta", (255, 255, 255), FONTS["tiny_b"], "mm")


def upload_layout() -> dict[str, tuple[int, int, int, int]]:
    y = SCREEN_Y + 86
    form_y = y + 252
    return {
        "name": (SCREEN_X + 44, form_y + 122, SCREEN_X + SCREEN_W - 44, form_y + 174),
        "take": (SCREEN_X + 44, form_y + 278, SCREEN_X + SCREEN_W - 44, form_y + 338),
        "library": (SCREEN_X + 44, form_y + 358, SCREEN_X + SCREEN_W - 44, form_y + 412),
        "selected": (SCREEN_X + 44, form_y + 430, SCREEN_X + SCREEN_W - 44, form_y + 516),
        "upload": (SCREEN_X + 44, form_y + 534, SCREEN_X + SCREEN_W - 44, form_y + 594),
        "success": (SCREEN_X + 44, form_y + 534, SCREEN_X + SCREEN_W - 44, form_y + 590),
    }


def guest_page(img: Image.Image, d: ImageDraw.ImageDraw, name: str, selected=False, uploaded=False, album=False):
    app_header(d)
    y = SCREEN_Y + 86
    text(d, (SCREEN_X + 28, y), "Summer Party Demo", INK, FONTS["mid"])
    text(d, (SCREEN_X + 28, y + 44), "Scan the QR, add your name, and upload", MUTED, FONTS["small"])
    text(d, (SCREEN_X + 28, y + 74), "a favorite moment.", MUTED, FONTS["small"])
    text(d, (SCREEN_X + 28, y + 116), "Reveal: Tonight, 11:00 PM", MUTED, FONTS["small"])
    rounded(d, (SCREEN_X + 28, y + 152, SCREEN_X + SCREEN_W - 28, y + 224), 10, (255, 251, 235))
    text(d, (SCREEN_X + 48, y + 178), "Photos are locked until the reveal", (161, 80, 14), FONTS["tiny_b"])
    text(d, (SCREEN_X + 48, y + 202), "time.", (161, 80, 14), FONTS["tiny_b"])

    form_y = y + 252
    if album:
        rounded(d, (SCREEN_X + 18, form_y, SCREEN_X + SCREEN_W - 18, form_y + 502), 18, (255, 255, 255), LINE, 1)
        text(d, (SCREEN_X + 44, form_y + 36), "Album", INK, FONTS["mid"])
        rounded(d, (SCREEN_X + 44, form_y + 82, SCREEN_X + SCREEN_W - 44, form_y + 128), 10, (236, 253, 245))
        text(d, (SCREEN_X + 62, form_y + 105), "Photos unlocked. Relive the night.", GREEN, FONTS["tiny_b"], "lm")
        grid_y = form_y + 154
        size = 168
        gap = 16
        for i, photo in enumerate(PHOTOS[:4]):
            x = SCREEN_X + 44 + (i % 2) * (size + gap)
            yy = grid_y + (i // 2) * (size + gap)
            crop = photo.resize((size, size), Image.Resampling.LANCZOS)
            mask = Image.new("L", (size, size), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=14, fill=255)
            img.paste(crop, (x, yy), mask)
        return

    form_h = 650 if (selected or uploaded) else 500
    rounded(d, (SCREEN_X + 18, form_y, SCREEN_X + SCREEN_W - 18, form_y + form_h), 18, (255, 255, 255), LINE, 1)
    text(d, (SCREEN_X + 44, form_y + 32), "Upload a photo", INK, FONTS["mid"])
    text(d, (SCREEN_X + 44, form_y + 92), "Name or nickname", INK, FONTS["tiny_b"])
    layout = upload_layout()
    rounded(d, layout["name"], 10, (255, 255, 255), (218, 216, 214), 1)
    text(d, (SCREEN_X + 64, form_y + 148), name or "John Doe", (INK if name else (160, 154, 148)), FONTS["small"], "lm")
    text(d, (SCREEN_X + 44, form_y + 204), "5 uploads left", MUTED, FONTS["small"])
    text(d, (SCREEN_X + 44, form_y + 246), "Photo", INK, FONTS["tiny_b"])
    rounded(d, layout["take"], 12, ORANGE)
    text(d, box_center(layout["take"]), "Take photo", (255, 255, 255), FONTS["small_b"], "mm")
    rounded(d, layout["library"], 10, (255, 255, 255), (218, 216, 214), 1)
    text(d, box_center(layout["library"]), "Choose from library", INK, FONTS["small_b"], "mm")

    if selected:
        card_y = layout["selected"][1]
        rounded(d, layout["selected"], 12, (250, 250, 249), LINE, 1)
        thumb = PHOTOS[0].resize((66, 66), Image.Resampling.LANCZOS)
        mask = Image.new("L", (66, 66), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 66, 66), radius=10, fill=255)
        img.paste(thumb, (SCREEN_X + 58, card_y + 10), mask)
        text(d, (SCREEN_X + 140, card_y + 26), "summer-photo.jpg", INK, FONTS["tiny_b"])
        text(d, (SCREEN_X + 140, card_y + 56), "Ready to upload", MUTED, FONTS["tiny"])
        rounded(d, layout["upload"], 12, ORANGE)
        text(d, box_center(layout["upload"]), "Upload photo", (255, 255, 255), FONTS["small_b"], "mm")

    if uploaded:
        rounded(d, layout["success"], 10, (240, 253, 244))
        text(d, (SCREEN_X + 62, (layout["success"][1] + layout["success"][3]) // 2), "Photo uploaded", GREEN, FONTS["small_b"], "lm")


def clip_screen_to_rounded_phone(img: Image.Image):
    screen_box = (SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H)
    crop = img.crop(screen_box)
    mask = Image.new("L", (SCREEN_W, SCREEN_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SCREEN_W, SCREEN_H), radius=34, fill=255)
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle(screen_box, fill=(17, 17, 17))
    img.paste(crop, (SCREEN_X, SCREEN_Y), mask)


def keyboard(d: ImageDraw.ImageDraw, active: str | None):
    y = SCREEN_Y + SCREEN_H - 316
    d.rectangle((SCREEN_X, y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H), fill=(230, 233, 239))
    rows = [("QWERTYUIOP", 20), ("ASDFGHJKL", 42), ("ZXCVBNM", 78)]
    key_w, key_h, gap = 34, 44, 8
    for row, offset in rows:
        x = SCREEN_X + offset
        for ch in row:
            fill = (190, 195, 203) if active == ch else (255, 255, 255)
            rounded(d, (x, y + 30, x + key_w, y + 30 + key_h), 9, fill)
            text(d, (x + key_w // 2, y + 52), ch, INK, FONTS["tiny_b"], "mm")
            x += key_w + gap
        y += 58
    rounded(d, (SCREEN_X + 132, SCREEN_Y + SCREEN_H - 80, SCREEN_X + 286, SCREEN_Y + SCREEN_H - 38), 9, (255, 255, 255))
    text(d, (SCREEN_X + 209, SCREEN_Y + SCREEN_H - 59), "space", MUTED, FONTS["tiny"], "mm")
    rounded(d, (SCREEN_X + 308, SCREEN_Y + SCREEN_H - 80, SCREEN_X + 412, SCREEN_Y + SCREEN_H - 38), 9, (255, 255, 255))
    text(d, (SCREEN_X + 360, SCREEN_Y + SCREEN_H - 59), "return", INK, FONTS["tiny"], "mm")


def tap(d: ImageDraw.ImageDraw, t: float, center: tuple[int, int], start: float):
    progress = (t - start) / 0.55
    if 0 <= progress <= 1:
        r = int(14 + 38 * progress)
        alpha = int(125 * (1 - progress))
        d.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), outline=(ORANGE[0], ORANGE[1], ORANGE[2], alpha), width=3)


def press_box(d: ImageDraw.ImageDraw, t: float, box: tuple[int, int, int, int], start: float):
    progress = (t - start) / 0.45
    if 0 <= progress <= 1:
        pad = int(2 + 8 * progress)
        alpha = int(190 * (1 - progress))
        d.rounded_rectangle(
            (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad),
            radius=14 + pad,
            outline=(ORANGE[0], ORANGE[1], ORANGE[2], alpha),
            width=4,
        )


def phone_scene(t: float) -> Image.Image:
    img = backdrop().convert("RGBA")
    if t < 11:
        img.alpha_composite(draw_step(ImageDraw.Draw(img), 2, "Add your name"))
    elif t < 18.3:
        img.alpha_composite(draw_step(ImageDraw.Draw(img), 3, "Upload photo"))
    else:
        img.alpha_composite(draw_step(ImageDraw.Draw(img), 4, "View unlocked photos"))
    d = phone_shell(img)

    typed = ""
    active_key = None
    letters = "Avery"
    if t >= 6.1:
        idx = min(len(letters), max(0, int((t - 6.1) / 0.55) + 1))
        typed = letters[:idx]
        if idx <= len(letters):
            active_key = letters[idx - 1].upper()

    selected = t >= 14.7
    uploaded = 17.2 <= t < 19.2
    album = t >= 19.2
    guest_page(img, d, typed, selected=selected and not album, uploaded=uploaded, album=album)

    if 5.55 <= t < 10.25:
        keyboard(d, active_key)
    layout = upload_layout()
    tap(d, t, box_center(layout["name"]), 5.25)
    press_box(d, t, layout["take"], 11.25)
    press_box(d, t, layout["upload"], 16.65)

    if 11.9 <= t < 14.65:
        draw_camera(img, t)

    clip_screen_to_rounded_phone(img)
    d = ImageDraw.Draw(img, "RGBA")
    # Home indicator; always visible and inside the canvas.
    d.rounded_rectangle((PHONE_X + 178, PHONE_Y + PHONE_H - 10, PHONE_X + 318, PHONE_Y + PHONE_H - 4), radius=5, fill=(230, 72, 31))
    return img.convert("RGB")


def draw_camera(img: Image.Image, t: float):
    d = ImageDraw.Draw(img, "RGBA")
    rounded(d, (SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H), 36, (12, 12, 13))
    view_x, view_y = SCREEN_X + 26, SCREEN_Y + 90
    view_w, view_h = SCREEN_W - 52, SCREEN_H - 230
    photo = PHOTOS[1].resize((view_w, view_h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (view_w, view_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, view_w, view_h), radius=24, fill=255)
    img.paste(photo, (view_x, view_y), mask)
    d.rectangle((view_x + 28, view_y + 28, view_x + view_w - 28, view_y + view_h - 28), outline=(255, 255, 255, 75), width=2)
    shutter = (SCREEN_X + SCREEN_W // 2, SCREEN_Y + SCREEN_H - 92)
    d.ellipse((shutter[0] - 48, shutter[1] - 48, shutter[0] + 48, shutter[1] + 48), outline=(255, 255, 255, 255), width=8)
    if 13.15 <= t <= 13.62:
        p = 1 - abs(t - 13.38) / 0.24
        d.rectangle((SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H), fill=(255, 255, 255, int(190 * max(0, p))))
    tap(d, t, shutter, 13.0)


def frame_at(second: float) -> Image.Image:
    if second < 4.2:
        return intro_scene(second)
    alpha = ease((second - 4.2) / 0.6)
    intro = intro_scene(3.8).convert("RGBA")
    phone = phone_scene(second).convert("RGBA")
    return Image.blend(intro, phone, alpha).convert("RGB")


def write_video(path: Path, codec: str, quality: int = 8):
    kwargs = {
        "fps": FPS,
        "codec": codec,
        "macro_block_size": 1,
        "ffmpeg_params": ["-pix_fmt", "yuv420p"],
    }
    if codec == "libvpx-vp9":
        kwargs["ffmpeg_params"] = ["-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "34"]
    else:
        kwargs["quality"] = quality
    with imageio.get_writer(path, **kwargs) as writer:
        for i in range(FRAME_COUNT):
            writer.append_data(np.asarray(frame_at((i / FPS) * SPEED)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--poster-only", action="store_true")
    args = parser.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    poster = frame_at(1.0)
    poster.save(OUT_DIR / "guest-upload-poster.webp", quality=88, method=6)
    if args.poster_only:
        return

    write_video(OUT_DIR / "guest-upload-demo.mp4", "libx264", 9)
    write_video(OUT_DIR / "guest-upload-demo.webm", "libvpx-vp9", 8)


if __name__ == "__main__":
    main()
