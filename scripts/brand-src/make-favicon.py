"""Model A Ford favicon (picked by Shannon): an amber 1920s Model A on a deep-green disc.
Variants: modelA-disc (car alone) for 16/32/48/96 and favicon.ico; modelA-road (car over a dashed road)
for the 180px apple-touch-icon (opaque full-bleed green square, amber ring) and the 512px large icon.
Site palette only: amber #c9893a, brighter #d99a45 at 16px, deep green #1f3d2a, rim #2e5a3e. No gold, navy or black.
Every size is drawn at its own size (supersampled 16x then reduced, never upscaled); 16px uses a hand-set pixel grid.
Run: python3 scripts/brand-src/make-favicon.py  (needs Pillow)."""
import math
from PIL import Image, ImageDraw, ImageColor
AMBER = (0xc9, 0x89, 0x3a, 255)
AMBER_HI = (0xd9, 0x9a, 0x45, 255)
GREEN = (0x1f, 0x3d, 0x2a, 255)
RIM = (0x2e, 0x5a, 0x3e, 255)
def modelA(d,cx,cy,w,ink,bg,s):
    h=w*.62; L=cx-w/2; T=cy-h/2
    P=lambda x,y:(L+x*w,T+y*h)
    R=lambda x0,y0,x1,y1,f=ink:d.rectangle((*P(x0,y0),*P(x1,y1)),fill=f)
    R(.08,.04,.50,.56)                       # boxy cab
    d.polygon([P(.48,.04),P(.58,.04),P(.56,.10),P(.48,.10)],fill=ink)  # visor
    R(.13,.13,.28,.33,bg); R(.32,.13,.45,.33,bg)  # side windows
    R(.50,.30,.88,.56)                       # hood
    R(.86,.16,.94,.58)                       # tall flat-top radiator shell
    for i in range(4): R(.875,.21+i*.085,.925,.24+i*.085,bg)  # grille slats
    R(.06,.52,.92,.64)                       # body sill
    R(.34,.68,.68,.73)                       # running board
    wr=.12*w
    for x,x0,x1 in ((.22,.04,.42),(.80,.60,.99)):
        # fender: arc over wheel
        c=P(x,.80); fr=wr*1.5
        d.pieslice((c[0]-fr,c[1]-fr,c[0]+fr,c[1]+fr),180,360,fill=ink)
        d.ellipse((c[0]-wr*1.15,c[1]-wr*1.15,c[0]+wr*1.15,c[1]+wr*1.15),fill=bg)
        # wire wheel
        lw=max(s,int(wr*.10))
        d.ellipse((c[0]-wr,c[1]-wr,c[0]+wr,c[1]+wr),outline=ink,width=int(wr*.24))
        for k in range(12):
            a=k*math.pi/6; d.line((c[0],c[1],c[0]+math.cos(a)*wr*.8,c[1]+math.sin(a)*wr*.8),fill=ink,width=lw)
        hr=wr*.22; d.ellipse((c[0]-hr,c[1]-hr,c[0]+hr,c[1]+hr),fill=ink)
    # headlamp on front fender w/ stalk
    hc=P(.97,.44); r=.035*w
    R(.955,.48,.965,.62)
    d.ellipse((hc[0]-r,hc[1]-r,hc[0]+r,hc[1]+r),fill=ink)
def make(variant,size,touch=False):
    s=16;W=size*s
    im=Image.new('RGBA',(W,W),GREEN if touch else (0,0,0,0)); d=ImageDraw.Draw(im); ink=AMBER
    if touch: m=W*.08; d.ellipse((m,m,W-m,W-m),outline=AMBER,width=4*s)
    else:
        d.ellipse((0,0,W-1,W-1),fill=GREEN,outline=RIM,width=s)
        if size>32:
            ring=max(1,round(size/16))*s; inset=ring+2*s
            d.ellipse((inset*.5,inset*.5,W-1-inset*.5,W-1-inset*.5),outline=ink,width=ring)
    cw=W*(.84 if size<=32 else .66); road=variant=='modelA-road'
    cy=W*(.46 if road else .50)
    modelA(d,W/2,cy,cw,ink,GREEN,s)
    if road:
        ry=cy+cw*.62*.5+cw*.06
        d.rectangle((W*.14,ry,W*.86,ry+W*.035),fill=ink)
        for i in range(5): x=W*.2+i*W*.12; d.rectangle((x,ry+W*.07,x+W*.066,ry+W*.095),fill=ink)
    im=im.resize((size,size),Image.LANCZOS); return im.convert('RGB') if touch else im
A16=["................",
     "................",
     "..AAAAAAA.......",
     "..A..A.A....AA..",
     "..A..A.A....AA..",
     "..AAAAAAAAAAAA..",
     "..AAAAAAAAAAAAA.",
     ".AAAAAAAAAAAAAA.",
     ".A....AAAA....A.",
     "..AAAA....AAAA..",
     "..A..A....A..A..",
     "..A..A....A..A..",
     "..AAAA....AAAA..",
     "................",
     "................",
     "................"]
def make16(variant):
    im=make(variant,16); px=im.load(); g=ImageColor.getrgb(GREEN) if isinstance(GREEN,str) else GREEN
    rows=list(A16)
    if variant=='modelA-road': rows[14]="....AAAAAAAA...."
    for y in range(16):
        for x in range(16):
            if px[x,y][3]>200 and 2<=y<=14 and 1<=x<=14: px[x,y]=tuple(g[:3])+(255,)
            if rows[y][x]=='A': px[x,y]=tuple((ImageColor.getrgb(AMBER_HI) if isinstance(AMBER_HI,str) else AMBER_HI)[:3])+(255,)
    return im

if __name__ == '__main__':
    disc = {16: make16('modelA-disc')}
    for n in (32, 48, 96):
        disc[n] = make('modelA-disc', n)
    disc[32].save('public/favicon-32.png', optimize=True)
    for n in (48, 96):
        disc[n].save(f'public/favicon-{n}.png', optimize=True)
    make('modelA-road', 512).save('public/favicon-512.png', optimize=True)
    make('modelA-road', 180, True).save('public/apple-touch-icon.png', optimize=True)
    disc[48].save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[disc[16], disc[32]])
    for n in (16, 32, 48):
        disc[n].save(f'scripts/brand-src/favicon-preview-{n}.png')
