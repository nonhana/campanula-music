import type { CoverCrop, CoverTokenResponse, SetCoverRequest, SetCoverResponse } from '#lib/api/cover.js'
import type { Api, RequestFailure } from './api'
import type { DecodedImage, ImageCapability } from './browser'
import { COVER_INPUT_MAX_BYTES, COVER_SMALL_SIDE } from '#lib/api/cover.js'

// 换歌单封面（#34，Spec #11 用户故事 90–92）：选图、检查、裁剪，然后三步上传：
// 1. 服务端申请上传凭证（image_upload_token）；
// 2. 浏览器把裁好的 800×800 JPEG 直传网易云的图片存储（跨域，带凭证）；
// 3. 服务端用图片编号设为封面（playlist_cover_update）。
// 前两步可以取消，取消后回到裁剪；第三步已经发出，不能取消（界面把按钮换成“正在设为封面”）。
// 第三步失败后重试只再设一次，不重新上传；第一、二步失败重试从没成的那一步重来。
// 设为封面不检查图片（验证关卡②）：没直传成功也回 200，封面会坏，所以第三步只在第二步成功之后发。

/** 选到的文件为什么不能用（界面只说是哪一种，不写文件名、大小） */
export type CoverProblem
  /** 不是图片（解码失败，文件类型也不是图片） */
  = | { kind: 'notImage' }
  /** 超过 20 MB，不读 */
    | { kind: 'tooBig' }
  /** HEIC：桌面和 Android 上的 Chrome 都解不开（验证关卡③） */
    | { kind: 'heic' }
  /** 看着是图片，但解不开（损坏的文件） */
    | { kind: 'unreadable' }

/** 三步上传走到哪一步 */
export type CoverStep = 'token' | 'upload' | 'set'

/** 上传没成功的原因；请求本身的问题和改曲库一样翻译 */
export type CoverFailure
  = | Exclude<RequestFailure, { kind: 'needsLogin' }>
    /** 浏览器直传网易云的图片存储没成（跨域、断网、图片存储出错） */
    | { kind: 'uploadFailed' }
    /** 导不出 JPEG（canvas 出错）：还没开始上传 */
    | { kind: 'exportFailed' }

export interface CoverUpload {
  /** 正在做、或者失败的那一步；导出 JPEG 就在上传之前失败了的话，还没开始任何一步，是 null */
  step: CoverStep | null
  /** 已经直传成功的图片编号：第三步失败后重试只再设一次 */
  imgId: string | null
  /** 失败了；还在做是 null */
  failure: CoverFailure | null
}

/** 裁好的正方形：工作位图上的位置，单位和那张位图的像素一样 */
interface CoverCropped {
  playlistId: number
  image: DecodedImage
  small: boolean
}

/** 换封面走到哪了；关掉时是 null */
export type CoverState
  /** 正在读图、解码（超大图要一会儿） */
  = | { status: 'picking', playlistId: number }
  /** 文件不能用：说明为什么，给“换一张图片” */
    | { status: 'unusable', playlistId: number, problem: CoverProblem }
    | ({ status: 'cropping' } & CoverCropped)
    | ({ status: 'uploading' } & CoverCropped & { upload: CoverUpload & { failure: null } })
    | ({ status: 'failed' } & CoverCropped & { upload: CoverUpload & { failure: CoverFailure } })
  /** 成功：封面已经是这个地址（用设封面返回的 data.url，刚设完读详情有时还是旧的） */
    | { status: 'done', playlistId: number, coverUrl: string }

/** 一次上传的结果；取消时是 null */
export type CoverOutcome
  = | { ok: true, coverUrl: string }
    | { ok: false, step: CoverStep | null, failure: CoverFailure }

export interface CoverContext {
  api: Api
  images: ImageCapability
  upload: (url: string, jpeg: Blob, token: string, signal: AbortSignal) => Promise<void>
  write: (state: CoverState | null) => void
  /** 网易云说需要登录（续期也没成功）：整个 App 变成登录失效 */
  loginExpired: () => void
  /** 换好了：把新封面地址写进曲库副本，立即显示 */
  changed: (playlistId: number, coverUrl: string) => Promise<void>
}

