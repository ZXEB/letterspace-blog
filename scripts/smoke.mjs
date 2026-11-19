import fs from 'node:fs'
import {request} from './network.mjs'
import {openBrowser,uiDir} from './browser.mjs'
import {origin,api,data,publicApi,login,report} from './test-utils.mjs'

const checks=[]
const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)}
const postPath=p=>`/posts/${encodeURIComponent(p.category.slug)}/${encodeURIComponent(p.slug)}`
for(const [path,expected] of [['health','ok'],['api/v3/ping','pong']]){const r=await request(`${origin}/${path}`);assert(r.ok&&(await r.text()).includes(expected),`${path} healthy`)}
const xml={}
for(const path of ['feed','atom.xml','sitemap.xml']){const r=await request(`${origin}/${path}`);xml[path]=await r.text();assert(r.ok&&r.headers.get('content-type')?.includes('xml')&&xml[path].trimStart().startsWith('<'),`${path} serves XML`)}
const robots=await request(`${origin}/robots.txt`);assert((await robots.text()).includes(`${origin}/sitemap.xml`),'robots declares the correct sitemap')
const posts=await publicApi('posts?page=1&size=100')
const notes=await publicApi('notes?page=1&size=100')
const categories=await publicApi('categories')
const about=await publicApi('pages/slug/about')
assert(posts.length>=5&&notes.length>=2,'Original independent sample content remains available')
const first=data(await api('posts?page=1&size=2','GET',undefined,false))
const last=data(await api('posts?page=3&size=2','GET',undefined,false))
assert(first.length===2&&last.length>0&&!first.some(p=>p.id===last[0].id),'API pagination reaches older posts')
await login();assert(data(await api('auth/get-session'))?.user,'Existing admin credentials and HTTP cookie session work')
let created
try{
  const slug='acceptance-'+Date.now()
  created=data(await api('posts','POST',{title:'验收临时文章',slug,categoryId:categories[0].id,text:'## 验收正文\n\n**加粗内容**\n\n```js\nconst hello = 1\n```',contentFormat:'markdown',isPublished:true,tags:[]}))
  assert(!!created.id,'Admin can publish a post (response envelope unwrapped)')
  fs.writeFileSync(uiDir+'/temporary-api-post.json',JSON.stringify({id:created.id,slug}))
  await api(`posts/${created.id}`,'PATCH',{title:'验收临时文章已修改',text:'## 更新正文\n\n**验收加粗内容**'})
  const read=await publicApi(`posts/${categories[0].slug}/${slug}`)
  assert(read.title==='验收临时文章已修改'&&read.text.includes('更新正文'),'Published article edits are public')
  const sitemap=await request(`${origin}/sitemap.xml`)
  assert((await sitemap.text()).includes(`/posts/${categories[0].slug}/${slug}`),'Sitemap includes newly published content without rebuilding')
  await api(`posts/${created.id}`,'PATCH',{isPublished:false})
  const publicPosts=await publicApi('posts?page=1&size=100')
  assert(!publicPosts.some(p=>p.id===created.id),'Unpublished article disappears from public list')
  const hiddenMap=await request(`${origin}/sitemap.xml`)
  assert(!(await hiddenMap.text()).includes(slug),'Sitemap excludes unpublished content immediately')
}finally{if(created?.id){await api(`posts/${created.id}`,'DELETE');fs.rmSync(uiDir+'/temporary-api-post.json',{force:true})}}

