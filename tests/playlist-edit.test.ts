import type { App } from '#lib/app/app.js'
import type { Device } from './harness/device'
import { describe, expect, it } from 'vitest'
import { held, never } from './harness/hold'
import { listener, storedLibrary, storedPlaylistIds, storedTrackIds } from './harness/listener'
import { useWorld } from './harness/world'

const world = useWorld()
const { signInAtLikedTracks, dailySongs, openJazz, replyLibrary } = listener(world)

// 歌单的增删改（#33，Spec #11“歌单编辑”“客户端：曲库副本”）：新建等网易云建好才进曲库，
// 删除、名称、简介、标签、改公开先改本地、立即生效，网易云拒绝时改回原样并说明原因。
// 录制见 tests/fixtures/netease/README.md 的验证关卡②和 #33 一条
/** 标签库（验证关卡②录的，70 个截到前 30 个，5 类都在） */
const TAGS = 'playlist-edit/playlist_catlist.json'
/** 新建隐私歌单「Campanula 测试 · 可删除」，和紧接着读的详情（#33 录的，假编号接着 #22 那套） */
const CREATED = {
  id: 900000023,
  name: 'Campanula 测试 · 可删除',
  create: 'playlist-edit/create/001-playlist_create.json.gz',
  detail: 'playlist-edit/create/002-playlist_detail.json.gz',
}
/** 新建时网易云说操作过于频繁（405）：连着新建两张时录到的 */
const CREATE_RATE_LIMITED = 'playlist-edit/create/003-playlist_create.json.gz'
const ADD = 'playlist-edit/playlist_tracks.add.json'
/** 改名称、简介、标签（验证关卡②录的）；网易云拒绝改名（400“标题字数异常，请修改”）、拒绝设标签（400“标签数据非法”） */
const RENAME = 'playlist-edit/playlist_name_update.json'
const RENAME_REJECTED = 'playlist-edit/playlist_name_update.too-long.json'
const DESCRIBE = 'playlist-edit/playlist_desc_update.json'
const DESCRIBE_RATE_LIMITED = 'playlist-edit/playlist_desc_update.405-rate-limited.constructed.json'
const RETAG = 'playlist-edit/playlist_tags_update.3-tags.json'
const RETAG_REJECTED = 'playlist-edit/playlist_tags_update.4-tags.json'
/** 自建歌单 jazz（公开、没有简介和标签）；收藏的歌单「Jazz-Hiphop｜混沌武士」（#22 录制） */
const JAZZ = { id: 900000002, name: 'jazz' }
const COLLECTED_ID = 3200013727
/** 隐私歌单改公开、删除歌单（验证关卡②录的），和网易云说操作频繁（构造的，见录制 README） */
const PUBLISH = 'playlist-edit/playlist_privacy.json'
const PUBLISH_RATE_LIMITED = 'playlist-edit/playlist_privacy.405-rate-limited.constructed.json'
const DELETE = 'playlist-edit/playlist_delete.json'
const DELETE_RATE_LIMITED = 'playlist-edit/playlist_delete.405-rate-limited.constructed.json'
const LIKED_ID = 900000001

/** 网易云建好新歌单、读回它的详情 */
async function replyCreated(): Promise<void> {
  await world.netease.reply(CREATED.create)
  await world.netease.reply(CREATED.detail, {
    when: { id: CREATED.id },
  })
}

const playlistIds = (app: App) => app.state.library?.playlists?.map(playlist => playlist.id)
const playlistOf = (app: App, playlistId: number) => app.state.library?.playlists?.find(playlist => playlist.id === playlistId)

/** 本机副本里存着的这张歌单 */
async function storedPlaylist(device: Device, playlistId: number): Promise<unknown> {
  return (await storedLibrary(device, 'playlists') as { id: number }[]).find(playlist => playlist.id === playlistId)
}

