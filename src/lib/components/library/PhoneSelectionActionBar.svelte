<!-- 手机多选底部操作条（原型 PhoneActionBar）：占迷你播放条的位置，拇指够得着。按当前这张列表的动作数组画（#82），
  动作和先后和桌面工具条一致；打开的弹层是底部弹层（anchor 为 null）。断网时下载变灰并写原因，浏览器不能选文件夹时目录里就没有导出（ADR-0014）。 -->
<script lang='ts'>
  import { getOverlays } from '../overlay/overlay-context'

  const { multiSelect } = getOverlays()
  const none = $derived(multiSelect.picked.length === 0)
</script>

<div class='grid h-full' style:grid-template-columns={`repeat(${Math.max(1, multiSelect.actions.length)}, minmax(0, 1fr))`}>
  {#each multiSelect.actions as action, i (action.key)}
    {@const Icon = action.icon}
    <button
      type='button'
      class={[
        'h-full flex flex-col items-center justify-center gap-1 active:bg-primary-100 disabled:opacity-45',
        action.tone === 'destructive'
          ? 'text-error-700'
          : 'text-neutral-800',
        i === 0 && 'rounded-l-xl',
        i === multiSelect.actions.length - 1 && 'rounded-r-xl',
      ]}
      disabled={none || action.blocked !== null}
      title={action.blocked ?? undefined}
      onclick={(event: MouseEvent) => action.run(multiSelect.picked, event.currentTarget as HTMLElement, null)}
    >
      <Icon size={20} aria-hidden='true' />
      <span class='text-caption font-500'>{action.label}</span>
    </button>
  {/each}
</div>
