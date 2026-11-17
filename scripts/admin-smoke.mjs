import fs from 'node:fs'
import {openBrowser,uiDir} from './browser.mjs'
import {origin,credentials,api,data,publicApi,login,report} from './test-utils.mjs'

const checks=[]
const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)}
const title='浏览器富文本验收 '+Date.now()
const slug='browser-acceptance-'+Date.now()
const temporary={posts:[],drafts:[]}
const saveTemporary=()=>fs.writeFileSync(uiDir+'/temporary-browser-content.json',JSON.stringify(temporary,null,2))
const {context,close}=await openBrowser('admin-acceptance')
let page
const errors=[]
try{
  await context.clearCookies()
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  page.on('response',async response=>{
    if(response.request().method()!=='POST'||!response.ok())return
    const path=new URL(response.url()).pathname
    if(!['/api/v3/posts','/api/v3/drafts'].includes(path))return
    const item=data(await response.json())
    if(item?.id&&item.title===title){temporary[path.endsWith('posts')?'posts':'drafts'].push(item.id);saveTemporary()}
  })
  await page.goto(origin+'/proxy/qaqdmin#/dashboard',{waitUntil:'domcontentloaded',timeout:60000})
  await page.getByText('纸间',{exact:true}).waitFor({timeout:60000})
  await page.locator('input[type=password]').fill(credentials.password)
  await page.waitForTimeout(1000)
  await page.locator('input[type=password]').press('Enter')
  await page.getByRole('link',{name:'写文章',exact:true}).waitFor({timeout:30000})
  assert(page.url().includes('#/dashboard'),'Browser password login reaches the real dashboard')
  const cookies=await context.cookies()
  assert(cookies.some(c=>c.name==='better-auth.session_token'&&c.httpOnly&&c.sameSite==='Lax'),'HTTP/IP browser stores a signed HttpOnly SameSite session')
  await page.reload({waitUntil:'domcontentloaded'})
  await page.getByRole('link',{name:'写文章',exact:true}).waitFor({timeout:30000})
  assert(page.url().includes('#/dashboard'),'Admin session survives browser reload')
  await page.screenshot({path:uiDir+'/admin-dashboard.png',fullPage:true})
  await page.getByRole('link',{name:'写文章',exact:true}).click()
  const editor=page.locator('[contenteditable=true]').first()
  await editor.waitFor({timeout:30000})
  await page.getByPlaceholder('输入标题...').fill(title)
  await editor.fill('后台富文本验收正文')
  await editor.press('End');await editor.press('Enter')
  await editor.press('Control+b');await page.keyboard.insertText('后台加粗内容');await page.keyboard.press('Control+b');await page.keyboard.press('Enter')
  await page.getByRole('button',{name:'无序列表',exact:true}).click();await page.keyboard.insertText('第一条列表内容');await page.keyboard.press('Enter');await page.keyboard.insertText('第二条列表内容')
  await page.getByRole('button',{name:'文章设置',exact:true}).click()
  await page.getByLabel(/^Slug/).fill(slug)
  await page.getByRole('combobox',{name:'分类',exact:true}).click()
  await page.getByRole('option',{name:'生活随笔',exact:true}).click()
  console.log('Rich editor filled; publishing temporary article')
  const publishedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v3/posts'&&r.request().method()==='POST',{timeout:30000})
  await page.getByRole('button',{name:'发布',exact:true}).click()
  const response=await publishedResponse
  assert(response.ok(),'Default rich text editor publishes through the browser')
  const post=data(await response.json())
  if(!temporary.posts.includes(post.id)){temporary.posts.push(post.id);saveTemporary()}
  assert(post.content_format==='lexical'||post.contentFormat==='lexical','Published document uses the default Lexical format')
  const publicPost=await publicApi('posts/journal/'+slug)
  assert(publicPost.is_published&&publicPost.title===title,'Browser-published document is public')
  fs.writeFileSync(uiDir+'/rich-text-evidence.json',JSON.stringify({id:post.id,format:publicPost.content_format,text:publicPost.text,content:publicPost.content},null,2))
  await page.screenshot({path:uiDir+'/admin-published.png',fullPage:true})
  const front=await context.newPage();front.on('pageerror',e=>errors.push(e.message))
  await front.goto(origin+'/posts/journal/'+slug,{waitUntil:'domcontentloaded'})
  await front.locator('.prose').getByText('后台加粗内容',{exact:true}).waitFor()
  assert(await front.locator('.prose strong').innerText()==='后台加粗内容','Rich text bold formatting renders correctly')
  assert(await front.locator('.prose li').count()===2,'Rich text lists render as lists, not JSON')
  assert(!(await front.locator('.prose').innerText()).includes('"root"'),'Serialized rich text JSON is not displayed')
  await front.screenshot({path:uiDir+'/rich-text-public.png',fullPage:true})
  await front.setViewportSize({width:390,height:844});assert(!await front.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Rich text article fits mobile')
  // Verify cookie omission from the public UI while this same browser is admin.
  await login()
  await api('posts/'+post.id,'PATCH',{isPublished:false})
  await front.goto(origin+'/posts',{waitUntil:'domcontentloaded'})
  await front.locator('.writing-row').first().waitFor()
  assert(!(await front.locator('main').innerText()).includes(title),'Logged-in admin browser does not leak unpublished posts into front page')
  await page.goto(origin+'/proxy/qaqdmin#/posts',{waitUntil:'domcontentloaded'})
  await page.getByText(title,{exact:true}).first().waitFor({timeout:20000});assert(true,'Official backend retains the unpublished editable article')
  const logout=await page.evaluate(async()=>{const r=await fetch('/api/v3/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'include'});return r.ok})
  assert(logout,'Browser session can sign out')
  assert(!(await context.cookies()).some(c=>c.name==='better-auth.session_token'),'Sign-out clears translated HTTP cookie')
  assert(errors.length===0,'Admin and rich text browser flows have no uncaught exceptions')
  report('admin-acceptance-report.json',checks,{screenshots:['admin-dashboard.png','admin-published.png','rich-text-public.png'],httpCookieBridge:true})
}catch(error){if(page){await page.screenshot({path:uiDir+'/admin-acceptance-failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync(uiDir+'/admin-acceptance-failure.json',JSON.stringify({error:error.message,checks,errors,body:(await page.locator('body').innerText()).slice(-6000)},null,2))}throw error}
finally{
  await close()
  if(temporary.posts.length||temporary.drafts.length){await login();for(const id of temporary.posts)await api('posts/'+id,'DELETE');for(const id of temporary.drafts)await api('drafts/'+id,'DELETE');fs.rmSync(uiDir+'/temporary-browser-content.json',{force:true})}
}