export interface Cover {
  /** 听众选好一张图：检查大小，读出来；能用就进裁剪，不能用说明原因 */
  prepare: (playlistId: number, file: File) => Promise<void>
  /** 按取景框裁成 800×800 JPEG，三步上传。取消时回来 null */
  upload: (crop: CoverCrop) => Promise<CoverOutcome | null>
  /** 取消前两步（申请凭证、直传）：回到裁剪 */
  cancel: () => void
  /** 失败后重试：第三步失败只再设一次；别的从没成的那一步重来 */
  retry: () => Promise<CoverOutcome | null>
  /** 关掉裁剪页（正在设为封面时关不掉）；释放图片 */
  close: () => void
  /** 退出、登录失效：不管在做什么都收起来，释放图片 */
  leave: () => void
}

/** 会话里的上传：一份，同时只做一次 */
interface Attempt {
  playlistId: number
  image: DecodedImage
  small: boolean
  crop: CoverCrop
  /** 导出的 JPEG；还没导出（或者导出失败）时是 null */
  jpeg: Blob | null
  token: CoverTokenResponse | null
  imgId: string | null
  /** 直传成功了：只有这时才能设为封面，第三步失败重试也只再设一次 */
  uploaded: boolean
  controller: AbortController
  canceled: boolean
  running: boolean
}

/** HEIC 的判断只能参考文件类型和扩展名：Android 的照片选择器给的是 HEIC 原图，文件名是媒体编号（验证关卡③） */
function looksHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.(?:heic|heif)$/i.test(file.name)
}

