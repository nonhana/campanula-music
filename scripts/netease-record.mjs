// 录网易云真实返回的公共部分（tests/fixtures/netease/README.md「录制」）。每张票自己写一个一次性脚本决定录哪些调用，
// 用这里的三样东西：openSession 解开登录 Cookie，createRecorder 记下每次调用，save 脱敏、查残留、写文件。
// 脱敏照 README「脱敏」，用作者本机的 _notes/fixture-identity.json（本人身份和真假编号对照），
// 录到新的人、本人新的歌单和作品时补进对照表，下一批录制沿用同一套假编号。
import { Buffer } from 'node:buffer'
import { createDecipheriv, hkdfSync } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { findLeaks, IDENTITY_FILE, loadIdentity } from './fixture-identity.mjs'

const ROOT = join(import.meta.dirname, '..')
const SDK_DIR = join(ROOT, 'node_modules/hana-music-api')
const PLACEHOLDER = 'https://p1.music.126.net/placeholder/avatar.jpg'
const IMG_ID = 109951000000000000
/** README「脱敏」：超过 30 项的数组只留前 30 项（整页录制要测分页时传 truncate: false） */
const KEEP = 30

/**
 * 解开浏览器里 campanula_login Cookie 的值（开发者工具里复制），拿到调 SDK 用的凭据。
 * 和 src/lib/server/credentials.ts 的加密对应：COOKIE_SECRET 派生的 AES-256-GCM。凭据只在内存里
 */
export async function openSession(sealed) {
  const line = readFileSync(join(ROOT, '.env'), 'utf8').match(/^COOKIE_SECRET=(.*)$/m)
  if (!line)
    throw new Error('.env 里没有 COOKIE_SECRET')
  const secret = line[1].trim().replace(/^(['"])(.*)\1$/, '$2')
  const raw = Buffer.from(decodeURIComponent(sealed), 'base64url')
  const key = Buffer.from(hkdfSync('sha256', secret, '', 'campanula login cookie', 32))
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(raw.length - 16))
  const login = JSON.parse(Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString('utf8'))
  if (!login.session)
    throw new Error('这个登录 Cookie 里没有登录')
  const { invokeModule } = await import(join(SDK_DIR, 'dist/index.js'))
  const config = { cookie: login.session.credentials, deviceId: login.deviceId, state: { deviceId: login.deviceId } }
  /** 调一个 SDK 模块；SDK 抛出的失败（带 status 和 body）当作一次返回 */
  return async function invoke(module, query) {
    try {
      const response = await invokeModule(module, query, config)
      return { status: response.status, body: response.body }
    }
    catch (thrown) {
      if (thrown && typeof thrown.status === 'number' && 'body' in thrown)
        return { status: thrown.status, body: thrown.body }
      throw thrown
    }
  }
}

const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value)
const wholeNumber = number => new RegExp(`(?<![0-9])${number}(?![0-9])`, 'g')

/**
 * 脱敏一次调用的返回。identity 会被补上新录到的人、本人歌单和作品（调用方负责存回文件）。
 * 返回脱敏后的 body 和截短的记录
 */
function sanitize(module, body, identity, truncate) {
  const { self, artist } = identity
  const fake = (table, counter) => real => (identity[table][real] ??= identity.next[counter]++)
  // 0、-1 是“没有这个人”（例如专辑页 album.info.commentThread.resourceInfo.userId 是 -1），不是谁的编号
  const fakeUser = (uid) => {
    if (uid <= 0)
      return uid
    return uid === self.uid ? self.fakeUid : fake('users', 'user')(uid)
  }
  const truncated = []

  // 1. 记下本人的歌单（创建者是本人）和作品（歌手里有本人的歌，连同专辑），换编号用
  const collect = (node) => {
    if (Array.isArray(node))
      return node.forEach(collect)
    if (!isRecord(node))
      return
    if (typeof node.id === 'number' && isRecord(node.creator) && node.creator.userId === self.uid && 'trackCount' in node)
      fake('playlists', 'playlist')(node.id)
    if (typeof node.id === 'number' && Array.isArray(node.ar) && node.ar.some(item => item?.id === artist.id)) {
      fake('works', 'song')(node.id)
      if (isRecord(node.al) && node.al.id > 0)
        fake('works', 'album')(node.al.id)
    }
    Object.values(node).forEach(collect)
  }
  collect(body)

  // 2. 换掉人：用户对象（有 userId 和 nickname）换身份和个人信息，本人作为歌手换成测试歌手，凭据字段清空，长数组截短
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      if (truncate && node.length > KEEP) {
        truncated.push({ path, length: node.length })
        node = node.slice(0, KEEP)
      }
      return node.map((item, index) => walk(item, `${path}[${index}]`))
    }
    if (!isRecord(node))
      return node
    const user = typeof node.userId === 'number' && 'nickname' in node
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      const at = `${path}.${key}`
      if ((key === 'userId' || key === 'uid') && typeof value === 'number')
        out[key] = fakeUser(value)
      else if (node.id === artist.id && 'name' in node && (key === 'id' || key === 'name'))
        out[key] = key === 'id' ? artist.fakeId : artist.fakeName
      else if ((key === 'artistId' && value === artist.id) || (key === 'artistName' && value === artist.name))
        out[key] = key === 'artistId' ? artist.fakeId : artist.fakeName
      else if (['cookie', 'token', 'tokenJsonStr'].includes(key) && typeof value === 'string')
        out[key] = ''
      else if (user && key === 'nickname')
        out[key] = node.userId === self.uid ? self.fakeNickname : `用户${fakeUser(node.userId) - 10000000}`
      else if (user && (key === 'avatarUrl' || key === 'backgroundUrl'))
        out[key] = PLACEHOLDER
      else if (user && key === 'province')
        out[key] = 110000
      else if (user && key === 'city')
        out[key] = 110101
      else if (user && key === 'birthday')
        out[key] = 631152000000
      else if (user && ['signature', 'description', 'detailDescription'].includes(key))
        out[key] = ''
      else if (user && (key === 'avatarImgId' || key === 'backgroundImgId'))
        out[key] = IMG_ID
      else if (user && ['avatarImgIdStr', 'backgroundImgIdStr', 'avatarImgId_str'].includes(key))
        out[key] = String(IMG_ID)
      else if (user && (key === 'avatarDetail' || key === 'remarkName'))
        out[key] = null
      else
        out[key] = walk(value, at)
    }
    return out
  }
  let clean = walk(body, 'body')

  // 3. 换编号：本人歌单、作品、本人的 uid 和昵称在任意文字里都换（例如 commentThreadId、“XX喜欢的音乐”）
  let text = JSON.stringify(clean)
  for (const [real, fakeId] of [...Object.entries(identity.playlists), ...Object.entries(identity.works)])
    text = text.replace(wholeNumber(real), String(fakeId))
  text = text.replace(wholeNumber(self.uid), String(self.fakeUid)).replaceAll(self.nickname, self.fakeNickname)
  clean = JSON.parse(text)
  return { body: clean, truncated }
}

