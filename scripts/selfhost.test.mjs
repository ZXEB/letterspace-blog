import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {setupEnvironment,validateOrigin} from './setup-selfhost.mjs'

const parent=path.resolve('.cache/selfhost-tests')
fs.mkdirSync(parent,{recursive:true})
test('Fresh setup generates independent keys and refuses to overwrite any existing configuration',()=>{
  const root=fs.mkdtempSync(path.join(parent,'setup-'))
  setupEnvironment({root,origin:'https://blog.example.com',project:'test-blog',port:'18081',bind:'127.0.0.1'})
  const before=fs.readFileSync(path.join(root,'.env'),'utf8')
  const values=Object.fromEntries(before.trim().split('\n').map(l=>l.split('=')))
  assert.equal(values.SITE_ORIGIN,'https://blog.example.com')
  assert.equal(values.COMPOSE_PROJECT_NAME,'test-blog')
  assert.equal(values.WEB_PORT,'18081')
  assert.match(values.POSTGRES_PASSWORD,/^[a-f0-9]{48}$/)
  assert.match(values.JWT_SECRET,/^[a-f0-9]{96}$/)
  assert.match(values.MX_ENCRYPT_KEY,/^[a-f0-9]{64}$/)
  assert.notEqual(values.MX_ENCRYPT_KEY,values.JWT_SECRET)
  assert.throws(()=>setupEnvironment({root,origin:'https://other.example.com'}),{code:'EEXIST'})
  assert.equal(fs.readFileSync(path.join(root,'.env'),'utf8'),before)
})
test('Rejects unsafe URLs, paths, ports and shared-project surprises before writing',()=>{
  for(const origin of ['file:///tmp/a','https://user:pass@example.com','https://example.com/api','https://example.com?q=x']) assert.throws(()=>validateOrigin(origin))
  const root=fs.mkdtempSync(path.join(parent,'invalid-'))
  assert.throws(()=>setupEnvironment({root,origin:'https://example.com',port:'99999'}))
  assert.throws(()=>setupEnvironment({root,origin:'https://example.com',project:'../other'}))
  assert.equal(fs.existsSync(path.join(root,'.env')),false)
})
