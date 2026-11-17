import assert from 'node:assert/strict'
import {origin,publicApi,login,api,data} from './test-utils.mjs'
import {request} from './network.mjs'
const posts=await publicApi('posts?page=1&size=100')
const notes=await publicApi('notes?page=1&size=100')
assert.equal(posts.length,5)
assert.equal(notes.length,2)
assert.equal((await publicApi('pages/slug/about')).slug,'about')
await login()
assert.ok(data(await api('auth/get-session')).user)
for(const path of ['feed','sitemap.xml']){
  const r=await request(origin+'/'+path)
  assert.equal(r.status,200)
  assert.ok(r.headers.get('content-type').includes('xml'))
  const body=await r.text()
  assert.ok(body.includes(origin))
  assert.ok(!body.includes('38.76.201.208'))
}
const root=await request(origin+'/')
assert.ok((await root.text()).includes(`href="${origin}/"`))
const detail=await publicApi('posts/journal/a-letter-to-everyday')
assert.ok(detail.text.includes('你好'))
console.log('Fresh Docker deployment, configured origin, initial content and admin session verified.')
