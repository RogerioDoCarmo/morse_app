"""
Draws the OmniMorse icon set.

⚠️ Generated rather than exported, deliberately. Every asset here comes from
ONE description of the mark, so the adaptive foreground cannot drift from the
iOS icon, and the monochrome cannot drift from either. A designer hands over
PNGs that are already different from each other; this hands over a function.

The mark is the ring, the message and the waves: an open circle with a gap on
the right, three dots and a dash leaving through the gap, and two arcs carrying
it away. Teal rather than blue because the app is teal — the accent below is
`theme.color.accent`, the same value the UI uses.

Run: python3 tools/generate-icons.py
"""

from PIL import Image, ImageDraw

# The app's own palette. Keep in step with src/theme.
ACCENT = (18, 165, 148)
DEEP = (13, 125, 112)
DARK = (7, 78, 70)
GROUND = (245, 246, 248)
ON_ACCENT = (255, 255, 255)

S = 4  # supersample, for edges PIL will not antialias on its own
SIZE = 1024


def gradient(size, top_left, bottom_right):
    """A diagonal wash, drawn a row at a time and mirrored across the diagonal."""
    image = Image.new("RGB", (size, size), top_left)
    draw = ImageDraw.Draw(image)
    for i in range(size * 2):
        t = i / (size * 2 - 1)
        draw.line(
            [(i, 0), (0, i)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(top_left, bottom_right)),
        )
    return image


def draw_mark(draw, cx, cy, scale, colour):
    """
    The ring, the message, the waves.

    `scale` is a fraction of a 1024 canvas: 1.0 draws the mark at the size the
    full-bleed icon uses. Everything is derived from it so the proportions hold
    at any size — the adaptive foreground is the same drawing, smaller.
    """
    r = 300 * scale
    stroke = round(78 * scale)

    # ⚠️ Optically centred, not geometrically. The waves hang off the right, so
    # centring on the ring leaves the whole group sitting right of middle —
    # which a launcher's circular mask then makes obvious. The content spans
    # cx-339 to cx+487, so the drawing origin shifts left by half that
    # difference.
    cx -= 85 * scale

    # The ring, open on the right so the message has somewhere to go.
    draw.arc(
        [cx - r, cy - r, cx + r, cy + r], start=38, end=322, fill=colour, width=stroke
    )

    # Three dots and a dash, leaving through the gap. The dash crosses the ring
    # deliberately: the message is escaping, not sitting inside a circle.
    dot = 26 * scale
    gap = 72 * scale
    x = cx - 118 * scale
    for _ in range(3):
        draw.ellipse([x - dot, cy - dot, x + dot, cy + dot], fill=colour)
        x += gap
    draw.rounded_rectangle(
        [x - dot, cy - dot, x + 196 * scale, cy + dot], radius=dot, fill=colour
    )

    # Two arcs carrying it away.
    for radius, width in ((392 * scale, 34 * scale), (470 * scale, 34 * scale)):
        draw.arc(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            start=-46,
            end=46,
            fill=colour,
            width=round(width),
        )


def mark_layer(size, scale, colour):
    """The mark alone, on transparency, at `size` px."""
    layer = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(layer), size * S / 2, size * S / 2, scale * S * size / SIZE, colour)
    return layer.resize((size, size), Image.LANCZOS)


def save(image, path):
    image.save(path)
    print(f"  {path}  {image.size[0]}x{image.size[1]}  {image.mode}")


print("icon set:")

# 1. The store / iOS icon. Full bleed, square corners, NO alpha — both stores
#    apply their own mask, and the App Store rejects an alpha channel outright.
full = gradient(SIZE, ACCENT, DARK)
full.paste(mark_layer(SIZE, 0.78, ON_ACCENT), (0, 0), mark_layer(SIZE, 0.78, ON_ACCENT))
save(full, "assets/icon.png")

# 2. Android adaptive foreground. The launcher masks the outer ~25%, so the
#    mark sits inside the 66/108 safe zone and the rest is bleed.
save(mark_layer(SIZE, 0.55, ON_ACCENT), "assets/android-icon-foreground.png")

# 3. Adaptive background: the same wash, flat, no mark.
save(gradient(SIZE, ACCENT, DEEP).convert("RGBA"), "assets/android-icon-background.png")

# 4. Monochrome, for Android 13 themed icons: one colour, the system recolours.
save(mark_layer(SIZE, 0.55, ON_ACCENT), "assets/android-icon-monochrome.png")

# 5. Splash. Teal on the app's own ground, so the splash and the first screen
#    are the same colour rather than a flash of something else.
save(mark_layer(SIZE, 0.62, ACCENT), "assets/splash-icon.png")

# 6. Favicon.
save(mark_layer(48, 0.66, ACCENT), "assets/favicon.png")


# ---------------------------------------------------------------------------
# Store graphics. Not app assets — these go to Play, not into the binary.

import glob
import os

from PIL import ImageFont

FONT_DIR = glob.glob(
    "node_modules/.pnpm/@expo-google-fonts+plus-jakarta-sans*/node_modules/"
    "@expo-google-fonts/plus-jakarta-sans"
)


def jakarta(weight, size):
    """
    The app's own typeface, read out of node_modules.

    Using the real family rather than a system fallback is the difference
    between a store page that looks like the app and one that looks like a
    stock template.
    """
    path = f"{FONT_DIR[0]}/{weight}/PlusJakartaSans_{weight}.ttf"
    return ImageFont.truetype(path, size)


print("store graphics:")
os.makedirs("docs/store-listing/graphics", exist_ok=True)

# Play's feature graphic: 1024x500, shown above the listing.
feature = Image.new("RGB", (1024, 500), ACCENT)
wash = gradient(1024, ACCENT, DARK).crop((0, 200, 1024, 700))
feature.paste(wash, (0, 0))

mark = mark_layer(500, 0.62, ON_ACCENT)
feature.paste(mark, (60, 0), mark)

pen = ImageDraw.Draw(feature)
pen.text((560, 186), "OmniMorse", font=jakarta("800ExtraBold", 76), fill=ON_ACCENT)
pen.text(
    (563, 286),
    "Encode. Decode. Learn.",
    font=jakarta("500Medium", 34),
    fill=(214, 242, 238),
)
save(feature, "docs/store-listing/graphics/play-feature-graphic.png")

# The Play listing icon is the same drawing as the app's, at 512.
save(
    Image.open("assets/icon.png").resize((512, 512), Image.LANCZOS),
    "docs/store-listing/graphics/play-icon-512.png",
)
