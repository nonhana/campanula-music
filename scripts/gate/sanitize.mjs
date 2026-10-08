#!/usr/bin/env node
// 验证关卡①：把录下的真实返回脱敏成测试数据（Spec #11“交付方式”第 5 条规矩）。
// 用法：node scripts/gate/sanitize.mjs <录制目录> <输出目录>
// - 去掉 Cookie：返回体里的 cookie、token 等凭据字段清空；Set-Cookie 不进测试数据。
// - 替换 uid、昵称、头像链接：所有用户（包括歌单创建者等其他用户）都换成假身份。
// - 账号资料里的个人信息（上次登录 IP、生日、地区、签名、绑定的手机）换成固定假值。
// - 字符串里的手机号、IP 地址换成固定假值。
// - 大数组只留前 MAX_ITEMS 项，原长度记在 context.truncated。
// - 其余结构和取值原样保留。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('用法：node scripts/gate/sanitize.mjs <录制目录> <输出目录>')
  process.exit(1)
}

const MAX_ITEMS = 30
const FAKE_UID_BASE = 10000001
const FAKE_AVATAR = 'https://p1.music.126.net/placeholder/avatar.jpg'
const FAKE_IMG_ID = 109951000000000000
const FAKE_IP = '203.0.113.1'
const FAKE_PHONE = '13800000000'
const CREDENTIAL_KEYS = new Set(['cookie', 'token', 'tokenJsonStr', 'MUSIC_U', 'MUSIC_A', '__csrf', 'csrf_token', 'accessToken', 'refreshToken'])
const USER_ID_KEYS = new Set(['userId', 'userid', 'uid', 'creatorId', 'subscriberId'])
const NICK_KEYS = new Set(['nickname', 'nickName', 'remarkName'])
const AVATAR_URL_KEYS = new Set(['avatarUrl', 'backgroundUrl', 'avatarDetail', 'identityIconUrl'])
const AVATAR_ID_KEYS = new Set(['avatarImgId', 'backgroundImgId'])
const AVATAR_ID_STR_KEYS = new Set(['avatarImgIdStr', 'backgroundImgIdStr', 'avatarImgId_str'])
// 只在用户对象（profile、account、creator、user 等）里出现的个人信息
const PROFILE_FIXED = {
  signature: '',
  description: '',
  detailDescription: '',
  birthday: 631152000000,
  province: 110000,
  city: 110101,
  lastLoginIP: FAKE_IP,
  userName: '1_00000000000',
}
const PHONE_TEXT = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const IP_TEXT = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g

const files = readdirSync(input).filter(name => name.endsWith('.json')).sort()
const entries = files.map(name => JSON.parse(readFileSync(join(input, name), 'utf8')))

// 第一遍：收集所有用户身份，按出现顺序分配假 uid 和假昵称；登录账号本人固定是第一个。
const uidMap = new Map()
const nickMap = new Map()
function isUserObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && ('userId' in value || 'nickname' in value || 'avatarUrl' in value || 'userName' in value)
}
function remember(uid, nickname) {
  if (uid !== undefined && uid !== null && Number(uid) > 0 && !uidMap.has(String(uid)))
    uidMap.set(String(uid), FAKE_UID_BASE + uidMap.size)
  if (typeof nickname === 'string' && nickname && !nickMap.has(nickname))
    nickMap.set(nickname, nickMap.size === 0 ? '测试听众' : `用户${nickMap.size + 1}`)
}
for (const entry of entries) {
  const body = entry.res?.body
  if (['user_account', 'login_status', 'login_cellphone', 'login_qr_check', 'user_detail'].includes(entry.module)) {
    const account = body?.account ?? body?.data?.account
    const profile = body?.profile ?? body?.data?.profile
    remember(account?.id ?? profile?.userId, profile?.nickname)
  }
}
function collect(value) {
  if (Array.isArray(value)) {
    value.forEach(collect)
    return
  }
  if (!value || typeof value !== 'object')
    return
  if (isUserObject(value))
    remember(value.userId, value.nickname)
  for (const [key, item] of Object.entries(value)) {
    if (USER_ID_KEYS.has(key) && (typeof item === 'number' || typeof item === 'string'))
      remember(item)
    collect(item)
  }
}
for (const entry of entries)
  collect(entry.res?.body)
