import { tick, untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'

import type { Song } from '#lib/api/library.js'

import type { AppView } from '../shared/app-context.svelte'
import { fadeMs, flightArc, reducedMotion, unseen } from '../shared/motion'
import { cssEasing, DURATIONS } from '../shared/motion-tokens'
import { coverLoaded, preloadCover } from '../ui/Cover.svelte'
import { currentSong } from './now'
import type { Turn } from './view'
import { turnOf } from './view'

// 点歌时那一行的封面飞进播放条（DESIGN.md Song Row · 点歌，The Cover Leads Rule）：pick 起飞、landingOf 接住，飞时播放条仍显示起飞前那首，
// 落下才换。飞的是盖在最上面的一张图，Web Animations 走完、每帧不读排版；同一时刻只有一张，连着快点时前面那张直接拿掉。
// 点歌不换页、播放条也不在内容区里，所以不走 View Transitions（ADR-0011）。

/** 飞进来的是哪首，播放条起飞前显示的是哪首（第一次点歌时播放条还没有歌，是 null） */
interface Flight {
  song: Song
  from: Song | null
}

let flight = $state.raw<Flight | null>(null)
/** 播放条换上它时不转、不淡，歌名往上飘；当前这首变成别的就清掉 */
let landed = $state<number | null>(null)
/** 等着的那一步回来时，已经不归它管了 */
let launches = 0
let plane: { element: HTMLElement, animation: Animation } | null = null
/** 播放条上的封面小窗（落点）和它的 Cover size */
let landingSlot: { element: HTMLElement, size: number } | null = null

/** 飞的图盖在播放条（40）上面，播放的提示、播放页（50）下面 */
const PLANE_LAYER = '45'

/** play 放这一首；换了歌、这一行的封面 cover 就飞进播放条。点的就是正在放的那首、没给 cover（播放页队列里点的，那里换碟）时不飞 */
export const pick = (view: AppView, play: () => void, cover: HTMLElement | undefined): void => {
  const before = currentSong(view.state.player)
  play()
  const after = currentSong(view.state.player)
  if (cover && after && after.id !== before?.id)
    void takeOff(after, flight ? flight.from : before, cover)
}

/** 从这一行加载好的封面飞到小窗；减少动态效果、页面在后台、封面还没加载出来、网易云没给封面时不飞，播放条照常换歌（view.ts 的 turnOf，往左转） */
const takeOff = async (song: Song, from: Song | null, cover: HTMLElement): Promise<void> => {
  const mine = ++launches
  ground()
  const img = [
...cover.querySelectorAll('img'),
].findLast(each => each.complete && each.naturalWidth > 0)
  const url = song.album.coverUrl
  if (!img || url === null || reducedMotion() || unseen()) {
    flight = null
    return
  }
  const start = img.getBoundingClientRect()
  const radius = getComputedStyle(img.parentElement!).borderRadius
  flight = { song, from }
  // 第一次点歌时，播放条这时才挂上
  await tick()
  if (mine !== launches)
    return
  if (!landingSlot) {
    flight = null
    return
  }
  const { size } = landingSlot
  const end = restingRect(landingSlot.element)
  const ready = preloadCover(url, size)
  const element = document.createElement('img')
  element.src = img.currentSrc
  element.alt = ''
  Object.assign(element.style, {
    position: 'fixed',
    left: `${end.x}px`,
    top: `${end.y}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
    objectFit: 'cover',
    borderRadius: radius,
    transformOrigin: '0 0',
    zIndex: PLANE_LAYER,
    pointerEvents: 'none',
  })
  document.body.append(element)
  const animation = element.animate(flightArc(start, end), {
duration: DURATIONS['focal-bar'],
easing: cssEasing('out-soft'),
fill: 'forwards',
})
  plane = { element, animation }
  // 被拿掉时（又点了一首、换了歌）finished 会失败
  if (!await animation.finished.then(() => true, () => false) || mine !== launches)
    return
  // 小窗的图已经加载、解码好时直接显示；还没好的，飞的这张停在小窗上盖着，
  // 等它加载完、从薄荷底淡入完再拿掉，中间不露出空的小窗（The Cover Leads Rule）
  const cached = coverLoaded(url, size)
  landed = song.id
  flight = null
  await tick()
  if (!cached) {
    await ready
    await new Promise(done => setTimeout(done, fadeMs(DURATIONS.reveal)))
  }
  // 再过一帧才拿掉：小窗那张已经画出来了
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (plane?.element === element)
      ground()
  }))
}

/** 在飞的，或者落下后还盖在小窗上等图的 */
const ground = (): void => {
  if (!plane)
    return
  plane.animation.cancel()
  plane.element.remove()
  plane = null
}

const abort = (): void => {
  launches += 1
  ground()
  flight = null
}

/** 落点停稳时在哪：播放条正从底下浮上来（motion.ts 的 dock，漂动写在 translate 上）时，减掉它此刻还差的那一段 */
const restingRect = (slot: HTMLElement): DOMRect => {
  const rect = slot.getBoundingClientRect()
  const lift = Number.parseFloat(getComputedStyle(slot.closest('[data-player-bar]')!).translate.split(' ')[1] ?? '0')
  return new DOMRect(rect.x, rect.y - lift, rect.width, rect.height)
}

export interface Landing {
  /** 封面还在飞时仍是起飞前那首（第一次点歌时是 null，小窗空着等它落下） */
  readonly song: Song | null
  /** 刚落下的是 land，其余按换歌原因（turnOf） */
  readonly turn: Turn | null
  slot: Attachment<HTMLElement>
}

/** NowPlaying 初始化时调用；size 是渲染期 getter（两个播放条共用、尺寸由调用方给）。飞着或还盖在小窗上时当前这首又变了（下一首、放完、清空队列）：飞的那张直接拿掉，换碟接手 */
export const landingOf = (view: AppView, size: () => number): Landing => {
  const current = $derived(currentSong(view.state.player))

  $effect(() => {
    const id = current?.id
    untrack(() => {
      if (flight && flight.song.id !== id)
        abort()
      if (landed !== null && landed !== id) {
        landed = null
        // 还盖在小窗上等图的那张（又起飞了一张的话，正在飞的归那一次管）
        if (!flight)
          ground()
      }
    })
  })

  return {
    get song() {
      return flight ? flight.from : current
    },
    get turn() {
      return landed !== null && landed === current?.id
? 'land'
: turnOf(view.state.player.change)
    },
    slot(element) {
      landingSlot = {
element,
size: size(),
}
      return () => {
        if (landingSlot?.element === element)
          landingSlot = null
      }
    },
  }
}
