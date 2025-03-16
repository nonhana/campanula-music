<script lang='ts'>
  import type { PageData } from './$types'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import SongTableItem from '$lib/components/common/SongTableItem.svelte'
  import Paginator from '$lib/components/hana/Paginator.svelte'

  const curPage = $state(Number(page.params.page))

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
</script>

<svelte:head>
  <title>Songs</title>
  <meta name='description' content='Lists of songs' />
</svelte:head>

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
      {#each data.songList as song}
        <SongTableItem {song} />
      {/each}
    </tbody>
  </table>
</div>

<div class='sticky bottom-5 mx-auto mt-5 w-fit rounded-lg bg-white p-4'>
  <Paginator
    currentPage={curPage}
    total={data.songCount}
    pageSize={data.pageSize}
    buttonCount={5}
    changePage={newPage => goto(`/songs/${newPage}`)}
  />
</div>
