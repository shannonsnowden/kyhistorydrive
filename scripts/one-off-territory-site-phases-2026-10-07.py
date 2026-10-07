import json,re
D='public/data/web/territories/'
S={x['slug']:x for x in json.load(open('public/content/stories.json'))['stories']}
def body(slug): return json.load(open(f'public/content/stories/{slug}.json')).get('bodyMarkdown','')
def src_url(slug):
  m=re.findall(r'Source:\s*\[(https?://[^\]]+)\]',body(slug)); return m[-1] if m else None
def fy(y): return f"{-y} BCE" if y<0 else f"{y} CE"
def fr(a,b):
  if a<0 and b<=0: return f"{-a}–{-b} BCE"
  if a<0: return f"{-a} BCE–{b} CE"
  return f"{a}–{b} CE"
def load(f): return json.load(open(D+f+'.json'))
PH=[(', and village locations are not shown.','. Dated site dots use each story\'s public map pin, rounded, not the exact location.'),
 (' and no village locations are shown.','. Dated site dots use each story\'s public map pin, rounded, not the exact location.'),
 ('; no site locations are shown.','. Dated site dots use each story\'s public map pin, rounded, not the exact location.'),
 ('so none are shown.','so the dots use each story\'s public, rounded map pin, not the exact location.')]
def fixtxt(o):
  if isinstance(o,str):
    for a,b in PH: o=o.replace(a,b)
    return o
  if isinstance(o,list): return [fixtxt(x) for x in o]
  if isinstance(o,dict): return {k:(fixtxt(v) if k!='geojson' else v) for k,v in o.items()}
  return o
def save(f,T,fix=True): open(D+f+'.json','w').write(json.dumps(fixtxt(T) if fix else T,ensure_ascii=False,separators=(',',':')))
def short_title(t): return re.split(r'\s[—:–-]\s|: ',t)[0].strip()

def nkey(t): return re.sub(r'[^a-z]','',short_title(t).split()[0].lower())
def add_sites(T, sites):
  feats=T['geojson']['features']; groups={}
  for st in sites:
    x=S[st['slug']]
    if x.get('lat') is None: continue
    c=(round(x['lat'],3),round(x['lon'],3)); k=(c,nkey(x['title']))
    g=groups.setdefault(k,{'c':c,'lon':x['lon'],'lat':x['lat'],'label':st.get('label') or short_title(x['title']),'ys':st['ys'],'ye':st['ye'],'slugs':[]})
    g['ys']=min(g['ys'],st['ys']); g['ye']=max(g['ye'],st['ye']); g['slugs'].append(st['slug'])
    u=src_url(st['slug'])
    if u and not any(s['url']==u for s in T['sources']):
      T['sources'].append({'id':'src_'+st['slug'][:40],'label':f"{short_title(x['title'])} (story source)",'url':u})
  merged={}
  for g in groups.values():
    m=merged.setdefault((g['c'],g['ys'],g['ye']),{**g,'labels':[],'slugs':[]})
    m['labels'].append(g['label']); m['slugs']+=g['slugs']
  fid={}; SITE_SPAN.clear()
  for i,m in enumerate(merged.values()):
    id_=f"site{i+1}"
    feats.append({'type':'Feature','properties':{'id':id_,'label':' · '.join(m['labels']),'approximate':True},'geometry':{'type':'Point','coordinates':[m['lon'],m['lat']]}})
    for sl in m['slugs']: fid[sl]=id_
    SITE_SPAN[id_]=(m['ys'],m['ye'],' · '.join(m['labels']))
  return fid
SITE_SPAN={}
def srcid(T,slug):
  u=src_url(slug); return next((s['id'] for s in T['sources'] if s['url']==u),None)

