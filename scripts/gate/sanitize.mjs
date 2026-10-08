#!/usr/bin/env node
// 验证关卡①②：把录下的真实返回脱敏成测试数据（Spec #11“交付方式”第 5 条规矩）。
// 用法：SANITIZE_IPS=<要抹掉的 IP，逗号分隔> SANITIZE_OWN_IDS=<录制里没有出现在歌单列表中的本人歌单编号，逗号分隔> \
//   node scripts/gate/sanitize.mjs <录制目录> <输出目录>
// - 去掉 Cookie：返回体里的 cookie、token 等凭据字段清空；Set-Cookie 不进测试数据。
// - 替换 uid、昵称、头像链接：所有用户（包括歌单创建者等其他用户）的这些字段都换成假身份。
//   只有账号本人的昵称和 uid 会在任意字符串里替换；其他人的只换字段，免得把同名的歌手名之类的真数据改坏。
// - 账号资料里的个人信息（上次登录 IP、生日、地区、签名、注册时间、绑定时间）换成固定假值。
// - 账号绑定的手机号（从 account.userName 里认出来）、SANITIZE_IPS 里的 IP，在任何字符串里都换成固定假值。
//   只换这些确切的值，不用“11 位数字”这类宽泛规则，免得把歌单编号之类的真数据改坏。
// - 账号本人作为歌手的身份（profile.artistId 对应的歌手编号和名字）换成假的。
// - 本人自建歌单、本人作品（歌和专辑）的编号换成 9 字头的假编号：这些编号公开可查，查到就能找到真实账号。
//   本人歌单从歌单列表、创建者是本人的歌单对象里认出来；验证关卡②建了又删的临时歌单有的只出现在查询参数里，用 SANITIZE_OWN_IDS 传进来。
// - 大数组只留前 MAX_ITEMS 项，原长度记在 context.truncated；查询参数里成千上万个编号的列表（加歌、排序）也只留前 MAX_ITEMS 个。
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
const EXTRA_OWN_IDS = (process.env.SANITIZE_OWN_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean)

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
let selfUid
let selfNickname
let selfArtistId
for (const entry of entries) {
  const body = entry.res?.body
  if (['user_account', 'login_status', 'login_cellphone', 'login_qr_check', 'user_detail'].includes(entry.module)) {
    const account = body?.account ?? body?.data?.account
    const profile = body?.profile ?? body?.data?.profile
    remember(account?.id ?? profile?.userId, profile?.nickname)
    if (profile?.userId)
      selfUid ??= profile.userId
    if (profile?.nickname)
      selfNickname ??= profile.nickname
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

// 本人自建的歌单、本人作为歌手的歌和专辑：编号是公开的，拿去一查就能看到真实的创建者或歌手，所以也换成假编号
const ownIds = new Map()
function own(id, base) {
  if (id !== undefined && id !== null && !ownIds.has(String(id)))
    ownIds.set(String(id), base + ownIds.size)
}
for (const entry of entries) {
  for (const playlist of entry.module === 'user_playlist' ? entry.res?.body?.playlist ?? [] : []) {
    if (selfUid !== undefined && (playlist.creator?.userId === selfUid || playlist.userId === selfUid))
      own(playlist.id, 900000001)
  }
}
for (const id of EXTRA_OWN_IDS)
  own(id, 900000001)
function collectWorks(value) {
  if (Array.isArray(value)) {
    value.forEach(collectWorks)
    return
  }
  if (!value || typeof value !== 'object')
    return
  const artists = value.ar ?? value.artists
  // 歌单对象（有 trackCount）的创建者是本人：比如新建歌单的返回、已删除歌单的详情
  if (selfUid !== undefined && 'trackCount' in value && (value.creator?.userId === selfUid || value.userId === selfUid))
    own(value.id, 900000001)
  if (selfArtistId !== undefined && Array.isArray(artists) && artists.some(artist => artist?.id === selfArtistId)) {
    own(value.id, 910000001)
    own((value.al ?? value.album)?.id, 920000001)
  }
  Object.values(value).forEach(collectWorks)
}
for (const entry of entries)
  collectWorks(entry.res?.body)
const ownIdList = [...ownIds.keys()].sort((a, b) => b.length - a.length)

// 其他用户的昵称只在昵称字段里替换；全文替换只针对账号本人，免得把和某个昵称同名的歌手名之类的真数据改坏
const selfTexts = [selfNickname, ...selfArtistNames].filter(Boolean).sort((a, b) => b.length - a.length)

function cleanText(text) {
  let next = text
  for (const value of selfTexts)
    next = next.split(value).join(value === selfNickname ? nickMap.get(value) : FAKE_ARTIST_NAME)
  if (selfUid !== undefined)
    next = next.replace(new RegExp(`(?<!\\d)${selfUid}(?!\\d)`, 'g'), String(uidMap.get(String(selfUid))))
  for (const id of ownIdList)
    next = next.replace(new RegExp(`(?<!\\d)${id}(?!\\d)`, 'g'), String(ownIds.get(id)))
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
        return [key, item.map((binding, index) => ({ ...clean(binding, `${at}[${index}]`, truncated, true), url: '', id: index + 1, bindingTime: 1500000000000, refreshTime: 1500000000 }))]
      return [key, clean(item, at, truncated)]
    }))
  }
  if (typeof value === 'string')
    return cleanText(shortenList(value, path, truncated))
  if (typeof value === 'number' && ownIds.has(String(value)))
    return ownIds.get(String(value))
  return value
}

