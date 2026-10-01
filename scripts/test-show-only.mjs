// Regression test: all nations on, each nation's "Show only" and the reverse; no console errors.
// Usage: node scripts/test-show-only.mjs <baseUrl> [desktop,mobile] [light,dark]
// Needs playwright-core and a Chrome at CHROME_PATH (default /usr/bin/google-chrome). Not part of the site build.
import { chromium } from 'playwright-core'
const launch = () => chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] })
async function page(b, w, h, theme) {
  const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme })
  await c.addInitScript((t) => { try { localStorage.setItem('khd-theme', t) } catch {} }, theme)
  const p = await c.newPage(); p.errs = []
  p.on('pageerror', (e) => p.errs.push('PAGEERR ' + String(e).slice(0, 200)))
  p.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/API KEY|carto|Failed to load resource|ERR_/.test(t)) p.errs.push('CONSOLE ' + t.slice(0, 200)) } })
  return p
}
const BASE=process.argv[2], vps=(process.argv[3]||'desktop,mobile').split(','), themes=(process.argv[4]||'light').split(',')
const b=await launch();let fails=0,total=0
for(const v of vps)for(const th of themes){const [w,h]=v==='desktop'?[1280,900]:[390,844]
 const p=await page(b,w,h,th)
 await p.goto(BASE+'/?cb='+Date.now()+'#map');await p.waitForSelector('input[data-nation]');await p.waitForTimeout(2000)
 const ids=await p.$$eval('input[data-nation]',e=>e.map(x=>x.dataset.nation))
 for(const id of ids)await p.locator(`input[data-nation=${id}]`).check()
 await p.waitForTimeout(2500)
 for(const id of ids){
  total++;const msgs=[]
  // make this nation the most recently toggled
  await p.locator(`input[data-nation=${id}]`).uncheck();await p.waitForTimeout(250);await p.locator(`input[data-nation=${id}]`).check();await p.waitForTimeout(500)
  const name=await p.$eval('[data-only-name]',e=>e.textContent)
  await p.locator('#terrOnly').check();await p.waitForTimeout(2500)
  const h1=await p.evaluate(()=>location.hash)
  const full=await p.locator('.terr-full').count()
  const rows=await p.evaluate(()=>[...document.querySelectorAll('.terr-full .terr-legend li, .terr-full .terr-legend .terr-leg-row')].length)
  const sub=await p.evaluate(()=>document.querySelector('.terr-full .terr-sub')?.textContent||'')
  const ok1=h1.startsWith('#map/territory/')&&full===1&&/only this nation/.test(sub)&&sub.length>0
  // reverse
  await p.locator('#terrOnly').uncheck();await p.waitForTimeout(2500)
  const h2=await p.evaluate(()=>location.hash)
  const checked=await p.$$eval('input[data-nation]',e=>e.filter(x=>x.checked).length)
  const canvas=await p.evaluate(()=>getComputedStyle(document.getElementById('mapCanvas')).display)
  const ok2=h2==='#map'&&checked===ids.length&&canvas!=='none'&&await p.locator('.terr-full').count()===0
  const errs=p.errs.splice(0)
  const ok=ok1&&ok2&&errs.length===0;if(!ok)fails++
  console.log(ok?'PASS':'FAIL',v+'/'+th,id,'only:',name,'|',h1,'sub=',sub.slice(0,60),'| back',h2,'checked',checked+'/'+ids.length,'canvas',canvas,'errs',JSON.stringify(errs).slice(0,200))
 }
 await p.context().close()}
await b.close();console.log(`SUMMARY ${total-fails}/${total} pass`);process.exit(fails?1:0)
