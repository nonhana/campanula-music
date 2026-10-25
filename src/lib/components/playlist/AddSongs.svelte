<!--
  添加歌曲（#35 补充）：从自建歌单页的“添加歌曲”（头部操作行、空状态）打开，由浮层宿主挂载。外壳 DialogShell：桌面是 560px 的居中弹窗，标题下面一行写“加入「…」”；手机是接近全屏的底部弹层，标题行是 添加歌曲 / 取消，返回手势先收起它。
  里面的内容是 AddSongsPanel；正在加入时关不掉（addSongsDialog.busy）。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import { playlistName } from '#lib/api/library.js'

  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { PlaylistRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { langOf } from '../shared/text'
  import TextButton from '../ui/TextButton.svelte'
  import AddSongsPanel from './AddSongsPanel.svelte'

  const view = getAppView()
  const { addSongsDialog } = getOverlays()
</script>

<DialogShell layer={addSongsDialog} title={() => '添加歌曲'} size={() => 'picker'}>
  {#snippet subtitle(request: PlaylistRequest)}
    {@const playlist = view.state.library?.playlists?.find(item => item.id === request.playlistId) ?? null}
    {#if playlist}<p class='truncate text-caption text-neutral-600' lang={langOf(playlistName(playlist))}>加入「{playlistName(playlist)}」</p>{/if}
  {/snippet}
  {#snippet children(request: PlaylistRequest, sheet: boolean, heading: Snippet<[classes: string]>)}
    {#if sheet}
      <div class='flex flex-none items-center gap-2 px-4 pb-2'>
        {@render heading('min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600')}
        <TextButton tone='neutral' size='body' disabled={addSongsDialog.busy} onclick={() => addSongsDialog.close()}>取消</TextButton>
      </div>
    {/if}
    <AddSongsPanel {request} />
  {/snippet}
</DialogShell>
