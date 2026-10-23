<!--
  手机多选的底部操作条（原型 PhoneActionBar）：占迷你播放条的位置，拇指够得着。
  加入歌单对哪种歌单都有；移除只有自建歌单有（我喜欢的音乐、收藏的歌单没有，Spec #11）。多选下载由 #39 加进来。
  能做什么由多选模块按歌单种类给出（#66），这里只是视图。
-->
<script lang='ts'>
  import { ListMinus, ListPlus } from '@lucide/svelte'
  import { getOverlays } from '../overlay-context'

  const { playlistSelection } = getOverlays()
  const none = $derived(playlistSelection.picked.length === 0)
</script>

<div class='grid h-full' class:grid-cols-2={playlistSelection.capabilities.remove} class:grid-cols-1={!playlistSelection.capabilities.remove}>
  <button
    type='button'
    class='h-full flex flex-col items-center justify-center gap-1 rounded-l-xl text-neutral-800 active:bg-primary-100 disabled:opacity-45'
    disabled={none}
    onclick={event => playlistSelection.addPicked(event, null)}
  >
    <ListPlus size={20} aria-hidden='true' />
    <span class='text-caption font-500'>加入歌单</span>
  </button>
  {#if playlistSelection.capabilities.remove}
    <button
      type='button'
      class='h-full flex flex-col items-center justify-center gap-1 rounded-r-xl text-neutral-800 active:bg-primary-100 disabled:opacity-45'
      disabled={none}
      onclick={() => playlistSelection.removePicked()}
    >
      <ListMinus size={20} aria-hidden='true' />
      <span class='text-caption font-500'>移除</span>
    </button>
  {/if}
</div>
