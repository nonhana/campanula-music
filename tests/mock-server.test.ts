import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { sveltekit } from '@sveltejs/kit/vite'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mockPlugin } from '../src/lib/server/mock/vite-plugin.ts'

// mock 开发服务器的 HTTP 行为：自动登录走真实加密 Cookie，写操作刷新后还在，reset 回种子。不连网易云，也不启动浏览器；浏览器 smoke 用 pnpm smoke:mock（需要先开 pnpm dev:mock）。
let origin = ''
let closed: () => Promise<void>
let cookie = ''

beforeAll(async () => {
  process.env.COOKIE_SECRET = 'campanula-mock-test-secret-0123456789abcdef'
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
      watch: null,
    },
    plugins: [
      mockPlugin(),
      sveltekit(),
    ],
  })
  const http = createHttpServer((req, res) => vite.middlewares(req, res))
  await new Promise<void>(resolve => http.listen(0, 'localhost', resolve))
  origin = `http://localhost:${(http.address() as AddressInfo).port}`
  closed = async () => {
    http.closeAllConnections()
    await new Promise(resolve => http.close(resolve))
    await vite.close()
  }
}, 30_000)

afterAll(async () => {
  await closed?.()
})

const api = async (path: string, init: RequestInit = {}): Promise<Response> => fetch(`${origin}${path}`, {
  ...init,
  headers: { ...init.headers, cookie },
})

describe('mock 开发服务器', () => {
  it('自动登录、账号、歌单、红心、播放地址都能用', async () => {
    const login = await fetch(`${origin}/mock/login`, { redirect: 'manual' })
    expect(login.status).toBe(303)
    const setCookie = login.headers.get('set-cookie') ?? ''
    cookie = setCookie.split(';')[0]!
    expect(cookie.startsWith('campanula_login=')).toBe(true)

    const account = await api('/api/account')
    expect((await account.json() as { account: { id: number } }).account.id).toBe(10000001)

    const list = await api('/api/playlists?uid=10000001')
    const playlists = (await list.json() as { playlists: { id: number }[] }).playlists
    expect(playlists).toHaveLength(55)

    const hearts = await api('/api/hearts?uid=10000001')
    expect((await hearts.json() as { songIds: number[] }).songIds).toHaveLength(4984)

    const url = await api('/api/songs/3433267939/play-url?quality=exhigh')
    expect((await url.json() as { url: string }).url).toBe('/mock-assets/audio/3433267939.wav')
  }, 30_000)

  it('写操作刷新后还在，reset 回种子', async () => {
    const renamed = await api('/api/playlists/900000019/name', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP 改过的名字' }),
    })
    expect(renamed.status).toBe(200)
    const shown = await api('/api/playlists/900000019')
    expect((await shown.json() as { playlist: { name: string } }).playlist.name).toBe('HTTP 改过的名字')

    await fetch(`${origin}/api/mock/reset`, { method: 'POST' })
    const back = await api('/api/playlists/900000019')
    expect((await back.json() as { playlist: { name: string } }).playlist.name).toBe('poems')
  }, 30_000)

  it('不认识的场景回 400，不会把 mock 弄坏', async () => {
    const bad = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'bogus' }),
    })
    expect(bad.status).toBe(400)
    const prototype = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'toString' }),
    })
    expect(prototype.status).toBe(400)
    expect((await api('/api/account')).status).toBe(200)
  }, 30_000)

  it('场景和覆盖报告', async () => {
    const scenario = await fetch(`${origin}/api/mock/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'login-expired' }),
    })
    expect(scenario.status).toBe(200)
    const account = await api('/api/account')
    expect(account.status).toBe(401)

    const report = await api('/api/mock/coverage')
    expect((await report.json() as { scenario: string }).scenario).toBe('login-expired')
    await fetch(`${origin}/api/mock/reset`, { method: 'POST' })
  }, 30_000)
})