def segment(f, sites=None, extra_note=''):
  T=load(f)
  sites=sites or [dict(slug=k,ys=v.get('yearStart'),ye=v.get('yearEnd')) for k,v in T['stories'].items()]
  sites=[s for s in sites if s['ys'] is not None]
  fid=add_sites(T,sites)
  mn,mx=T['timeline']['min'],T['timeline']['max']
  base=[e for e in T['eras'] if e.get('yearStart') is not None]
  spans=list(SITE_SPAN.items())
  bps=sorted({mn,*[e['yearStart'] for e in base],*[v[0] for k,v in spans if mn<=v[0]<mx],*[v[1] for k,v in spans if mn<v[1]<mx]})
  new=[]; 
  for i,a in enumerate(bps):
    b=bps[i+1] if i+1<len(bps) else mx
    be=[e for e in base if e['yearStart']<=a][-1] if any(e['yearStart']<=a for e in base) else base[0]
    pts=[k for k,v in spans if v[0]<=a<v[1]]
    act=[s for s in sites if s['slug'] in fid and fid[s['slug']] in pts]
    title=be['label'].split(' · ',1)[-1]
    names=[f"{SITE_SPAN[p][2]} ({fr(SITE_SPAN[p][0],SITE_SPAN[p][1])})" for p in pts]
    txt=be['text']+('\n\n' if be.get('text') else '')+(("Dated sites on the map in this span (occupation years from each site story's cited source): "+'; '.join(names)+'.') if names else "No site in these stories has a dated occupation in this span, so no site dot is shown.")
    e={k:v for k,v in be.items() if k not in('layers','text','label','short','yearStart','yearEnd','id','tick','notDrawn','noBoundary')}
    e.update(id=f"{be['id']}-{i+1}",label=f"{fr(a,b)} · {title}",short=fy(a) if a<0 else str(a),yearStart=a,yearEnd=b,text=txt,
      layers=[l for l in be['layers'] if l.get('style')!='point']+[{'feature':p,'style':'point'} for p in pts],
      sources=list(dict.fromkeys(be.get('sources',[])+[x for x in (srcid(T,s['slug']) for s in act) if x])))
    if be.get('mapSubLabel'): e['mapSubLabel']=re.sub(r'[\d–]+ (BCE|CE)$',fr(a,b),be['mapSubLabel'])
    if be.get('noBoundary'): e['noBoundary']=True; e['apprTag']='Approximate site locations'
    new.append(e)
  T['eras']=new
  for s in T['stories']:
    y=T['stories'][s].get('yearStart', S[s].get('yearStart'))
    if y is None: y=next((x['ys'] for x in sites if x['slug']==s),None)
    T['startEra'][s]=([e for e in new if y is not None and e['yearStart']<=y] or new)[-1]['id']
  return T

# cultures with an area + dated member sites
for f in ['mississippian-western-kentucky-towns','fort-ancient-farming-villages','green-river-archaic-shell-middens']:
  T=segment(f)
  T['legend']=[l for l in T['legend'] if l['kind']!='ring']+[{'kind':'ring','label':'Dated site (rounded, approximate location)'}]
  save(f,T)

# Early Woodland caves and rockshelters: no area; dated site dots
f='early-woodland-caves-and-rockshelters'; T=load(f)
T['timeline']={'min':-3000,'max':-200}
be=T['eras'][0]
note=("No area is drawn: no source used here gives one. Each site appears as a dot (rounded, approximate location) during the occupation years given in its story's cited source: "
 "Cloudsplitter Rockshelter's Archaic-to-Early Woodland record (about 3000–1000 BCE), Salts Cave mining at its Early Woodland peak (about 1000–200 BCE, Kentucky Archaeological Survey), "
 "and Newt Kash's intensive occupation about 3,000 years ago (about 1000 BCE). Archaeological sites defined by artifacts and dates, not a tribe; no descent claim is made.")
T['eras']=[dict(be,id='late-archaic',label='3000–1000 BCE · Late Archaic to Early Woodland',short='3000 BCE',yearStart=-3000,yearEnd=-1000,text='',layers=[]),
           dict(be,id='early-woodland',label='1000–200 BCE · Early Woodland cave mining and rockshelters',short='1000 BCE',yearStart=-1000,yearEnd=-200,text='',layers=[])]