describe('标签库', () => {
  it('编辑歌单信息时实时取网易云的标签库，按语种、风格、场景、情感、主题分组；这次登录取到过就不再取', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(TAGS)
    const opening = app.openPlaylistTags()
    expect(app.state.library?.playlistTags).toEqual({ status: 'loading' })
    await opening

    expect(device.requests.at(-1)).toEqual({ method: 'GET', path: '/api/playlist-tags' })
    expect(app.state.library?.playlistTags).toEqual({
      status: 'shown',
      content: [
        {
          name: '语种',
          tags: ['华语', '欧美', '日语', '韩语', '粤语'],
        },
        {
          name: '风格',
          tags: ['流行', '摇滚', '民谣', '电子', '舞曲', '说唱'],
        },
        {
          name: '场景',
          tags: [
            '清晨',
            '夜晚',
            '学习',
            '工作',
            '午休',
            '下午茶',
            '地铁',
          ],
        },
        {
          name: '情感',
          tags: ['怀旧', '清新', '浪漫', '伤感', '治愈'],
        },
        {
          name: '主题',
          tags: [
            '综艺',
            '影视原声',
            'ACG',
            '儿童',
            '校园',
            '游戏',
            '70后',
          ],
        },
      ],
    })

    const sent = device.requests.length
    await app.openPlaylistTags()
    expect(device.requests.length).toBe(sent)
  })

  it('没取到（断网）时说明原因，再打开一次就是重试', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    device.setOnline(false)
    await app.openPlaylistTags()
    expect(app.state.library?.playlistTags).toEqual({
      status: 'failed',
      failure: { kind: 'offline' },
    })

    device.setOnline(true)
    await world.netease.reply(TAGS)
    await app.openPlaylistTags()
    expect(app.state.library?.playlistTags).toMatchObject({
      status: 'shown',
      content: { length: 5 },
    })
  })
})

