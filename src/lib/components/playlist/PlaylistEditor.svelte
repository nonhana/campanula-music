<!--
  歌单编辑（外壳 DialogShell，里面的内容是 PlaylistEditorPanel）：新建、编辑歌单信息、改为公开、删除，由浮层宿主挂载。桌面弹窗新建 480px、编辑信息 680px、确认 440px；手机上表单是接近全屏的弹层，确认贴着底边。
  正在等网易云建好新歌单时关不掉（playlistEditor.busy）；换封面的裁剪页（CoverEditor）盖在它上面时它不能操作。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import type { DialogSize } from '../overlay/DialogShell.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { EditorRequest } from '../overlay/overlay-requests'
  import PlaylistEditorPanel from './PlaylistEditorPanel.svelte'

  const { playlistEditor } = getOverlays()

  const TITLES = {
    new: '新建歌单',
    info: '编辑歌单信息',
    public: '改为公开歌单',
    delete: '删除歌单',
  } as const
  const SIZES: Record<EditorRequest['mode'], DialogSize> = {
    new: 'form',
    info: 'wide',
    public: 'confirm',
    delete: 'confirm',
  }
</script>

<DialogShell
  layer={playlistEditor}
  title={request => TITLES[request.mode]}
  size={request => SIZES[request.mode]}
>
  {#snippet children(request: EditorRequest, sheet: boolean, heading: Snippet<[classes: string]>)}
    <PlaylistEditorPanel {request} {sheet} {heading} />
  {/snippet}
</DialogShell>