/**
 * 记下一批调用，最后一起脱敏、写文件。
 * dir：写到哪个目录（相对仓库根目录，例如 tests/fixtures/netease/library/sync/after），文件名是“序号-模块名.json.gz”。
 * viewer：录制视角（README「文件格式」的 context.viewer，例如 vip-qr）。truncate：false 时不截短（整页录制）
 */
export function createRecorder({ invoke, dir, viewer, truncate = true }) {
  const identity = loadIdentity()
  if (!identity)
    throw new Error(`没有 ${IDENTITY_FILE}：先在作者本机建好本人身份和对照表（README「录制」）`)
  const sdk = `hana-music-api@${JSON.parse(readFileSync(join(SDK_DIR, 'package.json'), 'utf8')).version}`
  const calls = []
  return {
    /** 调一次网易云并记下来，返回原样的结果（status、body），一次性脚本据此决定下一步 */
    async call(module, query) {
      const outcome = await invoke(module, query)
      calls.push({ module, query, outcome, at: new Date().toISOString() })
      return outcome
    },
    /**
     * 脱敏、查残留，写进 dir；有残留的那个文件不写，原因放在 problems 里。
     * 对照表补上新录到的编号后存回 _notes/fixture-identity.json
     */
    save() {
      const out = join(ROOT, dir)
      mkdirSync(out, { recursive: true })
      const written = []
      const problems = []
      calls.forEach(({ module, query, outcome, at }, index) => {
        const { body, truncated } = sanitize(module, outcome.body, identity, truncate)
        const cleanQuery = sanitize(null, query, identity, false).body
        const fixture = {
          module,
          query: cleanQuery,
          context: { recordedAt: at, sdk, region: 'local', ip: 'default', viewer, ...(truncated.length ? { truncated } : {}) },
          response: { status: outcome.status, body },
        }
        const text = `${JSON.stringify(fixture, null, 2)}\n`
        const name = `${String(index + 1).padStart(3, '0')}-${module}.json.gz`
        const leaks = findLeaks(text, identity)
        if (leaks.length) {
          problems.push(`${name} 没写：\n  ${leaks.join('\n  ')}`)
          return
        }
        writeFileSync(join(out, name), gzipSync(text))
        written.push(join(dir, name))
      })
      writeFileSync(IDENTITY_FILE, `${JSON.stringify(identity, null, 2)}\n`)
      return { written, problems }
    },
  }
}
