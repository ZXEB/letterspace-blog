import fs from 'node:fs'

const origin = process.env.BLOG_ORIGIN || 'http://localhost:18080'
const credentials = Object.fromEntries(fs.readFileSync(process.env.BLOG_CREDENTIALS_FILE || new URL('../.cache/owner-credentials.txt', import.meta.url), 'utf8').trim().split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }))
let cookie = ''
async function request(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api/v3/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 600)}`)
  const value = text ? JSON.parse(text) : {}
  const cookies = response.headers.getSetCookie?.() || []
  if (cookies.length) cookie = cookies.map(item => item.split(';')[0]).join('; ')
  return value.data ?? value
}
const init = await request('init')
if ((init.is_init || init.isInit) && process.argv.includes('--fresh-only')) throw Error('Already initialized: refusing fresh-only bootstrap. Existing accounts and content were not changed.')
if (!init.is_init && !init.isInit) {
  await request('init/configs/seo', 'PATCH', { title: '纸间', description: '把日子写成一封信，记录生活、技术与寻常日子。', keywords: ['生活', '技术', '个人博客'], icon: `${origin}/favicon.svg` })
  await request('init/configs/url', 'PATCH', { webUrl: origin, serverUrl: origin, adminUrl: `${origin}/proxy/qaqdmin`, wsUrl: origin })
  await request('init/owner', 'POST', { username: credentials.username, password: credentials.password, mail: credentials.email, name: '纸间', url: origin, avatar: `${origin}/favicon.svg`, introduce: '记录生活、技术，以及那些不急着抵达的日常。' })
  console.log('Created independent owner and site configuration.')
}
await request('auth/sign-in/username', 'POST', { username: credentials.username, password: credentials.password })
const session = await request('auth/get-session')
if (!session.user) throw new Error('Admin session verification failed.')
console.log(`Admin login verified: ${session.user.username || session.user.name}`)

const list = async (path) => { const data = await request(`${path}?page=1&size=50`); return Array.isArray(data) ? data : data.data || [] }
const categories = await list('categories')
const category = categories.find(c => c.slug === 'journal') || await request('categories', 'POST', { name: '生活随笔', slug: 'journal' })
const techCategory = categories.find(c => c.slug === 'technology') || await request('categories', 'POST', { name: '技术笔记', slug: 'technology' })
const posts = [
  { title: '把日子写成一封信', slug: 'a-letter-to-everyday', categoryId: category.id, summary: '不急着给生活下结论，先把眼前的小事写下来。', text: '# 把日子写成一封信\n\n你好，欢迎来到我的小小空间。\n\n这里是这座博客的第一封信。它不会急着装下所有的想法，只想留住一点生活原本的样子。\n\n## 慢慢写，也慢慢生活\n\n散步时见到的树影，解决问题时的一点灵光，一本书里忽然喜欢上的句子，都可以写在这里。\n\n> 文字让平常的日子，有了再次被记起的机会。\n\n这篇是可以在管理后台修改或删除的演示文章。你可以把它换成自己的第一篇文字。\n\n## 接下来\n\n希望每次打开这里，都能给自己留一点安静的时间。\n\n谢谢你来。', tags: ['生活', '写作'] },
  { title: '一座小博客的开始', slug: 'a-small-blog-begins', categoryId: techCategory.id, summary: '把内容交给 Mix Space，把注意力还给写作。', text: '## 从一个小空间开始\n\n这个博客使用 Mix Space 作为内容服务。文章、手记、独立页面、友链和项目，都可以从后台管理。\n\n### 写一篇文章\n\n1. 进入博客管理后台。\n2. 选择文章，创建内容并设置分类和链接。\n3. 保存并发布后，前台就会显示新的文字。\n\n### 日常维护\n\n请定期备份独立数据库和上传文件。数据库、Redis 与应用文件分别保存在 Docker 专用卷里。\n\n```sh\ndocker compose ps\ndocker compose logs --tail=50 mx-core\n```\n\n这篇也是演示内容，随时可以替换成自己的技术笔记。', tags: ['博客', '技术'] },
  { title: '秋天适合走得慢一点', slug: 'walk-a-little-slower', categoryId: category.id, summary: '风吹过街角的时候，忽然觉得今天也很好。', text: '## 路上的风景\n\n有些日子没有特别的事情发生。太阳照常升起，咖啡照常变凉，路边的叶子又落了一层。\n\n但如果愿意多看一会儿，就会发现这些很小的事情，也有它们自己的光。\n\n记录不一定是为了告诉谁，有时候，只是给未来的自己留一张便条。\n\n*这是一篇演示随笔，可在管理后台修改。*', tags: ['日常'] },
  { title: '整理书桌，也整理一下心情', slug: 'clear-a-little-space', categoryId: category.id, summary: '少放一点东西，给新的念头腾出位置。', text: '把书桌重新整理了一遍。\n\n几张没用完的便签、一本翻到一半的书，还有放在窗边的杯子。没有多做什么，房间却好像变轻了一点。\n\n留白不是空着，是给下一次认真开始留一个位置。\n\n*这是可替换的演示内容。*', tags: ['生活'] },
  { title: '给未来的自己留一份备份', slug: 'a-backup-for-tomorrow', categoryId: techCategory.id, summary: '记录很重要，让记录能被长久保存也很重要。', text: '## 小小的维护习惯\n\n写下来的东西，值得被好好保存。\n\n- 定期导出数据库。\n- 同时备份上传文件。\n- 把密钥存放在可靠的位置。\n- 更新之前留一份可恢复的版本。\n\n给未来的自己留一份备份，是一种很朴素的安心。\n\n*这篇演示文章可在后台删除。*', tags: ['技术', '备份'] },
]
const existingPosts = await list('posts')
for (const post of posts) {
  if (existingPosts.some(item => item.slug === post.slug)) continue
  const created = await request('posts', 'POST', { ...post, isPublished: true, contentFormat: 'markdown' })
  console.log(`Published sample: ${created.title || post.title}`)
}
const notes = await list('notes')
for (const note of [
  { title: '今天，也留一点时间给自己', text: '新博客的第一封手记。\n\n不用写得很长。把今天想留住的一点点东西放在这里，就很好。', mood: '平静', weather: '晴' },
  { title: '窗边的一小片阳光', text: '下午的阳光刚好落在桌角。停下来看了一会儿，觉得这一刻值得记录。', mood: '轻松', weather: '晴' },
]) {
  if (notes.some(item => item.title === note.title)) continue
  await request('notes', 'POST', { ...note, isPublished: true, contentFormat: 'markdown' })
  console.log(`Published note: ${note.title}`)
}
const pages = await list('pages')
if (!pages.some(item => item.slug === 'about')) {
  await request('pages', 'POST', { title: '关于我', slug: 'about', text: '## 你好，很高兴认识你\n\n这里是我的个人博客，写一点生活，也记录一些技术。\n\n## 关于这里\n\n我相信平常的日子也值得被认真记录。这个小空间，留给真实的生活和慢慢形成的想法。\n\n你可以在管理后台的「独立页面」里，把这段文字换成自己的介绍。', contentFormat: 'markdown', order: 1 })
  console.log('Created editable About page.')
}
const published = await list('posts')
if (published.length < posts.length) throw new Error('Publication verification failed.')
console.log(JSON.stringify({ initialized: true, adminLogin: true, publishedPosts: published.length, publicNotes: (await list('notes')).length }))
