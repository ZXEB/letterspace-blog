import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {spawn} from 'node:child_process'

async function fixture(ownerExists){
  const parent=path.resolve('.cache/oneclick-tests');fs.mkdirSync(parent,{recursive:true})
  const root=fs.mkdtempSync(path.join(parent,'resume-'))
  const calls=[]
  const server=http.createServer((req,res)=>{calls.push(req.method+' '+req.url);res.setHeader('Content-Type','application/json');if(req.url==='/api/v3/init'){res.statusCode=403;res.end('{"error":{"message":"Forbidden resource"}}')}else if(req.url==='/api/v3/owner'&&ownerExists){res.end('{"data":{"id":"existing-owner"}}')}else{res.statusCode=404;res.end('{}')}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const env=`SITE_ORIGIN=http://example.test:18080\nWEB_PORT=${server.address().port}\n`
  fs.writeFileSync(path.join(root,'.env'),env)
  fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist/index.html'),'<link rel="canonical" href="http://old.invalid/" />')
  fs.mkdirSync(path.join(root,'.cache'))
  const credentials='username: existing-admin\npassword: preserved-test-password\n'
  fs.writeFileSync(path.join(root,'.cache/owner-credentials.txt'),credentials)
  return {root,calls,env,credentials,close:()=>new Promise(resolve=>server.close(resolve))}
}
const run=root=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve('scripts/initialize-oneclick.mjs')],{cwd:root,env:process.env,windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',resolve)})
test('Resume detects the closed initialization endpoint and leaves the existing owner/password unchanged',async()=>{
  const f=await fixture(true)
  try{
    assert.equal(await run(f.root),0)
    assert.deepEqual(f.calls,['GET /api/v3/init','GET /api/v3/owner'])
    assert.equal(fs.readFileSync(path.join(f.root,'.env'),'utf8'),f.env)
    assert.equal(fs.readFileSync(path.join(f.root,'.cache/owner-credentials.txt'),'utf8'),f.credentials)
  }finally{await f.close()}
})
test('Forbidden init without a verifiable owner refuses to initialize instead of resetting anything',async()=>{
  const f=await fixture(false)
  try{
    assert.notEqual(await run(f.root),0)
    assert.deepEqual(f.calls,['GET /api/v3/init','GET /api/v3/owner'])
    assert.equal(fs.readFileSync(path.join(f.root,'.cache/owner-credentials.txt'),'utf8'),f.credentials)
  }finally{await f.close()}
})
