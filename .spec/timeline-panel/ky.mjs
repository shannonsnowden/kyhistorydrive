import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'});
for (const w of [1280,390]){const p=await b.newPage({viewport:{width:w,height:900}});
await p.goto('https://kyhistorydrive.com/stories/bardstown/',{waitUntil:'networkidle',timeout:60000}).catch(()=>{});await p.waitForTimeout(2000);
await p.screenshot({path:`ref/ky-bardstown-${w}-current.png`,fullPage:true});await p.close();}
await b.close();
