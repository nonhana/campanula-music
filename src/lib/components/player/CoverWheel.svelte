<!--
  换碟（DESIGN.md Cover Wheel）：封面挂在看不见的转盘边上，轴心在封面正下方、离中心 1.6 倍边长，相邻隔 28°。换歌转一格：
  往左旧封面沿弧线转向左下、边转边淡出，新的从右下转进正中；往右反过来。转到一半又换：每张从此刻接着走，新的直接转到正中，
  不补转中间的歌；新的正好还在转来的那边（刚转走又换回）就把那张转回来。减少动态效果时原地交叉淡化（150ms）；
  turn 为 null、land（列表点的歌，飞来的封面正好落这里）或页面在后台时直接换上；歌没变不转。
  手机播放页按住封面左右拖：转盘跟手，两边封面转进来、离正中越远越淡；拖起来时动画从半路接着转，最多转到旁边那张停在正中。
  松手切歌就从拖到的样子接着转，没切就 240ms 转回原位（减少动态效果时直接到位）。拖动时减少动态效果也照样跟手。
  大图先铺小缩略图（SMALL_COVER），到了淡入；转盘停着单独换一首时马上取大图，连着切歌一路转过去的只用小图，停稳后才取最后那首和两边。
  铺满父元素：父元素定大小、决定裁不裁切。
