import fs from 'node:fs'
import {validateOrigin} from './setup-selfhost.mjs'
const values=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}))
const origin=validateOrigin(values.SITE_ORIGIN)
const connect=process.env.BLOG_ORIGIN || `http://127.0.0.1:${values.WEB_PORT || 18080}`
async function request(path,body){
  const response=await fetch(`${connect}/api/v3/${path}`,{method:body?'PATCH':'GET',headers:{'User-Agent':'Mozilla/5.0 LetterspaceSetup',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  if(!response.ok)throw Error(`Setup API ${response.status}: ${path}`)
  const result=await response.json();return result.data??result
}
const initialized=await request('init')
if(initialized.is_init||initialized.isInit)throw Error('Site is already initialized. No settings or accounts were changed.')
await request('init/configs/url',{webUrl:origin,serverUrl:origin,adminUrl:origin+'/proxy/qaqdmin',wsUrl:origin})
await request('init/configs/seo',{title:'纸间',description:'把日子写成一封信，记录生活、技术与寻常日子。',keywords:['生活','技术','个人博客'],icon:origin+'/favicon.svg'})
console.log('Fresh site URLs configured. Open /proxy/qaqdmin#/setup to choose your own administrator and password.')
