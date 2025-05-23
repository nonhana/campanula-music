<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import type { PageData } from './$types'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import SongTableItem from '$lib/components/common/SongTableItem.svelte'
  import Paginator from '$lib/components/hana/Paginator.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const curPage = $state(Number(page.params.page))

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()

  let songList = $state<SongItem[]>([])

  $effect(() => {
    songList = data.songList
  })

  const fetchSongList = async () => {
    const res = await fetch(`/api/songs?page=${curPage}&pageSize=${data.pageSize}`)
    songList = await res.json()
  }

  $effect(() => {
    if (songList.length === 0) {
      fetchSongList()
    }
  })

  const metadata = generateSeoMetadata('home', {
    title: `歌曲列表 - 第${curPage}页 | Campanula Music`,
    description: `浏览Campanula Music的歌曲列表，第${curPage}页，发现新的音乐作品`,
    keywords: '歌曲列表,音乐,Campanula,在线音乐',
  })
</script>

<SeoHead {metadata} />

<div class='w-full rounded-2xl bg-white px-5 py-3 md:px-15 md:py-5'>
  <table class='w-full'>
    <colgroup>
      <col class='w-[7%]'>
      <col class='w-[4%] hidden md:table-column'>
      <col class='w-[27%]'>
      <col class='w-[27%] hidden md:table-column'>
      <col class='w-[27%] hidden md:table-column'>
      <col class='w-[4%] hidden md:table-column'>
      <col class='w-[4%]'>
    </colgroup>
    <thead>
      <tr class='text-left hidden md:table-row'>
        <th></th>
        <th class='hidden md:table-cell'></th>
        <th>曲名</th>
        <th class='hidden md:table-cell'>艺术家</th>
        <th class='hidden md:table-cell'>专辑</th>
        <th class='hidden md:table-cell'>时长</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      {#each songList as song}
        <SongTableItem {song} />
      {/each}
    </tbody>
  </table>
  <div class='mt-4 flex justify-center md:hidden'>
    <Paginator
      currentPage={curPage}
      total={data.songCount}
      pageSize={data.pageSize}
      buttonCount={5}
      changePage={newPage => goto(`/songs/${newPage}`)}
    />
  </div>
</div>

<div class='sticky bottom-5 mx-auto mt-5 w-fit rounded-lg bg-white p-4 hidden md:block'>
  <Paginator
    currentPage={curPage}
    total={data.songCount}
    pageSize={data.pageSize}
    buttonCount={5}
    changePage={newPage => goto(`/songs/${newPage}`)}
  />
</div>
