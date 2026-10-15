<!--
  换碟（DESIGN.md Cover Wheel）：封面挂在一个看不见的转盘边上，轴心在封面正下方、离封面中心 1.6 倍边长，相邻两张隔 28°。
  当前这首换了就转一格：往左转时旧封面沿弧线转向左下、边转边淡出，新的从右下转到正中、边转边淡入；往右反过来。
  转到一半又换了：每张从此刻的样子接着走，新的那首直接转到正中，中间的歌不补转；新的那首正好还在转来的那一边（刚转走又换回来），就把那张转回来。
  减少动态效果时原地交叉淡化（150ms）；
  turn 是 null（还没换过歌）、land（列表里点的歌，飞来的封面正好落在这里）或者页面在后台时直接换上，回来不补放。歌没变（播放队列里只有一首）不转。
  手机播放页上按住封面左右拖（drag）：转盘跟着手转，上一首、下一首的封面从两边转进来，离正中越远越淡；
  拖起来时动画还在半路就从那里接着转，最多转到旁边那张停在正中。松手切了歌，换碟从拖到的样子接着转（旁边那张就是转回来的那张）；
  没切就 240ms 转回原位（减少动态效果时直接到位），两边那两张转回去、拿掉。拖动时减少动态效果也照样跟手。
  大图（几百 KB 一张）先铺小缩略图（SMALL_COVER，多半已经有了），大图到了从小图上淡入。转盘本来停着、单独换一首时新的那首马上取大图；
  连着切歌（转着、拖着时又换了）时一路转过去的歌只用小图、不去下载大图，等转盘停下来才取最后那首的，它不用排在别的大图后面。
  转盘停稳、正中那张的大图到了，再在后台取上一首、下一首的大图。
  铺满父元素：父元素定大小、决定裁不裁切（播放条的圆角小窗、桌面播放页左列的遮罩）
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { ClassValue } from 'svelte/elements'
  import type { Turn } from './view'
  import { untrack } from 'svelte'
  import Cover, { coverLoaded, preloadCover } from '../library/Cover.svelte'
  import { fadeMs, moveMs, reducedMotion, unseen } from '../motion'
  import { cssEasing, DURATIONS, WHEEL } from '../motion-tokens'
  import { SMALL_COVER } from './view'

  interface Props {
    song: Song
    /** 当前这首是怎么换上来的（view.ts 的 turnOf） */
    turn: Turn | null
    /** 转一格多久（ms）：播放页 600，播放条 480 */
    duration: number
    /** 封面缩略图按多大取（Cover 的 size） */
    size: number
    fluid?: boolean
    eager?: boolean
    /** 封面的圆角、阴影 */
    class?: ClassValue
    /** 手机播放页：按住封面左右拖时转盘被手转了几格（wheel-core 的 turned，往右为正）；没在拖是 null */
    drag?: number | null
    /** 拖动时从左边、右边转进来的上一首、下一首（按上一首、下一首会换到的那首）；没有别的歌可换时是 null。给了就先在后台把封面加载好 */
    previous?: Song | null
    next?: Song | null
  }

  const { song, turn, duration, size, fluid = false, eager = false, class: klass, drag = null, previous = null, next = null }: Props = $props()

  /** 转盘上的一张封面。key 区分同一首歌的两张（刚从一边转走，又从另一边转回来）；sharp：取了大图（之前加载过，或者停在正中过） */
  interface Disc {
    key: number
    song: Song
    sharp: boolean
  }

  /** 一张封面此刻的样子：从正中转开了多少度（顺时针为正，往右下），透明度 */
  interface Pose {
    angle: number
    opacity: number
  }

  /** 停在正中 */
  const REST: Pose = { angle: 0, opacity: 1 }

  /** 这首的大图用不用等：小转盘（播放条）的大图就是小缩略图；加载过的直接用 */
  const sharpNow = (s: Song) => size <= SMALL_COVER || coverLoaded(s.album.coverUrl, size)

  let discs = $state.raw<Disc[]>([{ key: 0, song: untrack(() => song), sharp: true }])
  /** 正中那张的大图到了、没在拖：这时才在后台取上一首、下一首的大图，不和正中那张抢网速；连着切歌时正中是小图，就不去取 */
  let frontReady = $state(false)
  /** 正中的那张，放的是当前这首；其余的都在转走、淡出，转完就拿掉（拖着时露出来的上一首、下一首除外） */
  let front = $state(0)
  let keys = 1
  /* eslint-disable svelte/prefer-svelte-reactivity -- 下面几个只给动画、拖动用，不驱动界面更新 */
  const elements = new Map<number, HTMLElement>()
  /** 正在走的动画和它从哪走到哪：此刻的样子按动画进度算，不读元素的计算样式（读一次就要把整页的样式重算一遍） */
  const running = new Map<number, { animation: Animation, from: Pose, to: Pose }>()
  /** 刚加上、还没挂进页面的那张：挂上时从哪转进来、转多久 */
  const entering = new Map<number, { from: Pose, ms: number }>()
  /** 拖着时手摆着的那几张各转开了多少度（写在元素的 style 上；还没挂上的挂上时照着摆） */
  const posed = new Map<number, number>()
  /* eslint-enable svelte/prefer-svelte-reactivity */
  /**
   * 正被手拖着：拖起来那一刻正中的那张（front）、它当时转开了几格（动画还在半路时从那里接着转），
   * 露出来的上一首、下一首是哪两张、各在哪一边（左边 -1，右边 1）
   */
  let held: { front: number, base: number, sides: (readonly [key: number, side: -1 | 1])[] } | null = null

  /** 拖着时一张封面的样子：离正中越远越淡，转开一格（28°）就看不见了，和换碟时边转边淡一样 */
  function dragged(angle: number): Pose {
    return { angle, opacity: Math.max(0, 1 - Math.abs(angle) / WHEEL.pitch) }
  }

  /** 一张封面此刻的样子：手摆着的；正在走的按动画进度在起止之间取（和画出来的一样）；还没挂上的在转进来的地方；其余停在正中 */
  function poseOf(key: number): Pose {
    const angle = posed.get(key)
    if (angle !== undefined)
      return dragged(angle)
    const motion = running.get(key)
    if (!motion)
      return entering.get(key)?.from ?? REST
    // 走完了、还没等到 onfinish 的：停在终点
    const progress = motion.animation.effect?.getComputedTiming().progress ?? (motion.animation.playState === 'finished' ? 1 : 0)
    const { from, to } = motion
    return { angle: from.angle + (to.angle - from.angle) * progress, opacity: from.opacity + (to.opacity - from.opacity) * progress }
  }

  /** 拖着时直接摆在元素的 style 上；null 是拿掉，交回动画和样式表 */
  function setStyle(element: HTMLElement, pose: Pose | null): void {
    element.style.transform = pose ? `rotate(${pose.angle}deg)` : ''
    element.style.opacity = pose ? String(pose.opacity) : ''
  }

  function stop(key: number): void {
    running.get(key)?.animation.cancel()
    running.delete(key)
  }

  /** 从此刻的样子 from 走到 to；leaving：走完就拿掉，走完之前一直停在 to 的样子。没转动（交叉淡化）时只动透明度 */
  function move(key: number, from: Pose, to: Pose, ms: number, easing: string, leaving: boolean): void {
    const element = elements.get(key)
    if (!element) {
      // 还没挂上就要走的：从没露过面，直接拿掉
      if (leaving) {
        entering.delete(key)
        discs = discs.filter(disc => disc.key !== key)
      }
      return
    }
    running.get(key)?.animation.cancel()
    const turning = from.angle !== 0 || to.angle !== 0
    const keyframe = ({ angle, opacity }: Pose): Keyframe => (turning ? { transform: `rotate(${angle}deg)`, opacity } : { opacity })
    const animation = element.animate([keyframe(from), keyframe(to)], { duration: ms, easing, fill: leaving ? 'forwards' : 'none' })
    running.set(key, { animation, from, to })
    animation.onfinish = () => {
      // 已经被接走了（拖起来时把转走的那张接过来、又换了一段动画）：不归这段管
      if (running.get(key)?.animation !== animation)
        return
      running.delete(key)
      if (leaving)
        discs = discs.filter(disc => disc.key !== key)
      else if (key === front && !held)
        sharpen()
    }
  }

  /** 正中那张取大图（转盘停下来时，或者它本来就是大图）；它到了（或者加载不出来）、没在拖，再取上一首、下一首的（下面的 effect） */
  function sharpen(): void {
    const shown = discs.find(disc => disc.key === front)!
    if (!shown.sharp)
      discs = discs.map(disc => (disc === shown ? { ...disc, sharp: true } : disc))
    const key = front
    void preloadCover(shown.song.album.coverUrl, size).then(() => {
      if (key === front && !held)
        frontReady = true
    })
  }

  /** 直接换上：不转，正在转的都拿掉 */
  function settle(incoming: Song): void {
    for (const { animation } of running.values())
      animation.cancel()
    running.clear()
    entering.clear()
    const key = keys++
    discs = [{ key, song: incoming, sharp: true }]
    front = key
    sharpen()
  }

  function change(incoming: Song): void {
    const shown = discs.find(disc => disc.key === front)!
    if (shown.song.id === incoming.id) {
      // 同一首歌的信息更新了（例如曲库同步换了封面地址）：照着换，不转。拖着时每次移动都走到这里，没变就什么都不做
      if (shown.song !== incoming)
        discs = discs.map(disc => (disc === shown ? { ...disc, song: incoming } : disc))
      return
    }
    if (turn === null || turn === 'land' || unseen())
      return settle(incoming)
    const fading = reducedMotion()
    /** 转盘本来停着（单独换一首）：新的那首马上取大图；转着、拖着时又换了（连着切歌），等停下来再取 */
    const calm = held === null && running.size === 0 && entering.size === 0
    frontReady = false
    /** 往左转：新的从右边（角度为正）转进来，整个转盘逆时针转 */
    const side = turn === 'right' ? -1 : 1
    const poses = new Map(discs.map(disc => [disc.key, poseOf(disc.key)]))
    // 交叉淡化（减少动态效果）时不转，不把半路上的那张转回来：旧的淡出、新的一张在正中淡入
    const back = fading ? undefined : discs.find(disc => disc.song.id === incoming.id && poses.get(disc.key)!.angle * side >= 0)
    const from = back ? poses.get(back.key)! : { angle: fading ? 0 : WHEEL.pitch * side, opacity: 0 }
    /** 整个转盘再转多少度：把新的那首转到正中 */
    const delta = fading ? 0 : -from.angle
    const ms = fading ? fadeMs(duration) : duration
    for (const disc of discs) {
      if (disc === back)
        continue
      const pose = poses.get(disc.key)!
      // 已经看不见的（转走淡完了、拖着时转出一格的）直接拿掉：连着切歌时转盘上不堆着一摞透明的封面
      if (pose.opacity < 0.01) {
        stop(disc.key)
        discs = discs.filter(other => other.key !== disc.key)
        continue
      }
      move(disc.key, pose, { angle: pose.angle + delta, opacity: 0 }, ms, cssEasing(fading ? 'in-soft' : 'out-soft'), true)
    }
    if (back) {
      front = back.key
      // 拖进来的那张：拖着时它的大图可能刚加载好
      if (!back.sharp && sharpNow(back.song))
        discs = discs.map(disc => (disc === back ? { ...disc, sharp: true } : disc))
      move(back.key, from, REST, ms, cssEasing('out-soft'), false)
    }
    else {
      const key = keys++
      entering.set(key, { from, ms })
      discs = [...discs, { key, song: incoming, sharp: calm || sharpNow(incoming) }]
      front = key
    }
    // 新的那首已经是大图（拖进来时就是、单独换一首）：等它到了就取两边的；不然等转盘停下来
    if (discs.find(disc => disc.key === front)!.sharp)
      sharpen()
  }

  /** 拖起来：正中那张停在此刻的样子；上一首、下一首摆到它两边（刚转走、还在淡出的那张正好是它，就把那张接过来） */
  function hold(): NonNullable<typeof held> {
    const base = poseOf(front).angle / WHEEL.pitch
    frontReady = false
    stop(front)
    entering.delete(front)
    const sides: (readonly [key: number, side: -1 | 1])[] = []
    for (const [neighbor, side] of [[previous, -1], [next, 1]] as const) {
      if (!neighbor)
        continue
      const leaving = discs.find(disc => disc.key !== front && sides.every(([key]) => key !== disc.key) && disc.song.id === neighbor.id && poseOf(disc.key).angle * side > 0)
      if (leaving) {
        stop(leaving.key)
        sides.push([leaving.key, side])
        continue
      }
      const key = keys++
      discs = [...discs, { key, song: neighbor, sharp: sharpNow(neighbor) }]
      sides.push([key, side])
    }
    return { front, base, sides }
  }

  function place(key: number, angle: number): void {
    posed.set(key, angle)
    const element = elements.get(key)
    if (element)
      setStyle(element, dragged(angle))
  }

  /** 拖着：整个转盘转到 base + turned 格，最多转到旁边那张停在正中 */
  function follow(turned: number): void {
    held ??= hold()
    // 拖着时换了歌（放完自动接续）：换碟已经接手，等这次拖动作废
    if (held.front !== front)
      return
    const at = Math.max(-1, Math.min(1, held.base + turned))
    place(held.front, at * WHEEL.pitch)
    for (const [key, side] of held.sides)
      place(key, (at + side) * WHEEL.pitch)
  }

  /**
   * 松手、作废：切了歌的话换碟已经从拖到的样子接着转；没切就转回原位，两边那两张转回去、拿掉。
   * 松手切歌时 App 同步发布新的当前这首（start 在第一个 await 之前），song 和 drag 在同一次更新里一起变
   */
  function letGo(): void {
    const { front: grabbed, sides } = held!
    held = null
    if (grabbed === front) {
      const ms = moveMs(DURATIONS['wheel-return'])
      const easing = cssEasing('out-soft')
      move(front, poseOf(front), REST, ms, easing, false)
      for (const [key, side] of sides)
        move(key, poseOf(key), { angle: side * WHEEL.pitch, opacity: 0 }, ms, easing, true)
    }
    // 动画盖在 style 上面，拿掉 style 不会跳一下；动画走完就回到样式表（停在正中）
    for (const key of posed.keys()) {
      const element = elements.get(key)
      if (element)
        setStyle(element, null)
    }
    posed.clear()
  }

  // 换歌和拖动在一个 effect 里、先换歌：松手切了歌时，换碟先从拖到的样子接着转，再拿掉手摆的 style（反过来会先跳回正中）
  $effect(() => {
    const current = song
    const turned = drag
    untrack(() => {
      change(current)
      if (turned !== null)
        follow(turned)
      else if (held)
        letGo()
    })
  })

  sharpen()

  // 上一首、下一首：小图马上取（很小，拖起来、切过去时先铺它）；大图等正中那张的大图到了再取
  $effect(() => {
    const ready = frontReady
    for (const neighbor of [previous, next]) {
      if (!neighbor)
        continue
      void preloadCover(neighbor.album.coverUrl, SMALL_COVER)
      if (ready)
        void preloadCover(neighbor.album.coverUrl, size)
    }
  })

  /** 挂上一张：拖着时摆在手转到的地方；刚加上的那张从转来的地方开始转（在这一帧画出来之前） */
  function mount(key: number) {
    return (element: HTMLElement) => {
      elements.set(key, element)
      const angle = posed.get(key)
      const start = entering.get(key)
      if (angle !== undefined) {
        setStyle(element, dragged(angle))
      }
      else if (start) {
        entering.delete(key)
        move(key, start.from, REST, start.ms, cssEasing('out-soft'), false)
      }
      return () => {
        running.get(key)?.animation.cancel()
        running.delete(key)
        elements.delete(key)
      }
    }
  }
</script>

<!-- span：播放条、手机播放页上放在按钮里 -->
<span class='wheel' style:--pivot='{50 + WHEEL.pivot * 100}%'>
  {#each discs as disc (disc.key)}
    <!-- 换了一张封面的信息（取大图、曲库同步换了地址）时 disc 是新的对象：挂载只看不变的 key，不然会重新挂一次、把正在走的动画停掉 -->
    {@const key = disc.key}
    <span class={['disc', key === front && 'front']} aria-hidden={key !== front} {@attach mount(key)}>
      <Cover url={disc.song.album.coverUrl} {size} {fluid} {eager} class={klass} placeholder={SMALL_COVER} load={disc.sharp} />
    </span>
  {/each}
</span>

<style>
  .wheel {
    display: grid;
    isolation: isolate;
  }

  .disc {
    grid-area: 1 / 1;
    transform-origin: 50% var(--pivot);
    pointer-events: none;
  }

  /* 正中的那张盖在转走的上面 */
  .disc.front {
    z-index: 1;
    pointer-events: auto;
  }
</style>
