# Renders scripts/icon-src/*.svg to 90x90 RGBA PNGs in public/icons/ (matches the existing icon set). Run by hand.
# Each icon is fitted (as vector, never raster-scaled) so its artwork fills a common 80% safe area (72px), centered.
import cairosvg, glob, io, os, re
from PIL import Image
SAFE = 72
for f in glob.glob(os.path.join(os.path.dirname(__file__), 'icon-src', '*.svg')):
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons', os.path.basename(f)[:-4] + '.png')
    svg = open(f).read()
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=900, output_height=900)))
    x0, y0, x1, y1 = [v / 10 for v in im.getchannel('A').getbbox()]
    side = max(x1 - x0, y1 - y0) * 90 / SAFE
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vb = f'{cx - side / 2:.2f} {cy - side / 2:.2f} {side:.2f} {side:.2f}'
    svg = re.sub(r'viewBox="[^"]*"', f'viewBox="{vb}"', svg, count=1)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=out, output_width=90, output_height=90)
    print(out, vb)
