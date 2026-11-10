<script lang="ts">
  import { CheckCheck, ListChecks, SquareMinus, X } from '@lucide/svelte';

  import { anchorBelow } from '../menu/menu-anchor';
  import { getOverlays } from '../overlay/overlay-context';
  import { formatCount } from '../shared/text';

  const { multiSelect: selection } = getOverlays();
  const none = $derived(selection.picked.length === 0);
  const ACTION =
    'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-caption font-500 transition-colors duration-feedback disabled:opacity-45 mouse:enabled:hover:bg-primary-100';
</script>

<div
  class="h-9 flex items-center gap-1.5 rounded-lg bg-primary-50 pl-3 pr-1"
  role="toolbar"
  aria-label="对选中的歌"
>
  <span
    class="inline-flex flex-none items-center gap-1.5 text-caption text-neutral-900 font-500 tabular-nums"
    role="status"
  >
    <ListChecks size={14} aria-hidden="true" />已选 {formatCount(
      selection.size,
    )} 首
  </span>
  <button
    type="button"
    class="h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-primary-900 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100"
    onclick={() => selection.selectAll()}
  >
    {#if selection.allOn}<SquareMinus
        size={14}
        aria-hidden="true"
      />{:else}<CheckCheck size={14} aria-hidden="true" />{/if}
    {selection.allOn ? '全不选' : '全选'}
  </button>
  <span class="flex-1"></span>
  {#each selection.actions as action (action.key)}
    {@const Icon = action.icon}
    <button
      type="button"
      class={[
        ACTION,
        action.tone === 'destructive' ? 'text-error-700' : 'text-neutral-800',
      ]}
      disabled={none || action.blocked !== null}
      title={action.blocked ?? undefined}
      onclick={(event: MouseEvent) =>
        action.run(
          selection.picked,
          event.currentTarget as HTMLElement,
          anchorBelow(event),
        )}
    >
      <Icon size={15} aria-hidden="true" />{action.label}
    </button>
  {/each}
  <span class="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true"></span>
  <button
    type="button"
    class="h-8 inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 text-caption text-neutral-700 font-500 transition-colors duration-feedback mouse:hover:bg-primary-100"
    title="Esc"
    onclick={() => selection.leave()}
    ><X size={14} aria-hidden="true" />取消选择</button
  >
</div>
