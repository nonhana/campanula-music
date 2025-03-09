<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import SongTableItem from '$lib/components/common/SongTableItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import Paginator from '$lib/components/hana/Paginator.svelte'
  import { Music } from 'lucide-svelte'

  const pageSize = 50

  let songCount = $state(0)
  const fetchSongCount = async () => {
    const res = await fetch('/api/songs/count')
    const data = await res.json()
    songCount = data.count
  }
  $effect(() => {
    fetchSongCount()
  })

  let curPage = $state(1)

  let curSongs = $state<SongItem[]>([])
  const fetchSongs = async () => {
    const res = await fetch(`/api/songs?page=${curPage}&pageSize=${pageSize}`)
    const data = await res.json()
    curSongs = data
  }
  $effect(() => {
    fetchSongs()
  })
</script>

<BannerCard title='全部歌曲' subtitle={`共 ${songCount} 首`}>
  {#snippet icon()}
    <Music />
  {/snippet}
  <div class='w-full rounded-2xl bg-white p-5'>
    <table class='w-full'>
      <colgroup>
        <col style='width: 15%;'>
        <col style='width: 10%;'>
        <col style='width: 20%;'>
        <col style='width: 20%;'>
        <col style='width: 15%;'>
        <col style='width: 10%;'>
        <col style='width: 10%;'>
      </colgroup>
      <thead>
        <tr>
          <th>封面</th>
          <th>Id</th>
          <th>曲名</th>
          <th>艺术家</th>
          <th>专辑</th>
          <th>时长</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each curSongs as song}
          <SongTableItem {song} />
        {/each}
      </tbody>
    </table>
  </div>

  <div class='sticky bottom-5 mx-auto mt-5 w-fit rounded-lg bg-white p-4'>
    <Paginator bind:currentPage={curPage} total={songCount} pageSize={pageSize} buttonCount={5} />
  </div>
</BannerCard>
