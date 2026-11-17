import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { startBrowserProxy } from './network.mjs'

export const uiDir = path.resolve('.cache/ui')
fs.mkdirSync(uiDir, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright')
export async function openBrowser(profile = 'acceptance-profile') {
  const proxy = await startBrowserProxy()
  const temp = path.join(uiDir, 'temp')
  fs.mkdirSync(temp, { recursive: true })
  const context = await chromium.launchPersistentContext(path.join(uiDir, profile), {
    executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    viewport: { width: 1440, height: 1050 },
    env: { ...process.env, TEMP: temp, TMP: temp },
    args: [`--disk-cache-dir=${path.join(uiDir, profile + '-cache')}`, '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', '--proxy-bypass-list=<-loopback>'],
    ...proxy.options,
  })
  return { context, close: async () => { await context.close(); await proxy.close() } }
}
