"""Simplified favicon mark for seal v2: gold serif K inside a gold ring on the seal's black.
The full seal stays for apple-touch-icon (180px) and the header; at 16/32px only this mark reads.
Run: python3 scripts/brand-src/make-favicon.py  (needs Pillow and DejaVu Serif Bold)."""
from PIL import Image, ImageDraw, ImageFont
GOLD = (214, 178, 106, 255)
BLACK = (12, 12, 10, 255)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'

def mark(size):
    s = 16  # supersample
    W = size * s
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, W - 1, W - 1), fill=BLACK)
    ring = max(1, round(size / 16)) * s  # 1px at 16, 2px at 32
    inset = ring  # small gap from the edge
    d.ellipse((inset * 0.5, inset * 0.5, W - 1 - inset * 0.5, W - 1 - inset * 0.5), outline=GOLD, width=ring)
    f = ImageFont.truetype(FONT, int(W * 0.66))
    box = d.textbbox((0, 0), 'K', font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((W - tw) / 2 - box[0], (W - th) / 2 - box[1]), 'K', font=f, fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    mark(32).save('public/favicon-32.png', optimize=True)
    big = mark(48)
    big.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[mark(16), mark(32)])
    for n in (16, 32, 48):
        mark(n).save(f'scripts/brand-src/favicon-preview-{n}.png')