// 账号本人的 account.id 和 profile.userId 是同一个数，已经在上面最先登记

const nicknames = [...nickMap.keys()].sort((a, b) => b.length - a.length)
const uids = [...uidMap.keys()].sort((a, b) => b.length - a.length)

function cleanText(text) {
  let next = text
  for (const nickname of nicknames)
    next = next.split(nickname).join(nickMap.get(nickname))
  for (const uid of uids)
    next = next.replace(new RegExp(`(?<!\\d)${uid}(?!\\d)`, 'g'), String(uidMap.get(uid)))
  return next.replace(PHONE_TEXT, FAKE_PHONE).replace(IP_TEXT, FAKE_IP)
}

function clean(value, path, truncated, inUser = false) {
  if (Array.isArray(value)) {
    const kept = value.length > MAX_ITEMS ? value.slice(0, MAX_ITEMS) : value
    if (kept !== value)
      truncated.push({ path, length: value.length })
    return kept.map((item, index) => clean(item, `${path}[${index}]`, truncated, inUser))
  }
  if (value && typeof value === 'object') {
    const user = inUser || isUserObject(value)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const at = `${path}.${key}`
      if (CREDENTIAL_KEYS.has(key))
        return [key, typeof item === 'string' ? '' : item === null ? null : '']
      if ((USER_ID_KEYS.has(key) || (key === 'id' && path.endsWith('.account'))) && uidMap.has(String(item)))
        return [key, typeof item === 'string' ? String(uidMap.get(String(item))) : uidMap.get(String(item))]
      if (NICK_KEYS.has(key) && typeof item === 'string' && item)
        return [key, nickMap.get(item) ?? '某用户']
      if (AVATAR_URL_KEYS.has(key) && typeof item === 'string' && item)
        return [key, FAKE_AVATAR]
      if (AVATAR_ID_KEYS.has(key) && typeof item === 'number' && item)
        return [key, FAKE_IMG_ID]
      if (AVATAR_ID_STR_KEYS.has(key) && typeof item === 'string' && item)
        return [key, String(FAKE_IMG_ID)]
      if (user && key in PROFILE_FIXED && item !== null && item !== undefined)
        return [key, PROFILE_FIXED[key]]
      if (key === 'bindings' && Array.isArray(item))
        return [key, item.map((binding, index) => ({ ...clean(binding, `${at}[${index}]`, truncated, true), url: '', id: index + 1 }))]
      return [key, clean(item, at, truncated, user)]
    }))
  }
  if (typeof value === 'string')
    return cleanText(value)
  return value
}

mkdirSync(output, { recursive: true })
for (const [index, entry] of entries.entries()) {
  const truncated = []
  const body = clean(entry.res?.body ?? null, 'body', truncated)
  const query = clean(entry.query ?? {}, 'query', [])
  const fixture = {
    module: entry.module,
    query,
    context: {
      recordedAt: entry.recordedAt,
      sdk: 'hana-music-api@1.4.0',
      region: entry.res?.instance?.region,
      ip: entry.options?.ip ?? 'default',
      viewer: entry.viewer ?? 'anonymous',
      ...(entry.note ? { note: entry.note } : {}),
      ...(truncated.length ? { truncated } : {}),
    },
    response: { status: entry.res?.status, body },
  }
  const [domain, ...rest] = entry.name.split('.')
  mkdirSync(join(output, domain), { recursive: true })
  writeFileSync(join(output, domain, `${rest.join('.')}.json`), `${JSON.stringify(fixture, null, 2)}\n`)
  if (index === 0)
    console.log(`users: ${uidMap.size}, nicknames: ${nickMap.size}`)
}
console.log(`wrote ${entries.length} fixtures to ${output}`)