const {context,close}=await openBrowser('front-acceptance')
const errors=[]
try{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  async function goto(route,text){await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.locator('main').getByText(text,{exact:false}).first().waitFor({timeout:20000});if(route==='/')await page.locator('.writing-row').first().waitFor();await page.waitForTimeout(100);assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${route} fits viewport`)}
  for(const [route,text] of [['/','近期笔墨'],['/posts',posts[0].title],['/notes',notes[0].title],['/notes/'+notes[0].nid,notes[0].title],['/timeline',posts.at(-1).title],['/friends','朋友们'],['/projects','项目'],['/about',about.text.split('\n').find(l=>l.includes('我的个人博客'))],['/about-site','关于本站'],['/search','搜索']]) await goto(route,text)
  for(const post of posts){await goto(postPath(post),post.title);assert(await page.locator('.prose').innerText().then(t=>t.length>20),`${post.slug} has real body`);assert(await page.title()===`${post.title} | 纸间`,'Article title metadata updates');assert(await page.locator('link[rel=canonical]').getAttribute('href')===origin+postPath(post),'Article canonical includes category')}
  await goto('/posts/'+posts.at(-1).slug,posts.at(-1).title);assert(await page.locator('.prose h2').count()>0,'Legacy slug route renders Markdown headings')
  // Reduce real API page sizes to exercise pagination with this small dataset.
  await page.route('**/api/v3/posts?*',route=>{const u=new URL(route.request().url());u.searchParams.set('size','2');return route.continue({url:u.href})})
  await goto('/posts',posts[0].title)
  assert(await page.locator('.archive-card').count()===Math.min(10,posts.length),'Post list fills the archive page using all backend pages')
  const nextPage=page.getByRole('link',{name:'下一页 →',exact:true})
  if(await nextPage.count()){
    await nextPage.click();await page.waitForURL('**/posts?page=2')
    assert((await page.locator('.archive-page-count').innerText()).includes('第 2 页'),'Post next-page navigation updates URL')
    await page.reload();await page.locator('.archive-page-count').getByText('第 2 页',{exact:false}).waitFor()
    assert(true,'Pagination survives reload')
  }
  await page.locator('.archive-categories summary').click()
  await page.locator('.archive-categories').getByRole('button',{name:categories[0].name,exact:false}).click()
  const categoryRequest=await publicApi(`posts?categoryIds=${categories[0].id}&size=100`)
  assert((await page.locator('.archive-card .archive-title').allTextContents()).every(t=>categoryRequest.some(p=>p.title===t)),'Category filter uses complete backend result set')
  await goto('/timeline','时间线');assert(await page.locator('.chronology-month li').count()===Math.min(20,posts.length+notes.length),'Timeline follows all backend pages instead of truncating the first response')
  await page.unroute('**/api/v3/posts?*')
  await page.route('**/api/v3/notes?*',route=>{const u=new URL(route.request().url());u.searchParams.set('size','1');return route.continue({url:u.href})})
  await goto('/notes',notes[0].title);await page.getByRole('link',{name:'下一页 →',exact:true}).click();await page.getByText(notes[1].title,{exact:true}).waitFor();assert(true,'Notes next page reaches older content')
  await page.unroute('**/api/v3/notes?*')
  await goto('/search','搜索')
  await page.getByRole('searchbox',{name:'搜索文章和手记'}).fill('生活');await page.getByRole('button',{name:'搜索',exact:true}).click()
  await page.locator('.search-results article').first().waitFor();assert(page.url().includes('q='),'Search form submits and shows public content')
  await page.getByRole('searchbox',{name:'搜索文章和手记'}).fill('zz-unmatched-'+Date.now());await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText('没有找到相关内容。').waitFor();assert(true,'Search empty state works')
  // Parse actual XML in the browser and visit every feed/content sitemap URL.
  const parsed=await page.evaluate(xml=>{const parse=s=>new DOMParser().parseFromString(s,'application/xml');return {valid:Object.values(xml).every(s=>!parse(s).querySelector('parsererror')),sitemap:[...parse(xml['sitemap.xml']).querySelectorAll('loc')].map(e=>e.textContent),feed:[...parse(xml.feed).querySelectorAll('item > link')].map(e=>e.textContent)}},xml)
  assert(parsed.valid,'Feed, Atom and sitemap are well-formed XML')
  for(const url of [...new Set([...parsed.sitemap,...parsed.feed])]){assert(new URL(url).origin===origin,'XML link points to the independent origin');await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(350);assert(!(await page.locator('body').innerText()).includes('这封信还没有抵达'),'XML link resolves to a real page')}
  await goto('/','近期笔墨');await page.screenshot({path:uiDir+'/final-desktop.png',fullPage:true,animations:'disabled'})
  for(let i=0;i<3&&(await page.locator('html').getAttribute('data-theme'))!=='dark';i++) await page.getByRole('button',{name:'切换主题'}).click()
  assert(await page.locator('html').getAttribute('data-theme')==='dark','Dark mode activates')
  await page.reload();await page.locator('.writing-row').first().waitFor();await page.waitForTimeout(300);assert(await page.locator('html').getAttribute('data-theme')==='dark','Theme persists after reload')
  assert(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(28, 28, 30)','Dark theme background reaches the intended color')
  await page.screenshot({path:uiDir+'/final-dark.png',fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  for(const route of ['/','/posts','/notes','/timeline','/about','/search',postPath(posts.at(-1))]){await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(400);assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${route} fits mobile`)}
  await page.getByRole('button',{name:'打开菜单',exact:true}).click();await page.getByRole('link',{name:'项目',exact:true}).first().click();await page.getByRole('heading',{name:'项目',exact:true}).waitFor();assert(!await page.locator('.main-nav').evaluate(e=>e.classList.contains('is-open')),'Mobile menu navigates and closes')
  await goto('/','近期笔墨');for(let i=0;i<3&&(await page.locator('html').getAttribute('data-theme'))!=='light';i++)await page.getByRole('button',{name:'切换主题'}).click()
  await page.waitForTimeout(300)
  assert(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(254, 254, 251)','Light theme background reaches the intended color')
  await page.screenshot({path:uiDir+'/final-mobile.png',fullPage:true,animations:'disabled'})
  assert(errors.length===0,'No uncaught browser exceptions')
  report('acceptance-report.json',checks,{screenshots:['final-desktop.png','final-mobile.png','final-dark.png'],publicPosts:posts.length,publicNotes:notes.length})
}catch(error){fs.writeFileSync(uiDir+'/acceptance-failure.json',JSON.stringify({checks,error:error.message,errors},null,2));throw error}finally{await close()}
