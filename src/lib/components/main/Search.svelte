<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import SongSearchItem from '$lib/components/common/SongSearchItem.svelte'
  import Button from '$lib/components/hana/Button.svelte'
  import Input from '$lib/components/hana/Input.svelte'
  import Modal from '$lib/components/hana/Modal.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { setNowPlaying } from '$lib/stores'
  import { Loader, Search } from 'lucide-svelte'
  import { debounce } from 'throttle-debounce'

  let openModal = $state(false)
  let prevSearchValue = ''
  let searchValue = $state('')
  let searchResults = $state<SongItem[]>([])
  let searching = $state(false)
  let controller: AbortController | null = null

  const searchSongs = async (value: string) => {
    const keyword = value.trim()
    if (!keyword) {
      searchResults = []
      searching = false
      return
    }

    if (controller)
      controller.abort()

    controller = new AbortController()
    const signal = controller.signal

    searching = true
    try {
      const res = await fetch(`/api/songs/search?keyword=${encodeURIComponent(keyword)}`, {
        signal,
      })
      const data = await res.json()
      searchResults = data
    }
    catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('搜索请求出错:', err)
      }
    }
    finally {
      if (!signal.aborted)
        searching = false
    }
  }

  const debouncedSearch = debounce(200, searchSongs)

  $effect(() => {
    if (prevSearchValue === '' && searchValue !== '') {
      searching = true
    }
    prevSearchValue = searchValue
    debouncedSearch(searchValue)
  })
</script>

<Button onclick={() => openModal = true}>
  <span class='flex items-center gap-2'>
    <Search size={20} />
    <p class='hidden md:block'>搜索歌曲</p>
  </span>
</Button>

{#if openModal}
  <Modal
    hideCloseButton
    open={openModal}
    onclose={() => openModal = false}
  >
    <div class='space-y-4'>
      <Input placeholder='搜索歌曲' bind:value={searchValue} />
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
        >总共找到 {searchResults.length} 首歌曲</p>
        <VirtualList items={searchResults} itemSize={72} containerSize={640}>
          {#snippet renderItem(item)}
            <SongSearchItem song={item} ondblclick={() => setNowPlaying(item)} />
          {/snippet}
        </VirtualList>
      {/if}
    </div>
  </Modal>
{/if}