export function createCover(context: CoverContext): Cover {
  const { images } = context
  let state: CoverState | null = null
  let attempt: Attempt | null = null
  /** 每换一次图、关一次、换一轮会话就加一：之前发出去的结果不要 */
  let generation = 0

  function write(next: CoverState | null): void {
    state = next
    context.write(next)
  }

  function cropped(work: Attempt): CoverCropped {
    return { playlistId: work.playlistId, image: work.image, small: work.small }
  }

  function uploading(step: CoverStep | null, failure: CoverFailure | null = null): void {
    const work = attempt
    if (!work)
      return
    const next: CoverUpload = { step, imgId: work.uploaded ? work.imgId : null, failure }
    if (failure)
      write({ status: 'failed', ...cropped(work), upload: { ...next, failure } })
    else
      write({ status: 'uploading', ...cropped(work), upload: { ...next, failure: null } })
  }

  /** 这一轮已经作废（取消、换图、关掉、退出）：之前发出去的结果不要 */
  function stale(work: Attempt, mine: number): boolean {
    return work.canceled || attempt !== work || mine !== generation
  }

  function release(): void {
    if (attempt)
      images.release(attempt.image)
    attempt = null
  }

  /** 这张图不再用了（换一张、关上、退出）：还在路上的结果都不要，图片放掉 */
  function abandon(): void {
    generation += 1
    attempt?.controller.abort()
    release()
  }

  /** 记下哪一步失败；需要登录时整个 App 变成登录失效，返回 null */
  function failed(step: CoverStep | null, failure: CoverFailure | RequestFailure): CoverOutcome | null {
    if (!attempt)
      return null
    if (failure.kind === 'needsLogin') {
      abandon()
      write(null)
      context.loginExpired()
      return null
    }
    uploading(step, failure)
    return { ok: false, step, failure }
  }

  async function decode(playlistId: number, file: File): Promise<void> {
    const mine = ++generation
    write({ status: 'picking', playlistId })
    if (file.size > COVER_INPUT_MAX_BYTES) {
      if (mine === generation)
        write({ status: 'unusable', playlistId, problem: { kind: 'tooBig' } })
      return
    }
    let image: DecodedImage
    try {
      image = await images.decode(file)
    }
    catch {
      if (mine !== generation)
        return
      const problem: CoverProblem = looksHeic(file)
        ? { kind: 'heic' }
        : !file.type || !file.type.startsWith('image/')
            ? { kind: 'notImage' }
            : { kind: 'unreadable' }
      write({ status: 'unusable', playlistId, problem })
      return
    }
    if (mine !== generation) {
      images.release(image)
      return
    }
    attempt = {
      playlistId,
      image,
      small: Math.min(image.origWidth, image.origHeight) < COVER_SMALL_SIDE,
      crop: { x: 0, y: 0, size: 1 },
      jpeg: null,
      token: null,
      imgId: null,
      uploaded: false,
      controller: new AbortController(),
      canceled: false,
      running: false,
    }
    write({ status: 'cropping', ...cropped(attempt) })
  }

  /** 导出裁剪好的 JPEG；导出失败返回 false */
  async function exportJpeg(work: Attempt): Promise<boolean> {
    if (work.jpeg)
      return true
    try {
      const blob = await images.exportJpeg(work.image, work.crop)
      if (!work.canceled)
        work.jpeg = blob
      return true
    }
    catch {
      return false
    }
  }

  /** 从 from 这一步开始跑：token → upload → set。只重试没成的部分（第三步失败就只再设一次） */
  async function run(from: CoverStep): Promise<CoverOutcome | null> {
    const mine = generation
    const work = attempt
    if (!work || work.running)
      return null
    work.running = true
    work.canceled = false
    work.controller = new AbortController()
    let step = from
    try {
      if (step !== 'set') {
        if (!work.jpeg && !await exportJpeg(work)) {
          if (stale(work, mine))
            return null
          return failed(null, { kind: 'exportFailed' })
        }
        if (stale(work, mine))
          return null
      }
      if (step === 'token') {
        uploading('token')
        const result = await context.api.post<CoverTokenResponse>(`/api/playlists/${work.playlistId}/cover/token`, {})
        if (stale(work, mine))
          return null
        if (!result.ok)
          return failed('token', result.failure)
        work.token = result.value
        work.imgId = result.value.imgId
        step = 'upload'
      }
      if (step === 'upload') {
        uploading('upload')
        try {
          await context.upload(work.token!.uploadUrl, work.jpeg!, work.token!.token, work.controller.signal)
        }
        catch {
          if (stale(work, mine))
            return null
          return failed('upload', { kind: 'uploadFailed' })
        }
        if (stale(work, mine))
          return null
        work.uploaded = true
        step = 'set'
      }
      uploading('set')
      const result = await context.api.post<SetCoverResponse>(`/api/playlists/${work.playlistId}/cover`, { imgId: work.imgId! } satisfies SetCoverRequest)
      if (stale(work, mine))
        return null
      if (!result.ok)
        return failed('set', result.failure)
      await context.changed(work.playlistId, result.value.url)
      if (stale(work, mine))
        return null
      images.release(work.image)
      attempt = null
      write({ status: 'done', playlistId: work.playlistId, coverUrl: result.value.url })
      return { ok: true, coverUrl: result.value.url }
    }
    finally {
      work.running = false
    }
  }

  return {
    async prepare(playlistId, file) {
      // 正在设为封面时不能换图：那一步停不下来
      if (state?.status === 'uploading' && state.upload.step === 'set')
        return
      abandon()
      await decode(playlistId, file)
    },
    async upload(crop) {
      if (!attempt || state?.status !== 'cropping' || attempt.running)
        return null
      // 取消后回到裁剪、又挪过取景框：不能再用取消前导出的那张
      if (attempt.crop.x !== crop.x || attempt.crop.y !== crop.y || attempt.crop.size !== crop.size)
        attempt.jpeg = null
      attempt.crop = crop
      return run('token')
    },
    cancel() {
      if (!attempt || state?.status !== 'uploading')
        return
      if (state.upload.step === 'set')
        return
      const old = attempt
      old.canceled = true
      old.controller.abort()
      // 图片还留着给裁剪页用：下一次上传另建一份 attempt，旧的那次结果回来时看到 attempt 换了就不要了
      attempt = {
        ...old,
        token: null,
        imgId: null,
        controller: new AbortController(),
        canceled: false,
        running: false,
      }
      write({ status: 'cropping', ...cropped(attempt) })
    },
    async retry() {
      if (!attempt || state?.status !== 'failed')
        return null
      return run(attempt.uploaded ? 'set' : 'token')
    },
    close() {
      if (state?.status === 'uploading' && state.upload.step === 'set')
        return
      abandon()
      write(null)
    },
    leave() {
      abandon()
      write(null)
    },
  }
}
