<!--
  PROTOTYPE 变体 C · 搜索脊梁：“点一首或搜一首”。
  搜索框是每个界面的脊梁：曲库在本机，打字就出结果，并且自动限定在你所在的地方（整个曲库 → 这张歌单 → 播放队列）。
  签名动作“即时点亮”：命中的字符在打字的瞬间亮成薄荷色，结果数同步更新。
  < 768px 手机布局，≥ 768px 桌面布局。
-->
<script lang='ts'>
  import { nav } from '$lib/prototype/nav.svelte'
  import DesktopC from './desktop/DesktopC.svelte'
  import PhoneC from './phone/PhoneC.svelte'
  import SongMenu from './SongMenu.svelte'
  import { ui } from './ui.svelte'

  const mq = window.matchMedia('(min-width: 768px)')
  let desktop = $state(mq.matches)

  $effect(() => {
    const on = () => {
      desktop = mq.matches
      ui.menu = null
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  })

  // 带着搜索词打开（?q=…）时，在曲库里直接展开即时搜索
  if (nav.query && nav.screen === 'library')
    ui.searchOpen = true

  // “/” 聚焦搜索框（输入框里不拦截）
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey)
      return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, select, [contenteditable]') || nav.screen === 'player')
      return
    e.preventDefault()
    ui.requestFocus()
  }
</script>

<svelte:window {onkeydown} />

{#if desktop}
  <DesktopC />
{:else}
  <PhoneC />
{/if}

<SongMenu />