describe('新建歌单', () => {
  it('新建隐私歌单：等网易云建好才进曲库，排在我喜欢的音乐后面，是空的；存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = playlistIds(app)!

    const creating = held()
    await world.netease.reply(CREATED.create, { until: creating.until })
    await world.netease.reply(CREATED.detail, {
      when: { id: CREATED.id },
    })
    const outcome = app.createPlaylist({ name: CREATED.name, private: true })
    await world.settle()
    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/playlists',
      body: { name: CREATED.name, private: true },
    })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_create',
      query: { name: CREATED.name, privacy: '10' },
    })
    expect(playlistIds(app)).toEqual(before)

    creating.release()
    expect(await outcome).toEqual({ ok: true, playlistId: CREATED.id })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_detail',
      query: { id: CREATED.id },
    })
    expect(playlistIds(app)).toEqual([
      LIKED_ID,
      CREATED.id,
      ...before.slice(1),
    ])
    expect(app.state.library?.playlists?.[1]).toMatchObject({
      name: CREATED.name,
      kind: 'own',
      private: true,
      creator: '测试听众',
      trackCount: 0,
    })
    expect(app.state.library?.songsOf(CREATED.id)).toMatchObject({ songs: [], total: 0, complete: true })
    expect(await storedPlaylistIds(device)).toEqual([
      LIKED_ID,
      CREATED.id,
      ...before.slice(1),
    ])
    expect(await storedTrackIds(device, CREATED.id)).toEqual([])

    // 曲目已经是全的（空的），打开它不用再拉
    const sent = device.requests.length
    await app.openPlaylist(CREATED.id)
    expect(device.requests.length).toBe(sent)
  })

  it('从加入歌单里新建：建好接着把这首加进去，提示已加入', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const [song] = await dailySongs(app)

    await replyCreated()
    await world.netease.reply(ADD)
    expect(await app.createPlaylist({ name: CREATED.name, private: true }, [song])).toEqual({ ok: true, playlistId: CREATED.id })
    expect(app.state.library?.songsOf(CREATED.id)).toMatchObject({
      songs: [song],
      total: 1,
    })
    await world.settle()

    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: `/api/playlists/${CREATED.id}/tracks`,
      body: {
        songIds: [song.id],
      },
    })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'added',
      change: {
        kind: 'addMany',
        playlist: { id: CREATED.id },
        songs: [song],
      },
    })
    expect(await storedTrackIds(device, CREATED.id)).toEqual([song.id])
  })

  it('网易云说操作频繁：没建成，不进曲库，说明原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = playlistIds(app)

    await world.netease.reply(CREATE_RATE_LIMITED)
    expect(await app.createPlaylist({ name: CREATED.name, private: true })).toEqual({
      ok: false,
      failure: { kind: 'rateLimited', retryAfter: 30 },
    })

    expect(playlistIds(app)).toEqual(before)
    expect(await storedPlaylistIds(device)).toEqual(before)
    expect(world.netease.calls.filter(call => call.module === 'playlist_detail' && (call.query as { id: number }).id === CREATED.id)).toEqual([])
  })

  it('名称是空的、超过 40 个宽度（汉字算 2）：不提交，说明原因；20 个汉字、40 个字母正好可以', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    expect(await app.createPlaylist({ name: '  ', private: false })).toEqual({
      ok: false,
      failure: { kind: 'invalid', problem: 'nameEmpty' },
    })
    expect(await app.createPlaylist({
      name: '夜'.repeat(21),
      private: false,
    })).toEqual({
      ok: false,
      failure: { kind: 'invalid', problem: 'nameTooLong' },
    })
    expect(await app.createPlaylist({ name: `${'a'.repeat(39)}夜`, private: false })).toEqual({
      ok: false,
      failure: { kind: 'invalid', problem: 'nameTooLong' },
    })
    expect(device.requests.length).toBe(sent)

    await replyCreated()
    await app.createPlaylist({ name: ` ${'夜'.repeat(20)} `, private: false })
    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/playlists',
      body: {
        name: '夜'.repeat(20),
        private: false,
      },
    })
    expect(world.netease.calls.find(call => call.module === 'playlist_create')).toMatchObject({
      query: {
        name: '夜'.repeat(20),
        privacy: '0',
      },
    })
    await replyCreated()
    await app.createPlaylist({
      name: 'a'.repeat(40),
      private: false,
    })
    expect(device.requests.at(-1)).toMatchObject({
      path: '/api/playlists',
      body: {
        name: 'a'.repeat(40),
      },
    })
  })

  it('断网时新建：不发请求，直接说没建成（规则⑨）', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    device.setOnline(false)
    expect(await app.createPlaylist({ name: CREATED.name, private: true })).toEqual({
      ok: false,
      failure: { kind: 'offline' },
    })
    expect(device.requests.length).toBe(sent)
  })

  it('建好之前发出的同步拿回来的歌单列表里还没有它：叠回去，不从曲库里消失', async () => {
    const device = world.device()
    await signInAtLikedTracks(device)
    // 同一台设备再开一个标签页：后台同步的歌单列表压着
    await world.netease.reply('login/user_account.vip.json')
    const list = held()
    await replyLibrary({
      holds: {
        playlists: { until: list.until },
        likedTracks: {
          until: never(),
          when: { id: LIKED_ID },
        },
      },
    })
    const { app } = await device.open()
    await world.settle()

    await replyCreated()
    await app.createPlaylist({ name: CREATED.name, private: true })
    list.release()
    await world.settle()

    expect(world.netease.calls.filter(call => call.module === 'user_playlist')).toHaveLength(2)
    expect(playlistIds(app)?.[1]).toBe(CREATED.id)
    expect((await storedPlaylistIds(device))[1]).toBe(CREATED.id)
    expect(await storedTrackIds(device, CREATED.id)).toEqual([])
  })
})

