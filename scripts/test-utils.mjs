import fs from 'node:fs'
import path from 'node:path'
import { request } from './network.mjs'

export const origin = process.env.BLOG_ORIGIN || 'http://localhost:18080'
export const credentials = Object.fromEntries(fs.readFileSync(process.env.BLOG_CREDENTIALS_FILE || new URL('../.cache/owner-credentials.txt', import.meta.url), 'utf8').trim().split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0,i).trim(),line.slice(i+1).trim()] }))
let cookie = ''
export async function api(route, method = 'GET', body, authenticated = true) {
  const response = await request(`${origin}/api/v3/${route}${method==='GET' ? (route.includes('?') ? '&' : '?')+'_t=1' : ''}`, { method, headers: { ...(body ? {'Content-Type':'application/json'} : {}), Origin: origin, ...(authenticated && cookie ? { Cookie:cookie } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) })
  if (!response.ok) throw Error(`${method} ${route}: ${response.status} ${(await response.text()).slice(0,300)}`)
  const cookies = response.headers.getSetCookie()
  if (cookies.length && authenticated) cookie = cookies.map(c => c.split(';')[0]).join('; ')
  const value = await response.text()
  return value ? JSON.parse(value) : {}
}
export const data = value => value.data ?? value
export const publicApi = async route => data(await api(route, 'GET', undefined, false))
export async function login() { const result = data(await api('auth/sign-in/username', 'POST', {username:credentials.username, password:credentials.password})); if (!result.user) throw Error('Authentication failed'); return result }
export function report(name, checks, extra = {}) {
  const report = { date: new Date().toISOString(), origin, passed: checks.length, checks, ...extra }
  const file = path.resolve('.cache/ui', name)
  fs.writeFileSync(file, JSON.stringify(report,null,2))
  console.log(JSON.stringify({ passed: checks.length, report: file, ...extra }))
}
