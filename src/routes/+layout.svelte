<script lang='ts'>
  import { page } from '$app/state'
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import Drawer from '$lib/components/main/Drawer.svelte'
  import Header from '$lib/components/main/Header.svelte'
  import LoadingIndicator from '$lib/components/main/LoadingIndicator.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { setScrolled } from '$lib/stores'
  import { throttle } from 'throttle-debounce'
  // PROTOTYPE：reset 必须先于 uno.css 加载。原来的顺序让 reset 里的 `[type="button"] { background-color: transparent }`
  // 覆盖掉同优先级的 bg-* 工具类，带 type="button" 的按钮会丢失底色。
  import '@unocss/reset/tailwind.css'
  import 'uno.css'

  const { children } = $props()

  // PROTOTYPE：/prototype 下的视觉原型不套旧外壳（只保留上面的 uno.css 和 reset）
  const isPrototype = $derived(page.url.pathname.startsWith('/prototype'))

  let showDetail = $state(false)

  const toggleFolded = () => {
    showDetail = !showDetail
  }

  const toggleScrolled = throttle(100, (e: Event) => {
    const target = e.target as HTMLElement
    setScrolled(target.scrollTop > 0)
  })
</script>

{#if isPrototype}
  {@render children()}
{:else}
<LoadingIndicator />

<div class='h-[calc(100dvh-5rem)] bg-neutral-100'>
  <ScrollContainer contentClass='flex flex-col' scrollEvents={[toggleScrolled]}>
    <Header {toggleFolded} />
    <Sidebar folded={!showDetail} />
    <div class='block md:hidden'>
      <Drawer bind:showDetail={showDetail} />
    </div>
    <main class={['flex-1', showDetail ? 'md:ml-60' : 'md:ml-20']}>
      <div class='container m-auto px-6'>
        {@render children()}
      </div>
    </main>
    <Player />
  </ScrollContainer>
</div>

<MessageContainer />
{/if}
