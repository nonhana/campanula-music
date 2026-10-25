<!-- 手机多选底部操作条（原型 PhoneActionBar）：占迷你播放条的位置，拇指够得着。能做什么由多选模块按列表种类给出（#66），这里只是视图：
  歌单里加入歌单，自建歌单还能移除（我喜欢的音乐、收藏的歌单没有）；已下载页只有导出和删除（#79），浏览器不能选文件夹时没有导出（ADR-0014）。 -->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import { CircleArrowDown, FolderDown, ListMinus, ListPlus, Trash2 } from '@lucide/svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'

  const { multiSelect } = getOverlays()
  const view = getAppView()
  const none = $derived(multiSelect.picked.length === 0)
  const offline = $derived(!view.state.online)
  const actions = $derived(([
    multiSelect.capabilities.add && {
      label: '加入歌单',
      icon: ListPlus,
      run: (event: MouseEvent) => multiSelect.addPicked(event, null),
    },
    multiSelect.capabilities.download && {
      label: '下载',
      icon: CircleArrowDown,
      disabled: offline,
      run: () => multiSelect.downloadPicked(),
    },
    multiSelect.capabilities.remove && {
      label: '移除',
      icon: ListMinus,
      run: () => multiSelect.removePicked(),
    },
    multiSelect.capabilities.export && {
      label: '导出',
      icon: FolderDown,
      run: (event: MouseEvent) => multiSelect.exportPicked(event),
    },
    multiSelect.capabilities.delete && {
      label: '删除',
      icon: Trash2,
      destructive: true,
      run: (event: MouseEvent) => multiSelect.deletePicked(event),
    },
  ] satisfies (false | { label: string, icon: LucideIcon, destructive?: true, disabled?: boolean, run: (event: MouseEvent) => void })[]).filter(action => action !== false))
</script>

<div class={[
  'grid h-full',
  actions.length === 2
    ? 'grid-cols-2'
    : actions.length === 3
    ? 'grid-cols-3'
    : 'grid-cols-1',
]}>
  {#each actions as action, i (action.label)}
    {@const Icon = action.icon}
    <button
      type='button'
      class={[
        'h-full flex flex-col items-center justify-center gap-1 active:bg-primary-100 disabled:opacity-45',
        action.destructive ? 'text-error-700' : 'text-neutral-800',
        i === 0 && 'rounded-l-xl',
        i === actions.length - 1 && 'rounded-r-xl',
      ]}
      disabled={none || action.disabled}
      title={action.disabled ? '断网时不能下载' : undefined}
      onclick={action.run}
    >
      <Icon size={20} aria-hidden='true' />
      <span class='text-caption font-500'>{action.label}</span>
    </button>
  {/each}
</div>