describe('改名称、简介、标签', () => {
  it('马上显示新的，各提交各的，网易云说好了才存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    const reply = held()
    await world.netease.reply(RENAME, { until: reply.until })
    await world.netease.reply(DESCRIBE, { until: reply.until })
    await world.netease.reply(RETAG, { until: reply.until })
    const editing = app.editPlaylist(JAZZ.id, {
      name: ' 爵士 ',
      description: '周末下午听。\n',
      tags: ['华语', '流行', '夜晚'],
    })
    expect(playlistOf(app, JAZZ.id)).toMatchObject({
      name: '爵士',
      description: '周末下午听。',
      tags: ['华语', '流行', '夜晚'],
    })
    await world.settle()
    expect(device.requests.slice(-3)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ.id}/name`,
        body: { name: '爵士' },
      },
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ.id}/description`,
        body: { description: '周末下午听。' },
      },
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ.id}/tags`,
        body: {
          tags: ['华语', '流行', '夜晚'],
        },
      },
    ])
    // 三个请求一起发，到服务端的先后不固定
    const call = (module: string) => world.netease.calls.find(each => each.module === module)?.query
    expect(call('playlist_name_update')).toEqual({ id: JAZZ.id, name: '爵士' })
    expect(call('playlist_desc_update')).toEqual({ id: JAZZ.id, desc: '周末下午听。' })
    expect(call('playlist_tags_update')).toEqual({ id: JAZZ.id, tags: '华语;流行;夜晚' })
    expect(await storedPlaylist(device, JAZZ.id)).toMatchObject({ name: JAZZ.name, description: null, tags: [] })

    reply.release()
    await editing
    expect(playlistOf(app, JAZZ.id)).toMatchObject({
      name: '爵士',
      description: '周末下午听。',
      tags: ['华语', '流行', '夜晚'],
    })
    expect(await storedPlaylist(device, JAZZ.id)).toMatchObject({
      name: '爵士',
      description: '周末下午听。',
      tags: ['华语', '流行', '夜晚'],
    })
    expect(app.state.library?.notice).toBeNull()
  })

  it('只提交改了的：名称、简介、标签都和原来一样时什么都不发；清空简介、去掉全部标签也算改', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    await app.editPlaylist(JAZZ.id, { name: JAZZ.name, description: '  ', tags: [] })
    expect(device.requests.length).toBe(sent)

    await world.netease.reply(RETAG)
    await app.editPlaylist(JAZZ.id, {
      tags: ['华语'],
    })
    await world.netease.reply(DESCRIBE)
    await world.netease.reply(RETAG)
    await app.editPlaylist(JAZZ.id, { name: JAZZ.name, description: '周末下午听。', tags: [] })
    expect(device.requests.slice(-2)).toEqual([
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ.id}/description`,
        body: { description: '周末下午听。' },
      },
      {
        method: 'POST',
        path: `/api/playlists/${JAZZ.id}/tags`,
        body: { tags: [] },
      },
    ])
    expect(playlistOf(app, JAZZ.id)).toMatchObject({ description: '周末下午听。', tags: [] })

    await world.netease.reply(DESCRIBE)
    await app.editPlaylist(JAZZ.id, { description: '' })
    expect(device.requests.at(-1)).toEqual({
      method: 'POST',
      path: `/api/playlists/${JAZZ.id}/description`,
      body: { description: '' },
    })
    expect(playlistOf(app, JAZZ.id)?.description).toBeNull()
  })

  it('网易云拒绝改名：改回原来的名字，说明网易云给的原因；同时改的标签照样改好', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(RENAME_REJECTED)
    await world.netease.reply(RETAG)
    await app.editPlaylist(JAZZ.id, {
      name: 'jazz · 周末',
      tags: ['华语'],
    })

    expect(playlistOf(app, JAZZ.id)).toMatchObject({
      name: JAZZ.name,
      tags: ['华语'],
    })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: {
        kind: 'rename',
        playlist: { id: JAZZ.id },
        name: 'jazz · 周末',
      },
      failure: { kind: 'rejected', code: 400, message: '标题字数异常，请修改' },
    })
    expect(await storedPlaylist(device, JAZZ.id)).toMatchObject({
      name: JAZZ.name,
      tags: ['华语'],
    })
  })

  it('网易云说改简介操作频繁：改回原来的简介，提示稍后再试', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(DESCRIBE_RATE_LIMITED)
    await app.editPlaylist(JAZZ.id, { description: '周末下午听。' })

    expect(playlistOf(app, JAZZ.id)?.description).toBeNull()
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'describe' },
      failure: { kind: 'rateLimited' },
    })
    expect(await storedPlaylist(device, JAZZ.id)).toMatchObject({ description: null })
  })

  it('网易云拒绝设标签（标签数据非法）：改回原来的标签，说明原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)

    await world.netease.reply(RETAG_REJECTED)
    await app.editPlaylist(JAZZ.id, {
      tags: ['华语', '流行', '夜晚'],
    })

    expect(playlistOf(app, JAZZ.id)?.tags).toEqual([])
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'tag' },
      failure: { kind: 'rejected', code: 400, message: '标签数据非法' },
    })
  })

  it('标签超过 3 个、名称太长、简介超过 1000 个字：整次都不提交，说明原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    await app.editPlaylist(JAZZ.id, {
      name: '爵士',
      tags: ['华语', '流行', '夜晚', '怀旧'],
    })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'tag' },
      failure: { kind: 'invalid', problem: 'tooManyTags' },
    })
    await app.editPlaylist(JAZZ.id, {
      name: '夜'.repeat(21),
    })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'rename' },
      failure: { kind: 'invalid', problem: 'nameTooLong' },
    })
    await app.editPlaylist(JAZZ.id, { name: '' })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'rename' },
      failure: { kind: 'invalid', problem: 'nameEmpty' },
    })
    await app.editPlaylist(JAZZ.id, {
      description: '夜'.repeat(1001),
    })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'describe' },
      failure: { kind: 'invalid', problem: 'descriptionTooLong' },
    })

    expect(device.requests.length).toBe(sent)
    expect(playlistOf(app, JAZZ.id)).toMatchObject({ name: JAZZ.name, description: null, tags: [] })
  })

  it('断网时改：整次都不改，直接说没改成（规则⑨），不发请求；同时改的几样只说一次', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    device.setOnline(false)
    await app.editPlaylist(JAZZ.id, {
      name: '爵士',
      tags: ['华语'],
    })

    expect(playlistOf(app, JAZZ.id)).toMatchObject({ name: JAZZ.name, tags: [] })
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: { kind: 'rename' },
      failure: { kind: 'offline' },
    })
    expect(device.requests.length).toBe(sent)
  })

  it('我喜欢的音乐不能改名、收藏的歌单不能编辑：不提交，名字照旧', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const sent = device.requests.length

    await expect(app.editPlaylist(LIKED_ID, { name: '我的最爱' })).rejects.toThrow()
    await expect(app.editPlaylist(COLLECTED_ID, {
      tags: ['华语'],
    })).rejects.toThrow()

    expect(device.requests.length).toBe(sent)
    expect(playlistOf(app, LIKED_ID)?.name).toBe('测试听众喜欢的音乐')
  })
})

