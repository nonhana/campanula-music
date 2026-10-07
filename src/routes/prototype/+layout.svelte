<!-- PROTOTYPE：视觉原型的外层。自托管 Noto 可变字体、浅色声明、截图模式。 -->
<script lang='ts'>
  import { page } from '$app/state'
  import '@fontsource-variable/noto-sans'
  import '@fontsource-variable/noto-sans-sc'
  import '@fontsource-variable/noto-sans-jp'
  import '@fontsource-variable/noto-sans-tc'
  import '$lib/prototype/world.css'

  const { children } = $props()

  const still = $derived(page.url.searchParams.get('still') === '1')

  $effect(() => {
    document.documentElement.lang = 'zh-CN'
  })
</script>

<svelte:head>
  <meta name='color-scheme' content='only light' />
  <title>Campanula · 视觉原型</title>
</svelte:head>

<div class='proto-root' lang='zh-CN' data-still={still || undefined}>
  {@render children()}
</div>
