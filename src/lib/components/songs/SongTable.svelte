<script lang='ts'>
  import SongTableItem from '$lib/components/common/SongTableItem.svelte'
  import BannerCard from '$lib/components/hana/BannerCard.svelte'
  import { mockSongs } from '$lib/mock'
  import { Music } from 'lucide-svelte'

  const songCount = mockSongs.length
</script>

<BannerCard title='全部歌曲' subtitle={`共 ${songCount} 首`}>
  {#snippet icon()}
    <Music />
  {/snippet}
  <div class='w-full p-5 bg-white rounded-2xl'>
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
        {#each mockSongs as song}
          <SongTableItem {song} />
        {/each}
      </tbody>
    </table>
  </div>
</BannerCard>