/** 新建一张隐私歌单（拿来改公开） */
async function createPrivate(app: App): Promise<void> {
  await replyCreated()
  await app.createPlaylist({ name: CREATED.name, private: true })
}

describe('隐私歌单改公开', () => {
  it('马上显示成公开，提交给网易云，网易云说好了才存进本机副本', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await createPrivate(app)

    const reply = held()
    await world.netease.reply(PUBLISH, { until: reply.until })
    const publishing = app.publishPlaylist(CREATED.id)
    expect(playlistOf(app, CREATED.id)?.private).toBe(false)
    await world.settle()
    expect(device.requests.at(-1)).toEqual({ method: 'POST', path: `/api/playlists/${CREATED.id}/public`, body: {} })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_privacy',
      query: { id: CREATED.id },
    })
    expect(await storedPlaylist(device, CREATED.id)).toMatchObject({ private: true })

    reply.release()
    await publishing
    expect(playlistOf(app, CREATED.id)?.private).toBe(false)
    expect(await storedPlaylist(device, CREATED.id)).toMatchObject({ private: false })

    // 已经是公开的：什么都不发
    const sent = device.requests.length
    await app.publishPlaylist(CREATED.id)
    expect(device.requests.length).toBe(sent)
  })

  it('网易云说操作频繁：改回隐私，说明原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await createPrivate(app)

    await world.netease.reply(PUBLISH_RATE_LIMITED)
    await app.publishPlaylist(CREATED.id)

    expect(playlistOf(app, CREATED.id)?.private).toBe(true)
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: {
        kind: 'publish',
        playlist: { id: CREATED.id },
      },
      failure: { kind: 'rateLimited' },
    })
    expect(await storedPlaylist(device, CREATED.id)).toMatchObject({ private: true })
  })
})

