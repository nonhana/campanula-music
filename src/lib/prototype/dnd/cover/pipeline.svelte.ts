// PROTOTYPE：换封面的三步上传（全部是假的，见 api.svelte.ts）。
//   1. 服务器申请上传凭证（nos_token_alloc，ext 写死 jpg）
//   2. 浏览器把 JPEG 直传网易云图片存储（nosup-hz1.127.net），有进度
//   3. 服务器把上传好的图片设为封面（playlist_cover_update）
// 取消只在第 1、2 步有效：第 3 步的请求已经发给服务器，取消不了（原型里按钮会变成“正在设为封面”）。
// 第 3 步失败时重试只重做第 3 步：图片已经传上去了（decisions.md §5：playlist_cover_update 要支持直接传已上传图片的编号）。
import { netease } from '../api.svelte'

export type StepKey = 'alloc' | 'upload' | 'set'
export type JobState = StepKey | 'idle' | 'done' | 'failed' | 'aborted'

export const stepLabels: Record<StepKey, string> = {
  alloc: '申请上传凭证',
  upload: '上传图片',
  set: '设为封面',
}

export class UploadJob {
  state = $state<JobState>('idle')
  /** 总进度 0–1 */
  progress = $state(0)
  failedStep = $state<StepKey | null>(null)
  error = $state('')
  readonly blob: Blob
  readonly plId: string
  #uploaded = false
  #ac: AbortController | null = null

  constructor(plId: string, blob: Blob) {
    this.plId = plId
    this.blob = blob
  }

  get cancelable(): boolean {
    return this.state === 'alloc' || this.state === 'upload'
  }

  get busy(): boolean {
    return this.state === 'alloc' || this.state === 'upload' || this.state === 'set'
  }

  /** 跑完三步；成功返回 true。失败、取消返回 false，原因在 state / error 里 */
  async run(): Promise<boolean> {
    const ac = new AbortController()
    this.#ac = ac
    this.error = ''
    this.failedStep = null
    let step: StepKey = 'alloc'
    try {
      if (!this.#uploaded) {
        step = 'alloc'
        this.state = 'alloc'
        this.progress = 0.03
        await netease.nosTokenAlloc(ac.signal)
        step = 'upload'
        this.state = 'upload'
        this.progress = 0.1
        await netease.nosUpload(this.blob.size, (r) => {
          this.progress = 0.1 + r * 0.8
        }, ac.signal)
        this.#uploaded = true
      }
      step = 'set'
      this.state = 'set'
      this.progress = 0.92
      await netease.playlistCoverUpdate(this.plId)
      this.progress = 1
      this.state = 'done'
      return true
    }
    catch (e) {
      if ((e as Error).name === 'AbortError') {
        this.state = 'aborted'
        this.progress = 0
        return false
      }
      this.failedStep = step
      this.error = (e as Error).message
      this.state = 'failed'
      return false
    }
    finally {
      this.#ac = null
    }
  }

  cancel() {
    if (this.cancelable)
      this.#ac?.abort()
  }
}

export function failText(job: UploadJob): string {
  switch (job.failedStep) {
    case 'alloc': return '没能连上网易云，封面还没开始上传。'
    case 'upload': return '图片传到一半断了，封面没有改。'
    case 'set': return '图片已经传上去了，但没能设为封面。重试只需要再设一次，不用重新上传。'
    default: return '封面没有改。'
  }
}
