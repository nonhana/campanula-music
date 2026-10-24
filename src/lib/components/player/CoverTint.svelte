<!--
  播放页的封面染底（DESIGN.md Elevation & Depth）：封面放大、重度模糊（64px，饱和度 1.15），盖一层 80% 白纱，每首歌把页面染成自己的颜色，
  同时保持明亮、字可读（The Light-Only Fog Rule）。换歌时先加载解码新封面，再让新层在上面淡入（700ms，减少动态效果 150ms），
  淡完拿掉底下那层——底下一直有颜色，不会先变白。淡着时又换歌，等这层淡完再换，中间的歌跳过，最多两层；后台直接换，加载不出来留着上一首的颜色。
  用小缩略图（SMALL_COVER，和歌曲行、换碟先铺的同一张）就够；铺满 relative（或 fixed）的容器。
  网易云没给封面（#78）时不染色：淡回底色（primary-50）。
-->
<script lang='ts'>
  import { untrack } from 'svelte'
  import type { Attachment } from 'svelte/attachments'

  import { fadeMs } from '../shared/motion'
  import { cssEasing, DURATIONS } from '../shared/motion-tokens'
  import { coverSource } from '../ui/Cover.svelte'
  import { SMALL_COVER } from './view'

  const { coverUrl }: { coverUrl: string | null } = $props()
  const wanted = $derived(coverUrl === null
    ? null
    : coverSource(coverUrl, SMALL_COVER))

  /** 平时一层；换色时多一层在最上面淡入。src 是 null 的是没有封面的底色层 */
  interface Layer {
    key: number
    src: string | null
  }

  let layers = $state.raw<Layer[]>([
    {
      key: 0,
      src: untrack(() => wanted),
    },
  ])
  let keys = 1
  /** 淡完以前不再加新的一层 */
  let covering = false

  /** 解码好了、上一层也淡完了才加 */
  const advance = async (): Promise<void> => {
    const src = wanted
    if (layers.at(-1)!.src === src)
      return
    if (src !== null) {
      const probe = new Image()
      probe.src = src
      try {
        await probe.decode()
      }
      catch {
        // 加载不出来：留着上一首的颜色
        return
      }
    }
    if (src !== wanted || covering || layers.at(-1)!.src === src)
      return
    const layer = { key: keys++, src }
    if (fadeMs(DURATIONS.tint) === 0) {
      layers = [layer]
      return
    }
    covering = true
    layers = [...layers, layer]
  }

  /** 淡完拿掉底下的，再看要不要接着换 */
  const enter = (key: number): Attachment<HTMLElement> => (element) => {
    if (key === 0)
      return
    const animation = element.animate([
      { opacity: 0 },
      { opacity: 1 },
    ], {
      duration: fadeMs(DURATIONS.tint),
      easing: cssEasing('out-soft'),
    })
    animation.onfinish = () => {
      layers = layers.filter(layer => layer.key >= key)
      covering = false
      void advance()
    }
    return () => animation.cancel()
  }

  $effect(() => {
    void wanted
    untrack(() => void advance())
  })
</script>

<div class='tint' aria-hidden='true'>
  {#each layers as layer (layer.key)}
    {#if layer.src === null}
      <div class='blank' {@attach enter(layer.key)}></div>
    {:else}
      <img src={layer.src} alt='' draggable='false' {@attach enter(layer.key)} />
    {/if}
  {/each}
  <div class='veil'></div>
</div>

<style>
  .tint {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: theme('colors.primary.50');
    pointer-events: none;
  }

  img {
    position: absolute;
    inset: -20%;
    width: 140%;
    height: 140%;
    max-width: none;
    object-fit: cover;
    filter: blur(64px) saturate(1.15);
    transform: translateZ(0);
  }

  .blank {
    position: absolute;
    inset: 0;
    background: theme('colors.primary.50');
  }

  .veil {
    position: absolute;
    inset: 0;
    background: rgb(255 255 255 / 0.8);
  }
</style>
