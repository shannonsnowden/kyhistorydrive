"""Simplified favicon mark for seal v2: amber serif K inside an amber ring on a deep-green disc
(site palette: amber #c9893a, brighter #d99a45 at 16px where it needs more contrast; no gold, no black).
The full seal stays in the header; apple-touch-icon (180px) uses this mark, drawn natively at 180.
At 16px and below the inner ring is dropped (rim + K only) so the K keeps its pixels.
Run: python3 scripts/brand-src/make-favicon.py  (needs Pillow and DejaVu Serif Bold)."""
from PIL import Image, ImageDraw, ImageFont
AMBER = (0xc9, 0x89, 0x3a, 255)       # #c9893a
AMBER_HI = (0xd9, 0x9a, 0x45, 255)    # #d99a45, used at 16px for contrast
GREEN = (0x1f, 0x3d, 0x2a, 255)       # deep green #1f3d2a
RIM = (0x2e, 0x5a, 0x3e, 255)         # lighter green #2e5a3e, 1px rim so the disc reads on dark tabs
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'

def mark(size):
    s = 16  # supersample
    W = size * s
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ink = AMBER_HI if size <= 16 else AMBER
    d.ellipse((0, 0, W - 1, W - 1), fill=GREEN, outline=RIM, width=s)  # 1px rim at native size
    if size > 16:  # at 16px and below the inner ring muddies the K; keep just the rim and K
        ring = max(1, round(size / 16)) * s  # 2px at 32
        inset = ring + 2 * s  # clear of the 1px rim
        d.ellipse((inset * 0.5, inset * 0.5, W - 1 - inset * 0.5, W - 1 - inset * 0.5), outline=ink, width=ring)
    f = ImageFont.truetype(FONT, int(W * 0.66))
    box = d.textbbox((0, 0), 'K', font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((W - tw) / 2 - box[0], (W - th) / 2 - box[1]), 'K', font=f, fill=ink)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    mark(32).save('public/favicon-32.png', optimize=True)
    # Google Search wants a multiple of 48px; each is drawn at its own size (supersampled down, never upscaled).
    for n in (48, 96):
        mark(n).save(f'public/favicon-{n}.png', optimize=True)
    # Apple touch icon: same mark drawn natively at 180px (no upscaling).
    mark(180).save('public/apple-touch-icon.png', optimize=True)
    big = mark(48)
    big.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[mark(16), mark(32)])
    for n in (16, 32, 48):
        mark(n).save(f'scripts/brand-src/favicon-preview-{n}.png')
