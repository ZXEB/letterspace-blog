import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {parseArgs} from 'node:util'
import {pathToFileURL} from 'node:url'

export function validateOrigin(value) {
  const url = new URL(value)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('SITE_ORIGIN must be an http(s) origin without a path, credentials or query')
  return url.origin
}
export function setupEnvironment({root=process.cwd(),origin,port='18080',bind='0.0.0.0',project='letterspace-selfhost'}) {
  const siteOrigin = validateOrigin(origin)
  if (!/^\d+$/.test(String(port)) || +port < 1 || +port > 65535) throw Error('Port must be 1..65535')
  if (!['0.0.0.0','127.0.0.1'].includes(bind)) throw Error('Bind must be 0.0.0.0 or 127.0.0.1')
  if (!/^[a-z0-9][a-z0-9_-]{1,50}$/.test(project)) throw Error('Project must use lowercase letters, numbers, underscores or hyphens')
  const content = [
    `COMPOSE_PROJECT_NAME=${project}`,`SITE_ORIGIN=${siteOrigin}`,`WEB_BIND_ADDRESS=${bind}`,`WEB_PORT=${port}`,
    `POSTGRES_PASSWORD=${crypto.randomBytes(24).toString('hex')}`,
    `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    `MX_ENCRYPT_KEY=${crypto.randomBytes(32).toString('hex')}`,
  ].join('\n')+'\n'
  // Exclusive creation is intentional: existing database passwords and signing
  // keys must never be silently regenerated, including concurrent invocations.
  fs.writeFileSync(path.join(root,'.env'),content,{flag:'wx',mode:0o600})
  return {origin:siteOrigin,port:+port,bind,project}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const {values}=parseArgs({options:{origin:{type:'string'},port:{type:'string',default:'18080'},bind:{type:'string',default:'0.0.0.0'},project:{type:'string',default:'letterspace-selfhost'}}})
    if (!values.origin) throw Error('Usage: node scripts/setup-selfhost.mjs --origin http://YOUR_IP:18080 [--port 18080] [--project letterspace-selfhost]')
    const result=setupEnvironment(values)
    console.log(JSON.stringify({...result,created:'.env',secrets:'generated; not printed'}))
  } catch(error) { console.error(error.code==='EEXIST' ? 'Refusing to overwrite existing .env. Keep existing database passwords and encryption keys.' : error.message); process.exitCode=1 }
}
