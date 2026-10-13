#!/usr/bin/env python3
"""Draw the 1200x630 /roads-and-rails/ share card natively (no upscaling): green field,
county lines, railroads in amber and parkways in sage, from public/maps/transport/*.geojson.
Rendered at 2x and downsampled. Output: public/brand/og-roads-and-rails.png. Run by hand."""
import json, math, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(__file__), '..')
W, H, S = 1200, 630, 2
BG, LINE, RAIL, PARK, TEXT, HEAD, MUTED = '#1a241c', '#2e4034', '#c9893a', '#a8b59c', '#f3ead8', '#e8d5a8', '#a8b59c'
def load(n):
    d = json.load(open(os.path.join(ROOT, 'public/maps/transport', n)))
    return d['features'] if 'features' in d else [{'geometry': g} for g in d['geometries']]
def lines(g):
    t = g['type']; c = g['coordinates']
    return [c] if t == 'LineString' else c if t == 'MultiLineString' else [r for p in c for r in p] if t == 'MultiPolygon' else c if t == 'Polygon' else []
counties = load('county-lines.geojson'); rail = load('rail.geojson'); park = load('parkways.geojson')
pts = [p for f in counties for l in lines(f['geometry']) for p in l]
lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts); lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
k = math.cos(math.radians((lat0 + lat1) / 2))
box = (40, 150, 760, 600)
sc = min((box[2] - box[0]) / ((lon1 - lon0) * k), (box[3] - box[1]) / (lat1 - lat0))
ox = box[0] + ((box[2] - box[0]) - (lon1 - lon0) * k * sc) / 2; oy = box[1] + ((box[3] - box[1]) - (lat1 - lat0) * sc) / 2
def xy(p): return ((ox + (p[0] - lon0) * k * sc) * S, (oy + (lat1 - p[1]) * sc) * S)
im = Image.new('RGB', (W * S, H * S), BG); d = ImageDraw.Draw(im)
for f in counties:
    for l in lines(f['geometry']): d.line([xy(p) for p in l], fill=LINE, width=2 * S)
for f in park:
    for l in lines(f['geometry']): d.line([xy(p) for p in l], fill=PARK, width=4 * S, joint='curve')
for f in rail:
    for l in lines(f['geometry']): d.line([xy(p) for p in l], fill=RAIL, width=3 * S, joint='curve')
F = '/usr/share/fonts/truetype/dejavu/'
ft = ImageFont.truetype(F + 'DejaVuSerif-Bold.ttf', 76 * S); fs = ImageFont.truetype(F + 'DejaVuSerif.ttf', 30 * S); fk = ImageFont.truetype(F + 'DejaVuSans.ttf', 24 * S)
d.text((56 * S, 40 * S), 'Roads & Rails', font=ft, fill=HEAD)
d.text((60 * S, 128 * S), "Kentucky's railroads and parkways, year by year", font=fs, fill=TEXT)
lx, ly = 800, 470
d.line([(lx * S, ly * S), ((lx + 48) * S, ly * S)], fill=RAIL, width=6 * S); d.text(((lx + 62) * S, (ly - 15) * S), 'Railroads', font=fk, fill=TEXT)
d.line([(lx * S, (ly + 44) * S), ((lx + 48) * S, (ly + 44) * S)], fill=PARK, width=8 * S); d.text(((lx + 62) * S, (ly + 29) * S), 'Parkways', font=fk, fill=TEXT)
d.text((lx * S, (ly + 92) * S), 'kyhistorydrive.com', font=fk, fill=RAIL)
d.rectangle([0, (H - 10) * S, W * S, H * S], fill=RAIL)
im.resize((W, H), Image.LANCZOS).save(os.path.join(ROOT, 'public/brand/og-roads-and-rails.png'), optimize=True)
