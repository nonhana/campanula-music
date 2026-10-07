<!--
  PROTOTYPE：变体 A 的桌面骨架。晨光底（primary-50）上：64px 顶栏（搜索框挂下拉）、72px 图标侧栏（菜单键展开成带文字的 220px）、
  内容区（白色面板；搜索结果也是这里的一页）、80px 底部通栏；播放页是一层由封面染色的浅雾，歌单编辑是弹层。
  键盘：Space 播放/暂停，Ctrl/⌘ K 搜索，Ctrl/⌘ ←/→ 上一首/下一首，Alt ← 返回。
-->
<script lang='ts'>
  import type { PageScreen } from '$lib/prototype/nav.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { daily, me } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { ArrowLeft, CalendarDays, CircleArrowDown, Flower, House, Menu, Settings } from '@lucide/svelte'
  import DesktopAlbum from './DesktopAlbum.svelte'
  import DesktopArtist from './DesktopArtist.svelte'
  import DesktopBar from './DesktopBar.svelte'
  import DesktopDaily from './DesktopDaily.svelte'
  import DesktopDownloads from './DesktopDownloads.svelte'
  import DesktopHome from './DesktopHome.svelte'
  import DesktopLoggedOut from './DesktopLoggedOut.svelte'
  import DesktopPlayer from './DesktopPlayer.svelte'
  import DesktopPlaylist from './DesktopPlaylist.svelte'
  import DesktopSearchBox from './DesktopSearchBox.svelte'
  import DesktopSearchResults from './DesktopSearchResults.svelte'
  import OfflineBanner from './OfflineBanner.svelte'
  import PlaylistEditor from './PlaylistEditor.svelte'
  import { ui } from './state.svelte'

  let searchBox = $state<ReturnType<typeof DesktopSearchBox>>()

  /** 内容区显示的那一页：播放页、还没按搜索时的下拉，都盖在它上面 */
  let lastPage: PageScreen = 'library'
  const underlying = $derived.by(() => {
    if (nav.screen !== 'player' && !(nav.screen === 'search' && !nav.stab))
      lastPage = nav.screen
    return lastPage
  })

  /** 桌面没有分类标签：带着某个分类（?tab= 或手机上切过来）打开曲库时，滚到首页对应的区块 */
  const sectionOf = { liked: '', playlists: 'a-pl', albums: 'a-al', artists: 'a-ar' } as const

  $effect(() => {
    void nav.playlistId
    void nav.id
    const section = underlying === 'library' ? sectionOf[nav.tab] : ''
    if (section)
      requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }))
    else window.scrollTo({ top: 0 })
  })

  function typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    return Boolean(t?.closest('input, textarea, select, [contenteditable]'))
  }

  function onkeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      searchBox?.focus()
      return
    }
    if (typing(e) || ui.menu || nav.edit)
      return
    // 焦点在按钮、链接、滑块上时，Space 留给它们自己
    if (e.key === ' ' && !(e.target as HTMLElement).closest('button, a, [role="slider"], [role="menuitem"], [role="tab"]')) {
      e.preventDefault()
      player.toggle()
    }
    else if (mod && e.key === 'ArrowRight') {
      e.preventDefault()
      player.next()
    }
    else if (mod && e.key === 'ArrowLeft') {
      e.preventDefault()
      player.prev()
    }
    else if (e.altKey && e.key === 'ArrowLeft' && nav.canGoBack) {
      e.preventDefault()
      nav.back()
    }
  }

  const rail = [
    { key: 'library', label: '曲库', icon: House, run: () => nav.goLibrary() },
    { key: 'daily', label: '每日推荐', icon: CalendarDays, run: () => nav.openDaily() },
    { key: 'downloads', label: '已下载', icon: CircleArrowDown, run: () => nav.openDownloads() },
  ] as const

  /** 侧栏高亮：歌单、歌手、专辑页都属于“曲库” */
  const railActive = $derived(underlying === 'daily' || underlying === 'downloads' ? underlying : 'library')
</script>

<svelte:window {onkeydown} />

