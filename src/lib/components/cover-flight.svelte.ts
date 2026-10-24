import type { Attachment } from 'svelte/attachments'
import type { Song } from '#lib/api/library.js'
import type { AppView } from './app-context.svelte'
import type { Turn } from './player/view'
import { tick, untrack } from 'svelte'
import { fadeMs, reducedMotion, unseen } from './motion'
import { cssEasing, DURATIONS, FLIGHT_ARC } from './motion-tokens'
import { currentSong } from './now'
import { turnOf } from './player/view'
import { coverLoaded, preloadCover } from './ui/Cover.svelte'

// 点歌时那一行的封面飞进播放条（DESIGN.md Song Row · 点歌，The Cover Leads Rule）。
// 行里的点歌按钮（PlayTarget 的 pick）起飞，播放条（landingOf）接住：封面在飞时播放条仍显示起飞前那首，落下时才换上新的。
// 飞的是盖在最上面的一张图，用 Web Animations 走完，每一帧不读排版；同一时刻只有一张在飞，连着快点几首时前面那张直接拿掉。
// 点歌不换页，播放条也不在内容区里，所以不走 View Transitions（ADR-0011）

/** 一次飞行：飞进来的是哪首，播放条起飞前显示的是哪首（第一次点歌时播放条还没有歌，是 null） */
interface Flight {
  song: Song
  from: Song | null
}

let flight = $state.raw<Flight | null>(null)
/** 刚落下的那首（id）：播放条换上它时不转、不淡，歌名往上飘。当前这首变成别的就清掉 */
let landed = $state<number | null>(null)
/** 每起飞一次、不飞了就加一：等着的那一步回来时，已经不归它管了 */
let launches = 0
/** 正在飞的那张图 */
let plane: { element: HTMLElement, animation: Animation } | null = null
/** 播放条上的封面小窗（落点）和它的封面按多大取（Cover 的 size） */
let landingSlot: { element: HTMLElement, size: number } | null = null

/** 弧线取多少段 */
const STEPS = 12
/** 飞的图盖在播放条（40）上面，播放的提示、播放页（50）下面 */
const PLANE_LAYER = '45'

/**
 * 在列表里点歌（PlayTarget）：play 放这一首；换了歌，这一行的封面 cover 就飞进播放条。
 * 点的就是正在放的那首（没换歌）、没给 cover（播放页的播放队列里点的，那里换碟）时不飞
 */
export function pick(view: AppView, play: () => void, cover: HTMLElement | undefined): void {
  const before = currentSong(view.state.player)
  play()
  const after = currentSong(view.state.player)
  if (cover && after && after.id !== before?.id)
    void takeOff(after, flight ? flight.from : before, cover)
}

/**
 * 起飞：从这一行加载好的那张封面飞到播放条的小窗。减少动态效果、页面在后台、这一行的封面还没加载出来时不飞，
 * 播放条照常换歌（view.ts 的 turnOf，往左转）
 */
async function takeOff(song: Song, from: Song | null, cover: HTMLElement): Promise<void> {
  const mine = ++launches
  ground()
  const img = [...cover.querySelectorAll('img')].findLast(each => each.complete && each.naturalWidth > 0)
  if (!img || reducedMotion() || unseen()) {
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
  const url = song.album.coverUrl
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
  const animation = element.animate(arc(start, end), { duration: DURATIONS['focal-bar'], easing: cssEasing('out-soft'), fill: 'forwards' })
  plane = { element, animation }
  // 被拿掉时（又点了一首、换了歌）finished 会失败
  if (!await animation.finished.then(() => true, () => false) || mine !== launches)
    return
  // 落下：播放条换上这首，歌名往上飘。小窗的图已经加载、解码好时直接显示；还没好的，飞的这张停在小窗上盖着，
  // 等那张图加载完、从薄荷底上淡入完再拿掉，中间不露出空的小窗（The Cover Leads Rule）
  const cached = coverLoaded(url, size)
  landed = song.id
  flight = null
  await tick()
  if (!cached) {
    await ready
    await new Promise(done => setTimeout(done, fadeMs(DURATIONS.reveal)))
  }
  // 再过一帧才拿掉飞的这张：小窗那张已经画出来了
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (plane?.element === element)
      ground()
  }))
}

/** 拿掉飞的那张：在飞的，或者落下后还盖在小窗上等图的 */
function ground(): void {
  if (!plane)
    return
  plane.animation.cancel()
  plane.element.remove()
  plane = null
}

/** 不飞了：播放条直接显示当前这首 */
function abort(): void {
  launches += 1
  ground()
  flight = null
}

/** 落点停稳时在哪：播放条正从屏幕底下浮上来（motion.ts 的 dock，漂动写在 translate 上）时，减掉它此刻还差的那一段 */
function restingRect(slot: HTMLElement): DOMRect {
  const rect = slot.getBoundingClientRect()
  const lift = Number.parseFloat(getComputedStyle(slot.closest('[data-player-bar]')!).translate.split(' ')[1] ?? '0')
  return new DOMRect(rect.x, rect.y - lift, rect.width, rect.height)
}

/**
 * 从 from 沿一道往上鼓的浅弧线飞到 to（二次贝塞尔曲线，分 STEPS 段），边飞边从 from 的大小变成 to 的大小。
 * 飞的图摆在 to 上，缩放的原点在左上角
 */
function arc(from: DOMRect, to: DOMRect): Keyframe[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  // 控制点在连线正中往外推，推向和连线垂直、朝上的那一边（竖直往下飞时往右）
  const bend = FLIGHT_ARC * length * (dx < 0 ? -1 : 1)
  const cx = from.x + dx / 2 + (dy / length) * bend
  const cy = from.y + dy / 2 - (dx / length) * bend
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y
    const scale = (from.width + (to.width - from.width) * t) / to.width
    return { transform: `translate(${x - to.x}px, ${y - to.y}px) scale(${scale})` }
  })
}

export interface Landing {
  /** 封面小窗和歌名显示哪首：封面还在飞时仍是起飞前那首（第一次点歌时是 null，小窗空着等它落下） */
  readonly song: Song | null
  /** 这首是怎么换上来的：刚落下的是 land，其余按换歌原因（turnOf） */
  readonly turn: Turn | null
  /** 挂在封面小窗上：飞的封面落在这里 */
  slot: Attachment<HTMLElement>
}

/**
 * 播放条上的正在播放区（NowPlaying）接住飞来的封面，要在组件初始化时调用。size：封面小窗的封面按多大取（Cover 的 size），
 * 是个 getter：两个播放条共用这个组件，尺寸由调用方给。
 * 封面还在飞、或者落下后还盖在小窗上时，当前这首又变了（按了下一首、放完了、播放队列清空了）：飞的这张直接拿掉，换碟接手
 */
export function landingOf(view: AppView, size: () => number): Landing {
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
      return landed !== null && landed === current?.id ? 'land' : turnOf(view.state.player.change)
    },
    slot(element) {
      landingSlot = { element, size: size() }
      return () => {
        if (landingSlot?.element === element)
          landingSlot = null
      }
    },
  }
}