-->
<script lang='ts'>
  import { untrack } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { Song } from '#lib/api/library.js'

  import { fadeMs, moveMs, reducedMotion, unseen } from '../shared/motion'
  import { cssEasing, DURATIONS, WHEEL } from '../shared/motion-tokens'
  import Cover, { coverLoaded, preloadCover } from '../ui/Cover.svelte'
  import type { Turn } from './view'
  import { SMALL_COVER } from './view'

  interface Props {
    song: Song
    turn: Turn | null
    /** 播放页 600，播放条 480 */
    duration: number
    /** Cover 的 size */
    size: number
    fluid?: boolean
    eager?: boolean
    class?: ClassValue
    /** wheel-core 的 turned，往右为正；没在拖是 null */
    drag?: number | null
    /** 拖封面时从两边转进来的上一首、下一首；没有别的歌可换时是 null。给了就先在后台加载封面 */
    previous?: Song | null
    next?: Song | null
  }

  const { song, turn, duration, size, fluid = false, eager = false, class: klass, drag = null, previous = null, next = null }: Props = $props()

  /** key 区分同一首歌的两张（转走又从另一边转回来）；sharp 是取了大图（加载过或停在正中过） */
  interface Disc {
    key: number
    song: Song
    sharp: boolean
  }

  interface Pose {
    angle: number
    opacity: number
  }

  const REST: Pose = { angle: 0, opacity: 1 }

  /** 小转盘（播放条）的大图就是小缩略图；加载过的直接用 */
  const sharpNow = (s: Song) => size <= SMALL_COVER || coverLoaded(s.album.coverUrl, size)

  let discs = $state.raw<Disc[]>([
    {
      key: 0,
      song: untrack(() => song),
      sharp: true,
    },
  ])
  /** 正中大图到了、没在拖才后台取两边，不抢网速；连着切歌时正中是小图，就不去取 */
  let frontReady = $state(false)
  /** 放的是当前这首；其余都在转走、淡出，转完拿掉（拖着时露出的两边除外） */
  let front = $state(0)
  let keys = 1
  /* eslint-disable svelte/prefer-svelte-reactivity -- 下面几个只给动画、拖动用，不驱动界面更新 */
  const elements = new Map<number, HTMLElement>()
  /** 此刻的样子按动画进度算，不读计算样式（读一次要把整页重算一遍） */
  const running = new Map<number, { animation: Animation, from: Pose, to: Pose }>()
  const entering = new Map<number, { from: Pose, ms: number }>()
  const posed = new Map<number, number>()
  /* eslint-enable svelte/prefer-svelte-reactivity */
  /** 正被手拖着：en 那一刻正中的那张、它当时转开的格数（动画半路从那里接着转）、露出的两边各在哪一边（左 -1，右 1） */
  let held: { front: number, base: number, sides: (readonly [key: number, side: -1 | 1])[] } | null = null

  /** 离正中越远越淡，转开一格（28°）就看不见 */
  const dragged = (angle: number): Pose => ({
    angle,
    opacity: Math.max(0, 1 - Math.abs(angle) / WHEEL.pitch),
  })

  /** 手摆着的优先；正在走的按动画进度取；还没挂上的在转进来的地方；其余停在正中 */
  const poseOf = (key: number): Pose => {
    const angle = posed.get(key)
    if (angle !== undefined)
      return dragged(angle)
    const motion = running.get(key)
    if (!motion)
      return entering.get(key)?.from ?? REST
    // 走完了、还没等到 onfinish：停在终点
    const progress = motion.animation.effect?.getComputedTiming().progress ?? (motion.animation.playState === 'finished'
      ? 1
      : 0)
    const { from, to } = motion
    return { angle: from.angle + (to.angle - from.angle) * progress, opacity: from.opacity + (to.opacity - from.opacity) * progress }
  }

  /** null 是拿掉，交回动画和样式表 */
  const setStyle = (element: HTMLElement, pose: Pose | null): void => {
    element.style.transform = pose
      ? `rotate(${pose.angle}deg)`
      : ''
    element.style.opacity = pose
      ? String(pose.opacity)
      : ''
  }

  const stop = (key: number): void => {
    running.get(key)?.animation.cancel()
    running.delete(key)
  }

  /** leaving 走完就拿掉；没转动（交叉淡化）时只动透明度 */
  const move = (key: number, from: Pose, to: Pose, ms: number, easing: string, leaving: boolean): void => {
    const element = elements.get(key)
    if (!element) {
      // 还没挂上就要走：没露过面，直接拿掉
      if (leaving) {
        entering.delete(key)
        discs = discs.filter(disc => disc.key !== key)
      }
      return
    }
    running.get(key)?.animation.cancel()
    const turning = from.angle !== 0 || to.angle !== 0
    const keyframe = ({ angle, opacity }: Pose): Keyframe => (turning
      ? { transform: `rotate(${angle}deg)`, opacity }
      : { opacity })
    const animation = element.animate([
      keyframe(from),
      keyframe(to),
    ], {
      duration: ms,
      easing,
      fill: leaving ? 'forwards' : 'none',
    })
    running.set(key, { animation, from, to })
    animation.onfinish = () => {
      // 已经被接走了（拖起来时接过来、又换了一段动画）：不归这段管
      if (running.get(key)?.animation !== animation)
        return
      running.delete(key)
      if (leaving)
        discs = discs.filter(disc => disc.key !== key)
      else if (key === front && !held)
        sharpen()
    }
  }

  /** 正中那张取大图；它到了（或加载不出来）、没在拖，再取两边（下面的 effect） */
  const sharpen = (): void => {
    const shown = discs.find(disc => disc.key === front)!
    if (!shown.sharp) {
      discs = discs.map(disc => (disc === shown
        ? { ...disc, sharp: true }
        : disc))
    }
    const key = front
    void preloadCover(shown.song.album.coverUrl, size).then(() => {
      if (key === front && !held)
        frontReady = true
    })
  }

  /** 不转，正在转的都拿掉 */
  const settle = (incoming: Song): void => {
    for (const { animation } of running.values())
      animation.cancel()
    running.clear()
    entering.clear()
    const key = keys++
    discs = [
      { key, song: incoming, sharp: true },
    ]
    front = key
    sharpen()
  }

  const change = (incoming: Song): void => {
    const shown = discs.find(disc => disc.key === front)!
    if (shown.song.id === incoming.id) {
      // 同一首的信息更新了（例如曲库换了封面地址）：照着换、不转，没变就什么都不做
      if (shown.song !== incoming) {
        discs = discs.map(disc => (disc === shown
          ? { ...disc, song: incoming }
          : disc))
      }
      return
    }
    if (turn === null || turn === 'land' || unseen())
      return settle(incoming)
    const fading = reducedMotion()
    /** 转盘停着（单独换一首）就马上取大图；转着、拖着时又换了，等停下来再取 */
    const calm = held === null && running.size === 0 && entering.size === 0
    frontReady = false
    /** 往左：新的从右边（角度为正）转进来，整个转盘逆时针转 */
    const side = turn === 'right'
      ? -1
      : 1
    const poses = new Map(discs.map(disc => [
      disc.key,
      poseOf(disc.key),
    ]))
    // 交叉淡化时不转，也不把半路那张转回来：旧的淡出、新的在正中淡入
    const back = fading
      ? undefined
      : discs.find(disc => disc.song.id === incoming.id && poses.get(disc.key)!.angle * side >= 0)
    const from = back
      ? poses.get(back.key)!
      : {
        angle: fading
          ? 0
          : WHEEL.pitch * side,
        opacity: 0,
      }
    /** 把新的那首转到正中 */
    const delta = fading
      ? 0
      : -from.angle
    const ms = fading
      ? fadeMs(duration)
      : duration
    for (const disc of discs) {
      if (disc === back)
        continue
      const pose = poses.get(disc.key)!
      // 已经看不见的直接拿掉：连着切歌时不堆一摞透明的封面
      if (pose.opacity < 0.01) {
        stop(disc.key)
        discs = discs.filter(other => other.key !== disc.key)
        continue
      }
      move(disc.key, pose, { angle: pose.angle + delta, opacity: 0 }, ms, cssEasing(fading ? 'in-soft' : 'out-soft'), true)
    }
    if (back) {
      front = back.key
      // 拖进来的那张：大图可能刚加载好
      if (!back.sharp && sharpNow(back.song)) {
        discs = discs.map(disc => (disc === back
          ? { ...disc, sharp: true }
          : disc))
      }
      move(back.key, from, REST, ms, cssEasing('out-soft'), false)
    }
    else {
      const key = keys++
      entering.set(key, { from, ms })
      discs = [
        ...discs,
        { key, song: incoming, sharp: calm || sharpNow(incoming) },
      ]
      front = key
    }
    // 新的已经是大图：等它到了就取两边；不然等转盘停下来
    if (discs.find(disc => disc.key === front)!.sharp)
      sharpen()
  }

  /** 正中停在此刻的样子，两边摆到它旁边（刚转走、还在淡出的正好是它，就接过来） */
  const hold = (): NonNullable<typeof held> => {
    const base = poseOf(front).angle / WHEEL.pitch
    frontReady = false
    stop(front)
    entering.delete(front)
    const sides: (readonly [key: number, side: -1 | 1])[] = []
    for (const [neighbor, side] of [
      [previous, -1],
      [next, 1],
    ] as const) {
      if (!neighbor)
        continue
      const leaving = discs.find(disc => disc.key !== front && sides.every(([key]) => key !== disc.key) && disc.song.id === neighbor.id && poseOf(disc.key).angle * side > 0)
      if (leaving) {
        stop(leaving.key)
        sides.push([leaving.key, side])
        continue
      }
      const key = keys++
      discs = [
        ...discs,
        {
          key,
          song: neighbor,
          sharp: sharpNow(neighbor),
        },
      ]
      sides.push([key, side])
    }
    return { front, base, sides }
  }

  const place = (key: number, angle: number): void => {
    posed.set(key, angle)
    const element = elements.get(key)
    if (element)
      setStyle(element, dragged(angle))
  }

  /** 转到 base + turned 格，最多转到旁边那张停在正中 */
  const follow = (turned: number): void => {
    held ??= hold()
    // 拖着时换了歌（放完自动接续）：换碟接手，等这次拖动作废
    if (held.front !== front)
      return
    const at = Math.max(-1, Math.min(1, held.base + turned))
    place(held.front, at * WHEEL.pitch)
    for (const [key, side] of held.sides)
      place(key, (at + side) * WHEEL.pitch)
  }

  /** 切了歌的话换碟已经从拖到的样子接着转；没切就转回原位。松手切歌时 App 同步发布新的当前这首，song 和 drag 在同一次更新里变 */
  const letGo = (): void => {
    const { front: grabbed, sides } = held!
    held = null
    if (grabbed === front) {
      const ms = moveMs(DURATIONS['wheel-return'])
      const easing = cssEasing('out-soft')
      move(front, poseOf(front), REST, ms, easing, false)
      for (const [key, side] of sides)
        move(key, poseOf(key), { angle: side * WHEEL.pitch, opacity: 0 }, ms, easing, true)
    }
    // 动画盖在 style 上，拿掉 style 不会跳；走完回到样式表（停在正中）
    for (const key of posed.keys()) {
      const element = elements.get(key)
      if (element)
        setStyle(element, null)
    }
    posed.clear()
  }

  // 先换歌再拖动：松手切歌时先从拖到的样子接着转，再拿掉手摆的 style（反过来会先跳回正中）
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

  // 两边小图马上取（拖起来、切过去先铺它）；大图等正中那张到了再取
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

  /** 拖着时摆在手转到的地方；刚加上的从转来的地方开始转（这一帧画出来之前） */
  const mount = (key: number) => (element: HTMLElement) => {
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
</script>

<span class='wheel' style:--pivot='{50 + WHEEL.pivot * 100}%'>
  {#each discs as disc (disc.key)}
    <!-- 封面信息换了时 disc 是新对象：挂载只看不变的 key，不然会重挂、停掉正在走的动画 -->
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

  /* 正中的盖在转走的上面 */
  .disc.front {
    z-index: 1;
    pointer-events: auto;
  }
</style>
