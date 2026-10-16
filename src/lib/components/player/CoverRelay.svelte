<!--
  播放条 ↔ 播放页的封面接力（DESIGN.md Player Bars · 播放条 ↔ 播放页）：拉开、收起、拖动播放页时，播放条上的小封面跟着抽屉的位置
  长成播放页的大封面（位置、大小一起变，圆角从小窗的 8px 变成大封面的 16px），松手弹回时也跟着；减少动态效果时没有这段接力。
  接力的是盖在播放页上面的一张封面：抽屉离开一头（整个拉开、完全收起）时量一次两头在哪，之后每一帧只按 playerDrawer.position
  摆它（transform 和圆角，不读排版）；这一段里两头的封面自己藏着（style:opacity 读 coverRelaying）。抽屉停到一头时拿掉它，
  同一帧两头的封面露出来（整个拉开时大封面的图还没到，就先盖着，等图到了、淡入完再拿掉）。
  两头：播放条那头是 cover-flight.svelte.ts 的 barCover（有封面正飞进播放条时没有），播放页那头是挂了 relayTarget 的大封面
  （手机上换成了歌词时没有）。缺一头的那一段不接力，播放条的封面留在原地被抽屉盖住。放在 PlayerPage 里、抽屉外面
-->
<script lang='ts' module>
  import type { Song } from '$lib/api/library'
  import type { Attachment } from 'svelte/attachments'
  import { preloadCover } from '../library/Cover.svelte'
  import { playerDrawer } from './player-page.svelte'

  /** 接力的一头：封面所在的那一块，它的封面按多大取（Cover 的 size） */
  interface CoverEnd {
    element: HTMLElement
    size: number
  }

  /** 一段接力：起点是播放条的小窗（抽屉完全收起时），终点是播放页的大封面（整个拉开时），各自的圆角 */
  interface Leg {
    from: DOMRect
    to: DOMRect
    radius: readonly [from: number, to: number]
    bar: CoverEnd
    page: CoverEnd
  }

  /** 播放页的大封面（接力的终点） */
  let target = $state.raw<CoverEnd | null>(null)
  /** 正在接力的这一段；none：这一段接不上，停到一头之前都不接（半路才接上会让播放条的封面突然消失）；null：抽屉停在一头 */
  let leg = $state.raw<Leg | 'none' | null>(null)

  /** 正在接力：播放条的小窗、播放页的大封面这时都藏起来（各自写 style:opacity），看到的是盖在上面、跟着抽屉走的那一张 */
  export function coverRelaying(): boolean {
    return leg !== null && leg !== 'none'
  }

  /** 挂在播放页大封面的那一块上，它的圆角就是终点的圆角。size：它的封面按多大取 */
  export function relayTarget(size: number): Attachment<HTMLElement> {
    return (element) => {
      target = { element, size }
      return () => {
        if (target?.element === element)
          target = null
      }
    }
  }

  /**
   * 播放条（DesktopPlayerBar、PhoneMiniPlayer）初始化时调用：当前这首一变，就在后台取好播放页大封面（size）的缩略图，
   * 拉开播放页时长大的封面、播放页上的封面直接是大图。播放页露着时不取：那时换碟自己取（连着切歌时不取一路转过去的）
   */
  export function prefetchPageCover(song: () => Song | null, size: number): void {
    const url = $derived(song()?.album.coverUrl)
    // 抽屉动着时 position 每一帧都变，这里只看露没露出来
    const pageShown = $derived(playerDrawer.visible)
    $effect(() => {
      if (url && !pageShown)
        void preloadCover(url, size)
    })
  }
</script>

<script lang='ts'>
  import { untrack } from 'svelte'
  import Cover, { coverLoaded } from '../library/Cover.svelte'
  import { fadeMs, reducedMotion } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { barCover } from './cover-flight.svelte'

  /** song：当前这首；panel：播放页这层抽屉，量大封面在整个拉开时的位置 */
  const { song, panel }: { song: Song, panel: HTMLElement | undefined } = $props()

  function cornerOf(element: HTMLElement): number {
    return Number.parseFloat(getComputedStyle(element).borderTopLeftRadius)
  }

  /** 抽屉离开一头：量两头。抽屉这时可能已经动了一点，大封面整个拉开时的位置按它离抽屉顶边多远算 */
  function start(): Leg | 'none' {
    const bar = barCover()
    const page = target
    if (reducedMotion() || !bar || !page || !panel)
      return 'none'
    const cover = page.element.getBoundingClientRect()
    const top = panel.getBoundingClientRect().top
    return {
      from: bar.element.getBoundingClientRect(),
      to: new DOMRect(cover.x, cover.y - top, cover.width, cover.height),
      radius: [cornerOf(bar.element), cornerOf(page.element)],
      bar,
      page,
    }
  }

  /**
   * 整个拉开时大封面的图还没到（刚换的歌，后台还在取）：接力的封面停在大封面上盖着，等图加载好、从小图上淡入完再拿掉，
   * 不露出空的薄荷底（The Cover Leads Rule，和点歌飞进播放条一样）。等的时候抽屉又动了，这一段接着接力
   */
  async function land(ended: Leg, url: string): Promise<void> {
    await preloadCover(url, ended.page.size)
    await new Promise(done => setTimeout(done, fadeMs(DURATIONS.reveal)))
    if (leg === ended && playerDrawer.position <= 0)
      leg = null
  }

  $effect(() => {
    const at = playerDrawer.position
    const page = target?.element
    untrack(() => {
      if (at > 0 && at < 1) {
        if (leg === null)
          leg = start()
        // 半路上大封面没了（手机上换成了歌词）：这一段不再接力
        else if (leg !== 'none' && leg.page.element !== page)
          leg = 'none'
        return
      }
      // 停到一头（拉过头时也算整个拉开）：拿掉接力的封面，同一帧露出两头；整个拉开时大图还没到就先盖着
      const url = song.album.coverUrl
      if (leg && leg !== 'none' && at <= 0 && leg.page.element === page && !coverLoaded(url, leg.page.size))
        void land(leg, url)
      else
        leg = null
    })
  })

  // 收到底时整个播放页拿掉：播放条的封面露出来
  $effect(() => () => {
    leg = null
  })

  /**
   * 此刻接力的封面摆在哪：按抽屉拉开的比例在两头之间取位置、大小和圆角（拉过头时停在大封面上）；
   * 元素按终点的大小画，用 scale 缩到此刻的大小
   */
  const pose = $derived.by(() => {
    if (!leg || leg === 'none')
      return null
    const { from, to, radius, bar, page } = leg
    const open = Math.min(1, 1 - playerDrawer.position)
    const mix = (a: number, b: number) => a + (b - a) * open
    const scale = mix(from.width, to.width) / to.width
    return {
      width: to.width,
      height: to.height,
      transform: `translate(${mix(from.x, to.x)}px, ${mix(from.y, to.y)}px) scale(${scale})`,
      radius: mix(radius[0], radius[1]) / scale,
      size: page.size,
      placeholder: bar.size,
    }
  })
</script>

{#if pose}
  <div
    class='relay pointer-events-none fixed left-0 top-0 z-50 overflow-hidden shadow-float'
    style:width='{pose.width}px'
    style:height='{pose.height}px'
    style:transform={pose.transform}
    style:border-radius='{pose.radius}px'
    aria-hidden='true'
  >
    <Cover url={song.album.coverUrl} size={pose.size} placeholder={pose.placeholder} fluid eager />
  </div>
{/if}

<style>
  .relay {
    transform-origin: 0 0;
    will-change: transform;
  }
</style>
