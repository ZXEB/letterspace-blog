import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright')
const root = path.resolve('.cache/ui')
fs.mkdirSync(root, { recursive: true })
const context = await chromium.launchPersistentContext(path.join(root, 'profile'), {
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  viewport: { width: 1440, height: 1050 },
  env: { ...process.env, TEMP: path.join(root, 'temp'), TMP: path.join(root, 'temp') },
  args: [`--disk-cache-dir=${path.join(root, 'cache')}`, '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', '--no-proxy-server'],
})
try {
  for (const [name, url] of [['reference', 'https://blog.xp6.top/'], ['reference-posts', 'https://blog.xp6.top/posts'], ['new', 'http://38.76.201.208:18080/']]) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(name === 'reference' ? 12000 : 2500)
    await page.screenshot({ path: path.join(root, `${name}-desktop.png`), fullPage: true })
    const snapshot = await page.evaluate(() => ({
      title: document.title,
      text: document.body.innerText.slice(0, 7000),
      headings: [...document.querySelectorAll('h1,h2')].slice(0, 15).map(element => { const s=getComputedStyle(element);const r=element.getBoundingClientRect();return {text:element.textContent,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,x:r.x,y:r.y,width:r.width,height:r.height} }),
      regions: [...document.querySelectorAll('main,header,nav,footer')].slice(0, 12).map(element => { const r=element.getBoundingClientRect();return {tag:element.tagName,class:element.className,x:r.x,y:r.y,width:r.width,height:r.height} }),
      ancestors: [...function*(){let el=document.querySelector('h1');while(el){const s=getComputedStyle(el),r=el.getBoundingClientRect();yield {tag:el.tagName,cls:el.className,opacity:s.opacity,transform:s.transform,visibility:s.visibility,display:s.display,width:r.width,height:r.height,x:r.x,y:r.y};el=el.parentElement}}()],
    }))
    fs.writeFileSync(path.join(root, `${name}-snapshot.json`), JSON.stringify({ ...snapshot, errors }, null, 2))
    console.log(JSON.stringify({ name, title: snapshot.title, errors, ancestors:snapshot.ancestors }))
    if(name==='reference'){
      await page.evaluate(()=>window.scrollTo(0,850))
      await page.waitForTimeout(2000)
      await page.screenshot({path:path.join(root,'reference-content.png')})
    }
    await page.close()
  }
} finally { await context.close() }