{#if nav.loggedOut}
  <DesktopLoggedOut />
{:else}
<div class='min-h-dvh bg-primary-50' style:--rail={ui.railExpanded ? '220px' : '72px'} inert={nav.screen === 'player' || Boolean(nav.edit)}>
  <header class='fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 bg-primary-50 pl-4 pr-6'>
    <button
      class='ghost grid size-10 place-items-center rounded-xl text-neutral-700'
      aria-label={ui.railExpanded ? '收起导航' : '展开导航'}
      aria-expanded={ui.railExpanded}
      onclick={() => (ui.railExpanded = !ui.railExpanded)}
    >
      <Menu size={20} aria-hidden='true' />
    </button>
    <button class='flex h-10 items-center gap-2 rounded-lg pr-1' aria-label='Campanula · 回到曲库' onclick={() => nav.goLibrary()}>
      <Flower size={28} color='#37BE8C' strokeWidth={1.8} aria-hidden='true' />
      <span class='text-[18px] font-500 tracking-[-0.01em] text-neutral-900'>Campanula</span>
    </button>
    <button
      class={['ghost ml-2 grid size-10 place-items-center rounded-xl text-neutral-700', !nav.canGoBack && 'invisible']}
      aria-label='返回'
      title='返回（Alt ←）'
      tabindex={nav.canGoBack ? 0 : -1}
      onclick={() => nav.back()}
    >
      <ArrowLeft size={20} aria-hidden='true' />
    </button>

    <DesktopSearchBox bind:this={searchBox} />

    <button class='avatar flex-none rounded-full' aria-label='账号：{me.nickname}'>
      <Cover cover={me.avatar} class='size-9 rounded-full ring-2 ring-white' />
    </button>
  </header>

  <nav
    class='rail fixed bottom-20 left-0 top-16 z-30 flex flex-col overflow-hidden px-3 pb-4 pt-2'
    aria-label='主导航'
  >
    <ul class='flex flex-col gap-1'>
      {#each rail as item (item.key)}
        {@const active = item.key === railActive}
        <li>
          <button
            class={['rail-item flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors duration-150', active ? 'bg-primary-200 text-primary-950' : 'text-neutral-600']}
            aria-current={active ? 'page' : undefined}
            aria-label={ui.railExpanded ? undefined : item.key === 'daily' ? `${item.label} · ${daily.dateLabel}` : item.label}
            title={ui.railExpanded ? undefined : item.label}
            onclick={item.run}
          >
            <item.icon size={22} class='flex-none' aria-hidden='true' />
            <span class={['label whitespace-nowrap text-[14px] font-500', !ui.railExpanded && 'is-hidden']}>{item.label}</span>
          </button>
        </li>
      {/each}
    </ul>
    <button
      class='rail-item mt-auto flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-neutral-600'
      aria-label={ui.railExpanded ? undefined : '设置'}
      title={ui.railExpanded ? undefined : '设置'}
    >
      <Settings size={22} class='flex-none' aria-hidden='true' />
      <span class={['label whitespace-nowrap text-[14px] font-500', !ui.railExpanded && 'is-hidden']}>设置</span>
    </button>
  </nav>

  <main class='main pb-28 pt-16'>
    <div class='mx-auto max-w-[1280px] px-8 pt-4'>
      {#if nav.offline}<OfflineBanner class='mb-4' />{/if}
      {#if underlying === 'playlist'}
        {#key nav.playlistId}
          <DesktopPlaylist />
        {/key}
      {:else if underlying === 'artist'}
        {#key nav.id}
          <DesktopArtist />
        {/key}
      {:else if underlying === 'album'}
        {#key nav.id}
          <DesktopAlbum />
        {/key}
      {:else if underlying === 'daily'}
        <DesktopDaily />
      {:else if underlying === 'downloads'}
        <DesktopDownloads />
      {:else if underlying === 'search'}
        <DesktopSearchResults />
      {:else}
        <DesktopHome />
      {/if}
    </div>
  </main>

  <DesktopBar />
</div>
{/if}

{#if nav.edit}
  <PlaylistEditor phone={false} />
{/if}

{#if nav.screen === 'player'}
  <DesktopPlayer />
{/if}

<style>
  /* 侧栏展开时内容区一起让位（沿用现在的 Campanula）；宽度一步到位，只让文字淡入，避免整页跟着动画重排 */
  .rail {
    width: var(--rail);
  }

  .main {
    padding-left: var(--rail);
  }

  .label {
    transition: opacity 200ms ease-out;
  }

  .label.is-hidden {
    opacity: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .rail-item:not([aria-current]):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .avatar:hover :global(img) {
      box-shadow: 0 0 0 2px #fff, 0 0 0 4px #b9ead5;
    }
  }
</style>