// 成千上万个编号的列表写成的字符串（查询参数里加歌的 tracks、排序的 ids，加歌返回的 trackIds）只留前 MAX_ITEMS 个，
// 格式不变（逗号分隔或 JSON 数组）
function shortenList(value, path, truncated) {
  const json = /^\[[\d,]*\]$/.test(value)
  if (!json && !/^\d+(?:,\d+)*$/.test(value))
    return value
  const items = (json ? value.slice(1, -1) : value).split(',').filter(Boolean)
  if (items.length <= MAX_ITEMS)
    return value
  truncated.push({ path, length: items.length })
  const kept = items.slice(0, MAX_ITEMS).join(',')
  return json ? `[${kept}]` : kept
}

mkdirSync(output, { recursive: true })
let written = 0
for (const entry of entries) {
  // 名字以 _ref. 开头的录制只用来认出账号本人（比如验证关卡②补录的 user_account），不写成测试数据
  if (entry.name.startsWith('_ref.'))
    continue
  written += 1
  const truncated = []
  const body = clean(entry.res?.body ?? null, 'body', truncated)
  // user_detail 的注册时间在返回体顶层，不在用户对象里
  if (entry.module === 'user_detail' && body && typeof body === 'object') {
    if ('createTime' in body)
      body.createTime = 1500000000000
    if ('createDays' in body)
      body.createDays = 1000
  }
  const query = clean(entry.query ?? {}, 'query', truncated)
  // 浏览器直传网易云图片存储（module 记成 nos_upload）不是 SDK 调用，也不经过测试版的云函数：
  // 没有 sdk 和 ip，region 记成 browser
  const direct = entry.via === 'browser-direct'
  const fixture = {
    module: entry.module,
    query,
    context: {
      recordedAt: entry.recordedAt,
      ...(direct ? { region: 'browser' } : { sdk: 'hana-music-api@1.4.0', region: entry.res?.instance?.region, ip: entry.options?.ip ?? 'default' }),
      viewer: entry.viewer ?? 'anonymous',
      ...(entry.note ? { note: entry.note } : {}),
      ...(truncated.length ? { truncated } : {}),
    },
    response: { status: entry.res?.status, body },
  }
  const [domain, ...rest] = entry.name.split('.')
  mkdirSync(join(output, domain), { recursive: true })
  writeFileSync(join(output, domain, `${rest.join('.')}.json`), `${JSON.stringify(fixture, null, 2)}\n`)
}
console.log(`users: ${uidMap.size}, own ids: ${ownIds.size}, wrote ${written} fixtures to ${output}`)
