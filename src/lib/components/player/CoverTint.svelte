<!--
  播放页的封面染底（DESIGN.md Elevation & Depth）：当前封面放大、重度模糊（64px，饱和度 1.15），盖一层 80% 的白纱，
  每首歌把页面染成自己的颜色，同时保持明亮、字可读（The Light-Only Fog Rule）。
  换歌时先在后台把新封面加载、解码好，再让新的一层在上面淡入（700ms，减少动态效果时 150ms），淡完拿掉底下那层：
  底下一直有颜色盖着，不会先变白再染上。淡着的时候又换了歌，等这层淡完再换到最新那首，中间的歌跳过：
  连着切歌时最多两层，颜色平稳地追到最后停下的那首。页面在后台时直接换上；新封面加载不出来就留着上一首的颜色。
  模糊得很重，用小缩略图（SMALL_COVER，和歌曲行、换碟先铺的是同一张，不多下载）就够。铺满 position: relative（或 fixed）的容器
-->
<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'
  import { untrack } from 'svelte'
  import { fadeMs } from '../shared/motion'
  import { cssEasing, DURATIONS } from '../shared/motion-tokens'
  import { coverSource } from '../ui/Cover.svelte'
  import { SMALL_COVER } from './view'

  const { coverUrl }: { coverUrl: string } = $props()
  const wanted = $derived(coverSource(coverUrl, SMALL_COVER))

  /** 铺着的几层，后面的盖在上面。平时一层；换色时多一层在最上面淡入 */
  interface Layer {
    key: number
    src: string
  }

  let layers = $state.raw<Layer[]>([
    {
      key: 0,
      src: untrack(() => wanted),
    },
  ])
  let keys = 1
  /** 最上面那层正在淡入：淡完以前不再加新的一层 */
  let covering = false

  /** 换到最新那首的颜色：解码好了、上一层也淡完了才加上去 */
  async function advance(): Promise<void> {
    const src = wanted
    if (layers.at(-1)!.src === src)
      return
    const probe = new Image()
    probe.src = src
    try {
      await probe.decode()
    }
    catch {
      // 加载不出来：留着上一首的颜色
      return
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

  /** 新加的一层从透明淡入，淡完拿掉底下的，再看要不要接着换 */
  function enter(key: number): Attachment<HTMLImageElement> {
    return (img) => {
      if (key === 0)
        return
      const animation = img.animate([
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
  }

  $effect(() => {
    void wanted
    untrack(() => void advance())
  })
</script>

<div class='tint' aria-hidden='true'>
  {#each layers as layer (layer.key)}
    <img src={layer.src} alt='' draggable='false' {@attach enter(layer.key)} />
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

  .veil {
    position: absolute;
    inset: 0;
    background: rgb(255 255 255 / 0.8);
  }
</style>