for e in T['eras']: e.pop('notDrawn',None)
save(f,T)
sites=[dict(slug='cloudsplitter-rockshelter-menifee-county',ys=-3000,ye=-1000),dict(slug='salts-cave-15ht4',ys=-1000,ye=-200),dict(slug='newt-kash-hollow-15mf1',ys=-1000,ye=-200)]
T=segment(f,sites)
for e in T['eras']: e['text']=e['text'].lstrip()
# Newt Kash: clarify that its date is "about 3,000 years ago"
for e in T['eras']: e['text']=e['text'].replace('Newt Kash Hollow (15Mf1) (1000–200 BCE)','Newt Kash Hollow (intensive occupation about 3,000 years ago, about 1000 BCE)')
T['presenceLabel']='Dated sites, no mapped area'; T['presenceNote']=note
T['legend']=[{'kind':'ring','label':'Dated site (rounded, approximate location); no area drawn'}]
T['startEra']={'cloudsplitter-rockshelter-menifee-county':T['eras'][0]['id'],'salts-cave-15ht4':T['eras'][1]['id'],'newt-kash-hollow-15mf1':T['eras'][1]['id']}
for k in T['stories']: T['stories'][k]={'presenceLabel':T['presenceLabel'],'presenceNote':note}
T['stories']['salts-cave-15ht4'].update(yearStart=-1000,yearEnd=-200)
T['stories']['cloudsplitter-rockshelter-menifee-county'].update(yearStart=-3000,yearEnd=-1000)
T['overlapNote']='No area is drawn; only dated site dots.'
save(f,T)

# Hansen: two dated phases from its cited source (Wikipedia, Hansen site)
f='archaic-hansen-site'; T=load(f)
add=add_sites(T,[dict(slug='hansen-site-15gp14',ys=-2000,ye=-1999,label='Hansen Site')]); p=add['hansen-site-15gp14']; sid=srcid(T,'hansen-site-15gp14')
be=T['eras'][0]
T['timeline']={'min':-2000,'max':600}
mk=lambda **k: {**{x:be[x] for x in ('confidence',)},'storySlugs':['hansen-site-15gp14'],'noBoundary':True,'apprTag':'Approximate site location',**k}
T['eras']=[mk(id='late-archaic',label='c. 2000 BCE · Late Archaic summer camps',short='c.2000 BCE',yearStart=-2000,yearEnd=-1999,sources=['kas_arch',sid],
   text='Excavations document Late Archaic summer camps on this Ohio River terrace around 2000 BCE (Cave Run, Merom and Rowlette points). Dot is a rounded, approximate location.',layers=[{'feature':p,'style':'point'}]),
 mk(id='gap',label='c. 2000 BCE–300 CE · no dated occupation in the cited source',short='gap',yearStart=-1990,yearEnd=300,sources=[sid],
   text='The cited source gives no dated occupation between the Late Archaic camps and the Middle–Late Woodland communities, so no dot is shown.',layers=[]),
 mk(id='woodland',label='300–600 CE · Middle–Late Woodland communities',short='300 CE',yearStart=300,yearEnd=600,sources=[sid],
   text='Denser Middle–Late Woodland communities (about 300–600 CE) with circular post structures, tool workshops and storage. Fort Ancient people used the terrace later; the source gives no date for that use, so it is not on the slider.',layers=[{'feature':p,'style':'point'}])]
T['fadeYears']=0
note='The Hansen Site is shown as a dot (rounded, approximate location) only in the periods its cited source dates: Late Archaic camps about 2000 BCE and Middle–Late Woodland communities about 300–600 CE. No area is drawn. Archaeological sites defined by artifacts and dates, not a tribe; no descent claim is made.'
T['nation']='Hansen Site (archaeological site)'; T['presenceLabel']='Dated occupations'; T['presenceNote']=note
T['stories']={'hansen-site-15gp14':{'presenceLabel':'Dated occupations','presenceNote':note,'yearText':'c. 2000 BCE; 300–600 CE'}}
T['startEra']={'hansen-site-15gp14':'late-archaic'}; T['legend']=[{'kind':'ring','label':'Hansen Site (rounded, approximate location); no area drawn'}]
T['overlapNote']='No area is drawn; only the site dot.'
save(f,T)

# Nation stories that were tag-only: show the nation's sourced timeline
for f,slug,start in [('shawnee-kentucky-ohio-river-and-towns','nonhelema',1750),('six-nations-fort-stanwix-line-of-property','iroquois-beaver-wars',None),('wyandot-ohio-detroit-and-kentucky-raids','wyandot-name-kah-ten-tah-teh-fair-land-of-tomorrow',None)]:
  T=load(f); st=T['stories'][slug]; st.pop('tagOnly',None)
  eras=[e for e in T['eras'] if e.get('yearStart') is not None]
  if start is not None:
    st.update(yearStart=1750,yearEnd=1786); T['startEra'][slug]=[e for e in eras if e['yearStart']<=start][-1]['id']
  else:
    T['startEra'].pop(slug,None)
    T['startEra'][slug]=eras[0]['id']
  save(f,T)
