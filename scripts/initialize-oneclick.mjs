import fs from 'node:fs'
import crypto from 'node:crypto'
import {validateOrigin} from './setup-selfhost.mjs'

const values=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}))
const origin=validateOrigin(values.SITE_ORIGIN)
const connect=`http://127.0.0.1:${values.WEB_PORT}`
const response=await fetch(connect+'/api/v3/init',{headers:{'User-Agent':'Mozilla/5.0 LetterspaceInstaller'},signal:AbortSignal.timeout(20000)})
let initialized=false
if(response.ok){const envelope=await response.json(),state=envelope.data??envelope;initialized=Boolean(state.is_init||state.isInit)}
else if(response.status===403){
  // This core version closes /init after the owner is created. Confirm an
  // existing public owner instead of mistaking the guard for an empty site.
  const ownerResponse=await fetch(connect+'/api/v3/owner',{headers:{'User-Agent':'Mozilla/5.0 LetterspaceInstaller'}})
  if(!ownerResponse.ok)throw Error('Initialization is forbidden and no existing owner could be verified')
  const envelope=await ownerResponse.json();initialized=Boolean((envelope.data??envelope).id)
  if(!initialized)throw Error('Existing owner response is invalid')
}else throw Error('Cannot check initialization state: '+response.status)
if(initialized){
  console.log('Existing administrator detected. No account, password or content was changed.')
}else{
  fs.mkdirSync('.cache',{recursive:true,mode:0o700})
  const file='.cache/owner-credentials.txt'
  if(!fs.existsSync(file)) fs.writeFileSync(file,`username: blog-admin\nemail: admin@example.invalid\npassword: ${crypto.randomBytes(24).toString('base64url')}\n`,{flag:'wx',mode:0o600})
  process.env.BLOG_ORIGIN=connect
  process.env.BLOG_SITE_ORIGIN=origin
  process.env.BLOG_CREDENTIALS_FILE=file
  process.argv.push('--fresh-only')
  await import('./bootstrap.mjs')
}
const html=fs.readFileSync('dist/index.html','utf8')
if(!/<link rel="canonical" href="[^"]*"\s*\/>/.test(html))throw Error('Canonical tag missing from distribution')
fs.writeFileSync('dist/index.html',html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/,`<link rel="canonical" href="${origin.replaceAll('&','&amp;').replaceAll('"','&quot;')}/" />`))
console.log(JSON.stringify({origin,credentialsFile:fs.existsSync('.cache/owner-credentials.txt')?'.cache/owner-credentials.txt':null}))
