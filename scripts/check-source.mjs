import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import crypto from 'node:crypto'
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
const forbidden=/^(?:\.env$|\.cache\/|node_modules\/|dist\/|backups\/|verification\/)|(?:\.sql(?:\.gz)?$|\.dump$|\.tar\.gz$|owner-credentials\.txt$)/
const patterns=[['GitHub token',/\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/],['Private key',/-----BEGIN (?:(?:OPENSSH|RSA|EC|DSA) )?PRIVATE KEY-----/]]
const localSecrets=[]
if(fs.existsSync('.env'))for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const i=line.indexOf('=');if(/^(POSTGRES_PASSWORD|JWT_SECRET|MX_ENCRYPT_KEY)$/.test(line.slice(0,i))&&line.slice(i+1).length>=16)localSecrets.push(line.slice(i+1))}
if(fs.existsSync('.cache/owner-credentials.txt'))for(const line of fs.readFileSync('.cache/owner-credentials.txt','utf8').split(/\r?\n/)){if(line.startsWith('password:'))localSecrets.push(line.slice(line.indexOf(':')+1).trim())}
const failures=[]
for(const file of files){
  if(/^releases\/letterspace-[0-9a-f]{16}\.tar\.gz$/.test(file)){
    const names=execFileSync(process.platform==='win32'?'tar.exe':'tar',['-tzf',file],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean)
    if(names.some(name=>/(^\/|(^|\/)\.\.($|\/)|(^|\/)\.env($|\.)|owner-credentials|\.dump$|\.sql$)/.test(name) && name !== 'scripts/mixspace-runtime-schema.sql'))failures.push({file,reason:'Package contains a private or unexpected path'})
    if(!crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').startsWith(file.match(/[0-9a-f]{16}/)[0]))failures.push({file,reason:'Package checksum does not match its name'})
    for(const name of names.filter(name=>!name.endsWith('/'))){
      const content=execFileSync(process.platform==='win32'?'tar.exe':'tar',['-xOzf',file,name],{encoding:'utf8',maxBuffer:5*1024*1024})
      for(const [reason,pattern]of patterns)if(pattern.test(content))failures.push({file,reason:`${name}: ${reason}`})
      if(localSecrets.some(secret=>secret&&content.includes(secret)))failures.push({file,reason:`${name}: Contains a local deployment secret`})
    }
    continue
  }
  if(forbidden.test(file) && file !== 'scripts/mixspace-runtime-schema.sql'){failures.push({file,reason:'Runtime/private file tracked'});continue}
  const text=fs.readFileSync(file,'utf8')
  for(const [reason,pattern]of patterns)if(pattern.test(text))failures.push({file,reason})
  if(localSecrets.some(secret=>secret&&text.includes(secret)))failures.push({file,reason:'Contains a local deployment secret'})
}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1}else console.log(`Source check passed: ${files.length} tracked files; no tracked runtime files, known token patterns or local deployment secrets.`)
