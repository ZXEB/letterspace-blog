import fs from 'node:fs'
import {validateOrigin} from './setup-selfhost.mjs'
const origin=validateOrigin(process.env.SITE_ORIGIN || 'http://localhost:18080')
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const html=fs.readFileSync('index.html','utf8')
if (!/<link rel="canonical" href="[^"]*"\s*\/>/.test(html)) throw Error('Canonical tag is missing')
fs.writeFileSync('index.html',html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/,`<link rel="canonical" href="${escape(origin)}/" />`))
