import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'

const output=path.resolve('.cache/oneclick')
const stage=path.join(output,'package')
fs.mkdirSync(stage,{recursive:true})
fs.mkdirSync(path.join(stage,'dist/assets'),{recursive:true})
for(const name of ['index.html','favicon.svg'])fs.copyFileSync(path.join('dist',name),path.join(stage,'dist',name))
fs.cpSync('dist/assets',path.join(stage,'dist/assets'),{recursive:true})
fs.mkdirSync(path.join(stage,'deploy'),{recursive:true})
fs.copyFileSync('deploy/nginx.conf.template',path.join(stage,'deploy/nginx.conf.template'))
fs.mkdirSync(path.join(stage,'scripts'),{recursive:true})
for(const name of ['setup-selfhost.mjs','initialize-oneclick.mjs','bootstrap.mjs','sitemap-server.mjs'])fs.copyFileSync(path.join('scripts',name),path.join(stage,'scripts',name))
const source=fs.readFileSync('compose.selfhost.yml','utf8').replaceAll('\r','')
const web=source.indexOf('  web:\n'),environment=source.indexOf('    environment:\n',web)
if(web<0||environment<0)throw Error('Web service not found')
let compose='# One-command distribution: prebuilt frontend, no git clone/npm/build step.\nservices:\n  web:\n    image: nginx:1.27-alpine\n'+source.slice(environment)
compose=compose.replace('    ports:\n','    volumes:\n      - ./dist:/usr/share/nginx/html:ro\n      - ./deploy/nginx.conf.template:/etc/nginx/templates/default.conf.template:ro\n    ports:\n')
if(compose.includes('    build:'))throw Error('Distribution must not require a build')
fs.writeFileSync('compose.quickstart.yml',compose)
fs.writeFileSync(path.join(stage,'compose.quickstart.yml'),compose)
const tag=process.env.LETTERSPACE_RELEASE_TAG || 'oneclick-2026.11.18'
fs.writeFileSync(path.join(stage,'VERSION'),tag+'\n')
const tar=process.platform==='win32'?'tar.exe':'tar'
const archive=path.join(output,'package.tar.gz')
execFileSync(tar,['-czf',archive,'-C',stage,'dist','deploy','scripts','compose.quickstart.yml','VERSION'])
const sha256=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
const filename=`letterspace-${sha256.slice(0,16)}.tar.gz`
const release=path.join(output,filename)
fs.copyFileSync(archive,release)
const base=(process.env.LETTERSPACE_DOWNLOAD_BASE || `https://github.com/ZXEB/letterspace-blog/releases/download/${tag}`).replace(/\/$/,'')
const template=fs.readFileSync('deploy/install.sh.template','utf8')
const installer=template.replace('@RELEASE_URL@',base+'/'+filename).replace('@RELEASE_SHA256@',sha256)
if(/@RELEASE_(?:URL|SHA256)@/.test(installer))throw Error('Unresolved installer tokens')
fs.writeFileSync(path.join(output,'install.sh'),installer)
fs.writeFileSync('install.sh',installer)
fs.writeFileSync(path.join(output,'SHA256SUMS'),`${sha256}  ${filename}\n${crypto.createHash('sha256').update(installer).digest('hex')}  install.sh\n`)
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify({tag,file:filename,sha256,bytes:fs.statSync(release).size,download:base+'/'+filename},null,2))
console.log(JSON.stringify({installer:path.join(output,'install.sh'),release,sha256,bytes:fs.statSync(release).size}))
