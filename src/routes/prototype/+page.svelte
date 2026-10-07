<!--
  PROTOTYPE：Campanula 核心界面（曲库首屏 / 播放页 / 4815 首歌单页）的三个变体，
  在 /prototype 上用 ?variant=A|B|C 切换；同一个地址在手机宽度和桌面宽度下分别是两种布局。
-->
<script lang='ts'>
  import { replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { likedSongs } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import PrototypeSwitcher from '$lib/prototype/PrototypeSwitcher.svelte'
  import VariantA from '$lib/prototype/variants/a/VariantA.svelte'
  import VariantB from '$lib/prototype/variants/b/VariantB.svelte'
  import VariantC from '$lib/prototype/variants/c/VariantC.svelte'

  const variants = [
    { key: 'A', name: '分区首页' },
    { key: 'B', name: '歌词舞台' },
    { key: 'C', name: '搜索脊梁' },
  ]

  const initial = new URLSearchParams(page.url.search)
  nav.init(initial)
  player.offline = nav.offline
  const track = initial.get('track')
  if (track) {
    const i = likedSongs.findIndex(s => s.id === track)
    if (i >= 0)
      player.playFrom(likedSongs, i, { kind: 'liked', name: '我喜欢的音乐', id: 'liked' })
  }
  if (initial.has('t'))
    player.seek(Number(initial.get('t')))
  if (initial.get('paused') === '1')
    player.playing = false

  const still = initial.get('still') === '1'
  const shot = initial.get('shot') === '1'
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')

  // PROTOTYPE：给自动截图和冒烟检查读取播放状态用
  if (import.meta.env.DEV)
    (globalThis as { __protoPlayer?: typeof player }).__protoPlayer = player

  $effect(() => {
    if (still)
      return
    const id = setInterval(() => player.tick(0.25), 250)
    return () => clearInterval(id)
  })

  // 浅路由的 replaceState 不会更新 page.url，所以要和地址栏里真实的地址比，
  // 否则回到“刚打开时的那个状态”时地址栏不会跟着变
  $effect(() => {
    const next = nav.apply(new URL(page.url))
    if (next.href !== location.href)
      replaceState(next, page.state)
  })
</script>

{#if variant === 'B'}
  <VariantB />
{:else if variant === 'C'}
  <VariantC />
{:else}
  <VariantA />
{/if}

{#if !shot}
  <PrototypeSwitcher {variants} current={variant} />
{/if}