describe('删除歌单', () => {
  it('删除自建歌单：马上从曲库里拿掉，提交给网易云，网易云说好了连同曲目从本机副本里删掉', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: true })
    expect(await storedTrackIds(device, JAZZ.id)).toHaveLength(2)

    const reply = held()
    await world.netease.reply(DELETE, { until: reply.until })
    const deleting = app.deletePlaylist(JAZZ.id)
    expect(playlistIds(app)).not.toContain(JAZZ.id)
    expect(app.state.library?.songsOf(JAZZ.id)).toBeNull()
    await world.settle()
    expect(device.requests.at(-1)).toEqual({ method: 'POST', path: `/api/playlists/${JAZZ.id}/delete`, body: {} })
    expect(world.netease.calls.at(-1)).toMatchObject({
      module: 'playlist_delete',
      query: { id: JAZZ.id },
    })
    expect(await storedPlaylistIds(device)).toContain(JAZZ.id)

    reply.release()
    await deleting
    expect(playlistIds(app)).not.toContain(JAZZ.id)
    expect(await storedPlaylistIds(device)).not.toContain(JAZZ.id)
    expect(await storedTrackIds(device, JAZZ.id)).toBeUndefined()
    expect(app.state.library?.notice).toBeNull()
  })

  it('网易云说操作频繁：放回原处，曲目照旧，说明原因', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    await openJazz(app, { songsHeld: true })
    const before = playlistIds(app)

    await world.netease.reply(DELETE_RATE_LIMITED)
    await app.deletePlaylist(JAZZ.id)

    expect(playlistIds(app)).toEqual(before)
    expect(app.state.library?.songsOf(JAZZ.id)?.total).toBe(2)
    expect(app.state.library?.notice).toMatchObject({
      kind: 'notChanged',
      change: {
        kind: 'delete',
        playlist: { id: JAZZ.id },
      },
      failure: { kind: 'rateLimited' },
    })
    expect(await storedTrackIds(device, JAZZ.id)).toHaveLength(2)
  })

  it('我喜欢的音乐不能删、不能改公开；收藏的歌单不是删除（取消收藏另有 collect）：不提交，曲库照旧', async () => {
    const device = world.device()
    const { app } = await signInAtLikedTracks(device)
    const before = playlistIds(app)
    const sent = device.requests.length

    await expect(app.deletePlaylist(LIKED_ID)).rejects.toThrow()
    await expect(app.publishPlaylist(LIKED_ID)).rejects.toThrow()
    await expect(app.deletePlaylist(COLLECTED_ID)).rejects.toThrow()

    expect(device.requests.length).toBe(sent)
    expect(playlistIds(app)).toEqual(before)
  })
})
