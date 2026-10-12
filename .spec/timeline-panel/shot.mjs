import { chromium } from 'playwright';
const pages={mongol:'https://www.worldhistory.org/Mongol_Empire/',hastings:'https://www.worldhistory.org/Battle_of_Hastings/'};
const b=await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'});
for (const [k,u] of Object.entries(pages)) for (const w of [1280,390]) {
 const p=await b.newPage({viewport:{width:w,height:900},userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36'});
 await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(3000);
 await p.screenshot({path:`ref/wh-${k}-${w}-top.png`});
 const el=await p.$('.timeline_wrapper');
 if(el){ await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  const info=await p.evaluate(()=>{const t=document.querySelector('.timeline_wrapper');const r=t.getBoundingClientRect();const d=t.querySelector('.date');const s=getComputedStyle(d);const li=t.querySelector('li');const ls=getComputedStyle(li);const ul=getComputedStyle(t.querySelector('ul'));
   return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height,docH:document.body.scrollHeight,n:t.querySelectorAll('li').length,date:{c:s.color,bg:s.backgroundColor,fw:s.fontWeight,fs:s.fontSize,ff:s.fontFamily},li:{fs:ls.fontSize,pad:ls.padding,border:ls.borderLeft+'|'+ls.borderBottom},ul:{maxH:ul.maxHeight,ov:ul.overflowY,border:ul.borderLeft}}});
  console.log(k,w,JSON.stringify(info));
  await p.screenshot({path:`ref/wh-${k}-${w}-timeline.png`});
  await el.screenshot({path:`ref/wh-${k}-${w}-panel.png`}).catch(e=>console.log('panelshot',e.message));
 } else console.log(k,w,'no timeline');
 await p.close();}
await b.close();
