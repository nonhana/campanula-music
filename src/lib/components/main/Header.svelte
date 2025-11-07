<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import SongSearchItem from '$lib/components/common/SongSearchItem.svelte'
  import Button from '$lib/components/hana/Button.svelte'
  import Input from '$lib/components/hana/Input.svelte'
  import Modal from '$lib/components/hana/Modal.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import Github from '$lib/components/svg/Github.svelte'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { scrolled } from '$lib/stores'
  import { Loader, Menu, Search } from 'lucide-svelte'
  import { debounce } from 'throttle-debounce'

  interface Props {
    toggleFolded: () => void
  }

  const { toggleFolded }: Props = $props()

  // 搜索相关
  let openModal = $state(false)
  let prevSearchValue = ''
  let searchValue = $state('')
  let searchResults = $state<SongItem[]>([])
  let searching = $state(false)
  let controller: AbortController | null = null
  let page = $state(1)
  const pageSize = 50
  let totalCount = $state<number | null>(null)
  let loadingMore = $state(false)

  const searchSongs = async (value: string) => {
    if (controller)
      controller.abort()

    const keyword = value.trim()
    if (!keyword) {
      searchResults = []
      totalCount = null
      page = 1
      searching = false
      return
    }

    controller = new AbortController()
    const signal = controller.signal

    searching = true
    try {
      const [countRes, listRes] = await Promise.all([
        fetch(`/api/songs/search/count?keyword=${encodeURIComponent(keyword)}`, { signal }),
        fetch(`/api/songs/search?keyword=${encodeURIComponent(keyword)}&page=1&pageSize=${pageSize}`, { signal }),
      ])
      const countData = await countRes.json()
      const listData: SongItem[] = await listRes.json()
      totalCount = countData.count ?? 0
      searchResults = listData
      page = 1
    }
    finally {
      if (!signal.aborted)
        searching = false
    }
  }

  const debouncedSearch = debounce(200, searchSongs)

  const loadMore = async () => {
    if (loadingMore || searching)
      return
    if (totalCount !== null && searchResults.length >= totalCount)
      return
    loadingMore = true
    try {
      const nextPage = page + 1
      const res = await fetch(`/api/songs/search?keyword=${encodeURIComponent(searchValue)}&page=${nextPage}&pageSize=${pageSize}`)
      const data: SongItem[] = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const exists = new Set(searchResults.map(s => s.id))
        const merged = searchResults.concat(data.filter(s => !exists.has(s.id)))
        searchResults = merged
        page = nextPage
      }
    }
    finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (prevSearchValue === '' && searchValue !== '') {
      searching = true
    }
    prevSearchValue = searchValue
    debouncedSearch(searchValue)
  })
</script>

<header class={[
  'shrink-0 z-20 sticky top-0 w-full h-16 flex items-center px-5 gap-5 border-b border-primary/0 transition-all',
  $scrolled && 'border-primary/100 bg-white',
]}>
  <Button iconButton variant='transparent' onclick={toggleFolded}>
    <Menu />
  </Button>
  <a href='/' class='animate-[spin_5s_linear_infinite]'><Logo /></a>
  <a href='/' class='text-neutral'>Campanula</a>
  <Button class='ml-auto' onclick={() => openModal = true}>
    <span class='flex items-center gap-2'>
      <Search size={20} />
      <p class='hidden md:block'>搜索歌曲</p>
    </span>
  </Button>
  <a href='https://github.com/nonhana/campanula-music' target='_blank'><Github /></a>
</header>

{#if openModal}
  <Modal
    hideCloseButton
    open={openModal}
    onclose={() => openModal = false}
  >
    <div class='space-y-4'>
      <Input bind:value={searchValue}>
        {#snippet suffixIcon()}
          {#if loadingMore}
            <Loader size={16} class='animate-spin' />
          {/if}
        {/snippet}
      </Input>
      {#if !searchValue.trim()}
        <div class='h-64 flex items-center justify-center text-neutral'>请输入关键词开始搜索</div>
      {:else if searching}
        <div class='h-64 flex flex-col items-center justify-center gap-2 text-neutral'>
          <Loader class='size-6 animate-spin' />
          <span>正在搜索...</span>
        </div>
      {:else if searchResults.length === 0}
        <div class='h-64 flex items-center justify-center text-neutral'>未找到相关歌曲</div>
      {:else}
        <p
          class='text-sm text-neutral'
        >总共找到 {totalCount ?? 0} 首歌曲</p>
        <VirtualList
          items={searchResults}
          itemSize={72}
          containerSize={640}
          onNearEnd={loadMore}
        >
          {#snippet renderItem(item)}
            <SongSearchItem song={item} />
          {/snippet}
        </VirtualList>
      {/if}
    </div>
  </Modal>
{/if}
