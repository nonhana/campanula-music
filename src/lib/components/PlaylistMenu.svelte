<!--
  歌单页头部的 •••（playlist-edit.svelte.ts 的 playlistMenu，原型 PlaylistActions）：只有自建歌单有。
  编辑歌单信息、改为公开（只有隐私歌单有）、删除歌单（出错红，和上面隔一条线）；选了就关上菜单，打开对应的编辑（PlaylistEditor）。
  我喜欢的音乐不能改名、不能删，没有这个菜单；收藏的歌单用头部的“已收藏”取消收藏（DESIGN.md Layout，#30）。
  浮动菜单、底部弹层、键盘怎么用见 MenuOverlay。放在 SignedInFrame 里
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { PlaylistMenuRequest } from './playlist-edit.svelte'
  import { Globe, Pencil, Trash2 } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import Cover from './library/Cover.svelte'
  import { langOf } from './library/view'
  import MenuOverlay from './MenuOverlay.svelte'
  import { playlistEditor, playlistMenu } from './playlist-edit.svelte'

  /** 浮动菜单一项的高度、分隔线和上下内边距（px）：还没画出来时按它估计高度，决定往下还是往上飘 */
  const FLOATING_ITEM = 36
  const FLOATING_EXTRA = 21
  /** 底部弹层一项的高度、拉手和歌单名那一块的高度（px）：还没画出来时（打开的头一帧）按它们算 */
  const SHEET_ITEM = 52
  const SHEET_HEAD = 121

  interface Item {
    key: 'info' | 'public' | 'delete'
    label: string
    icon: LucideIcon
  }

  const view = getAppView()

  function playlistOf(request: PlaylistMenuRequest) {
    return view.state.library?.playlists?.find(playlist => playlist.id === request.playlistId) ?? null
  }

  function itemsOf(request: PlaylistMenuRequest): Item[] {
    const playlist = playlistOf(request)
    if (playlist?.kind !== 'own')
      return []
    return [
      { key: 'info', label: '编辑歌单信息', icon: Pencil },
      ...(playlist.private ? [{ key: 'public', label: '改为公开', icon: Globe } as const] : []),
      { key: 'delete', label: '删除歌单', icon: Trash2 },
    ]
  }

  /** 菜单关上（不把焦点还回去，交给编辑），打开对应的编辑；关掉编辑后焦点回到 ••• */
  function choose(item: Item, request: PlaylistMenuRequest) {
    playlistMenu.request = null
    playlistEditor.open({ mode: item.key, playlistId: request.playlistId, from: request.from })
  }

  function estimate(request: PlaylistMenuRequest, sheet: boolean): number {
    const count = itemsOf(request).length
    return sheet ? SHEET_HEAD + count * SHEET_ITEM : FLOATING_EXTRA + count * FLOATING_ITEM
  }
</script>

{#snippet sheetHeader(request: PlaylistMenuRequest)}
  {@const playlist = playlistOf(request)}
  {#if playlist}
    <div class='flex items-center gap-3 px-4 pb-3 pt-1'>
      <Cover url={playlist.coverUrl} size={48} class='rounded-md' />
      <p class='min-w-0 truncate text-body text-neutral-900 font-500' lang={langOf(playlist.name)}>{playlist.name}</p>
    </div>
  {/if}
{/snippet}

{#snippet content(request: PlaylistMenuRequest, sheet: boolean)}
  {#each itemsOf(request) as item (item.key)}
    {#if item.key === 'delete'}
      <div class={['my-1 h-px bg-neutral-100', sheet ? 'mx-4' : 'mx-3']} role='separator'></div>
    {/if}
    <button
      type='button'
      role='menuitem'
      tabindex='-1'
      class={[
        'w-full flex items-center rounded-lg text-left outline-none focus-visible:bg-primary-100',
        item.key === 'delete' ? 'text-error-700' : 'text-neutral-900',
        sheet ? 'h-13 gap-4 px-4 text-body active:bg-primary-100' : 'h-9 gap-3 px-3 text-label transition-colors duration-feedback mouse:hover:bg-primary-50',
      ]}
      onclick={() => choose(item, request)}
    >
      <item.icon size={sheet ? 20 : 18} class={['flex-none', item.key === 'delete' ? 'text-error-700' : 'text-neutral-600']} aria-hidden='true' />{item.label}
    </button>
  {/each}
{/snippet}

<MenuOverlay layer={playlistMenu} label={request => `歌单操作：${playlistOf(request)?.name ?? ''}`} width='w-60' {estimate} {sheetHeader} {content} />
