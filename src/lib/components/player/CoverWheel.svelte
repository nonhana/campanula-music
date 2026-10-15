<!--
  换碟（DESIGN.md Cover Wheel）：封面挂在一个看不见的转盘边上，轴心在封面正下方、离封面中心 1.6 倍边长，相邻两张隔 28°。
  当前这首换了就转一格：往左转时旧封面沿弧线转向左下、边转边淡出，新的从右下转到正中、边转边淡入；往右反过来。
  转到一半又换了：每张从此刻的样子接着走，新的那首直接转到正中，中间的歌不补转；新的那首正好还在转来的那一边（刚转走又换回来），就把那张转回来。
  turn 是 fade 时原地交叉淡化（播放条上的点选 200ms），减少动态效果时也只交叉淡化（150ms）；
  turn 是 null（还没换过歌）或者页面在后台时直接换上，回来不补放。歌没变（播放队列里只有一首）不转。
  铺满父元素：父元素定大小、决定裁不裁切（播放条的圆角小窗、桌面播放页左列的遮罩）
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { ClassValue } from 'svelte/elements'
  import type { Turn } from './view'
  import { untrack } from 'svelte'
  import Cover from '../library/Cover.svelte'
  import { fadeMs, reducedMotion, unseen } from '../motion'
  import { cssEasing, DURATIONS, WHEEL } from '../motion-tokens'

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
  }

  const { song, turn, duration, size, fluid = false, eager = false, class: klass }: Props = $props()

  /** 转盘上的一张封面。key 区分同一首歌的两张（刚从一边转走，又从另一边转回来） */
  interface Disc {
    key: number
    song: Song
  }

  /** 一张封面此刻的样子：从正中转开了多少度（顺时针为正，往右下），透明度 */
  interface Pose {
    angle: number
    opacity: number
  }

  /** 停在正中 */
  const REST: Pose = { angle: 0, opacity: 1 }

  let discs = $state<Disc[]>([{ key: 0, song: untrack(() => song) }])
  /** 正中的那张，放的是当前这首；其余的都在转走、淡出，转完就拿掉 */
  let front = $state(0)
  let keys = 1
  /* eslint-disable svelte/prefer-svelte-reactivity -- 下面三个只给动画用，不驱动界面更新 */
  const elements = new Map<number, HTMLElement>()
  const running = new Map<number, Animation>()
  /** 刚加上、还没挂进页面的那张：挂上时从哪转进来、转多久 */
  const entering = new Map<number, { from: Pose, ms: number }>()
  /* eslint-enable svelte/prefer-svelte-reactivity */

  function poseOf(key: number): Pose {
    const element = elements.get(key)
    if (!element)
      return entering.get(key)?.from ?? REST
    const style = getComputedStyle(element)
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
    return { angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, opacity: Number(style.opacity) }
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
    running.get(key)?.cancel()
    const turning = from.angle !== 0 || to.angle !== 0
    const keyframe = ({ angle, opacity }: Pose): Keyframe => (turning ? { transform: `rotate(${angle}deg)`, opacity } : { opacity })
    const animation = element.animate([keyframe(from), keyframe(to)], { duration: ms, easing, fill: leaving ? 'forwards' : 'none' })
    running.set(key, animation)
    animation.onfinish = () => {
      running.delete(key)
      if (leaving)
        discs = discs.filter(disc => disc.key !== key)
    }
  }

  /** 直接换上：不转，正在转的都拿掉 */
  function settle(next: Song): void {
    for (const animation of running.values())
      animation.cancel()
    running.clear()
    entering.clear()
    const key = keys++
    discs = [{ key, song: next }]
    front = key
  }

  function change(next: Song): void {
    const shown = discs.find(disc => disc.key === front)!
    if (shown.song.id === next.id) {
      // 同一首歌的信息更新了（例如曲库同步换了封面地址）：照着换，不转
      shown.song = next
      return
    }
    if (turn === null || unseen())
      return settle(next)
    const fading = turn === 'fade' || reducedMotion()
    /** 往左转：新的从右边（角度为正）转进来，整个转盘逆时针转 */
    const side = turn === 'right' ? -1 : 1
    const poses = new Map(discs.map(disc => [disc.key, poseOf(disc.key)]))
    // 交叉淡化时不转，不把半路上的那张转回来：旧的淡出、新的一张在正中淡入
    const back = fading ? undefined : discs.find(disc => disc.song.id === next.id && poses.get(disc.key)!.angle * side >= 0)
    const from = back ? poses.get(back.key)! : { angle: fading ? 0 : WHEEL.pitch * side, opacity: 0 }
    /** 整个转盘再转多少度：把新的那首转到正中 */
    const delta = fading ? 0 : -from.angle
    const ms = fading ? fadeMs(turn === 'fade' ? DURATIONS.state : duration) : duration
    for (const disc of discs) {
      if (disc === back)
        continue
      const pose = poses.get(disc.key)!
      move(disc.key, pose, { angle: pose.angle + delta, opacity: 0 }, ms, cssEasing(fading ? 'in-soft' : 'out-soft'), true)
    }
    if (back) {
      front = back.key
      move(back.key, from, REST, ms, cssEasing('out-soft'), false)
      return
    }
    const key = keys++
    entering.set(key, { from, ms })
    discs.push({ key, song: next })
    front = key
  }

  $effect(() => {
    const next = song
    untrack(() => change(next))
  })

  /** 挂上一张：刚加上的那张从转来的地方开始转（在这一帧画出来之前） */
  function mount(key: number) {
    return (element: HTMLElement) => {
      elements.set(key, element)
      const start = entering.get(key)
      if (start) {
        entering.delete(key)
        move(key, start.from, REST, start.ms, cssEasing('out-soft'), false)
      }
      return () => {
        running.get(key)?.cancel()
        running.delete(key)
        elements.delete(key)
      }
    }
  }
</script>

<!-- span：播放条、手机播放页上放在按钮里 -->
<span class='wheel' style:--pivot='{50 + WHEEL.pivot * 100}%'>
  {#each discs as disc (disc.key)}
    <span class={['disc', disc.key === front && 'front']} aria-hidden={disc.key !== front} {@attach mount(disc.key)}>
      <Cover url={disc.song.album.coverUrl} {size} {fluid} {eager} class={klass} />
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
