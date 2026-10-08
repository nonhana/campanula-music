#!/usr/bin/env node
// 验证关卡①：把录下的真实返回脱敏成测试数据（Spec #11“交付方式”第 5 条规矩）。
// 用法：SANITIZE_IPS=<要抹掉的 IP，逗号分隔> node scripts/gate/sanitize.mjs <录制目录> <输出目录>
// - 去掉 Cookie：返回体里的 cookie、token 等凭据字段清空；Set-Cookie 不进测试数据。
// - 替换 uid、昵称、头像链接：所有用户（包括歌单创建者等其他用户）都换成假身份。
// - 账号资料里的个人信息（上次登录 IP、生日、地区、签名、注册时间）换成固定假值。
// - 账号绑定的手机号（从 account.userName 里认出来）、SANITIZE_IPS 里的 IP，在任何字符串里都换成固定假值。
//   只换这些确切的值，不用“11 位数字”这类宽泛规则，免得把歌单编号之类的真数据改坏。
// - 账号本人作为歌手的身份（profile.artistId 对应的歌手编号和名字）换成假的。
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
  artistId: 0,
  createTime: 1500000000000,
}
const FAKE_ARTIST_ID = 99999999
const FAKE_ARTIST_NAME = '测试歌手'
const IPS = (process.env.SANITIZE_IPS ?? '').split(',').map(ip => ip.trim()).filter(Boolean)

const files = readdirSync(input).filter(name => name.endsWith('.json')).sort()
const entries = files.map(name => JSON.parse(readFileSync(join(input, name), 'utf8')))

// 第一遍：收集所有用户身份，按出现顺序分配假 uid 和假昵称；登录账号本人固定是第一个。
const uidMap = new Map()
const nickMap = new Map()
// 只认“像一个人”的对象：有昵称、有账号名，或同时有 userId 和头像。歌单对象也带 userId（创建者），不算。
function isUserObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && ('nickname' in value || 'userName' in value || ('userId' in value && 'avatarUrl' in value))
}
function remember(uid, nickname) {
  if (uid !== undefined && uid !== null && Number(uid) > 0 && !uidMap.has(String(uid)))
    uidMap.set(String(uid), FAKE_UID_BASE + uidMap.size)
  if (typeof nickname === 'string' && nickname && !nickMap.has(nickname))
    nickMap.set(nickname, nickMap.size === 0 ? '测试听众' : `用户${nickMap.size + 1}`)
}
const phones = new Set()
let selfArtistId
for (const entry of entries) {
  const body = entry.res?.body
  if (['user_account', 'login_status', 'login_cellphone', 'login_qr_check', 'user_detail'].includes(entry.module)) {
    const account = body?.account ?? body?.data?.account
    const profile = body?.profile ?? body?.data?.profile
    remember(account?.id ?? profile?.userId, profile?.nickname)
    const phone = /^1_(\d{6,})$/.exec(account?.userName ?? '')?.[1]
    if (phone && account?.anonimousUser === false)
      phones.add(phone)
    if (profile?.artistId)
      selfArtistId ??= profile.artistId
  }
}
const selfArtistNames = new Set()
function collect(value) {
  if (Array.isArray(value)) {
    value.forEach(collect)
    return
  }
  if (!value || typeof value !== 'object')
    return
  if (isUserObject(value))
    remember(value.userId, value.nickname)
  if (selfArtistId && value.id === selfArtistId && typeof value.name === 'string' && value.name)
    selfArtistNames.add(value.name)
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
  for (const name of selfArtistNames)
    next = next.split(name).join(FAKE_ARTIST_NAME)
  for (const uid of uids)
    next = next.replace(new RegExp(`(?<!\\d)${uid}(?!\\d)`, 'g'), String(uidMap.get(uid)))
  for (const phone of phones)
    next = next.split(phone).join(FAKE_PHONE)
  for (const ip of IPS)
    next = next.split(ip).join(FAKE_IP)
  // 风控跳转链接里带的 NMSCVT 是一次性的验证凭据（同名 Set-Cookie，20 分钟有效），也抹掉
  return next.replace(/NMSCVT=\d+/g, 'NMSCVT=0')
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
    const selfArtist = selfArtistId !== undefined && value.id === selfArtistId && 'name' in value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const at = `${path}.${key}`
      if (CREDENTIAL_KEYS.has(key))
        return [key, typeof item === 'string' ? '' : item === null ? null : '']
      if (selfArtist && key === 'id')
        return [key, FAKE_ARTIST_ID]
      if ((USER_ID_KEYS.has(key) || (key === 'id' && path.endsWith('.account'))) && uidMap.has(String(item)))
        return [key, typeof item === 'string' ? String(uidMap.get(String(item))) : uidMap.get(String(item))]
      if (key === 'artistId' && item === selfArtistId)
        return [key, FAKE_ARTIST_ID]
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
      return [key, clean(item, at, truncated)]
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
