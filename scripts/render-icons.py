# Renders scripts/icon-src/*.svg to 90x90 RGBA PNGs in public/icons/ (matches the existing icon set). Run by hand.
import cairosvg, glob, os
for f in glob.glob(os.path.join(os.path.dirname(__file__), 'icon-src', '*.svg')):
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons', os.path.basename(f)[:-4] + '.png')
    cairosvg.svg2png(url=f, write_to=out, output_width=90, output_height=90)
    print(out)
