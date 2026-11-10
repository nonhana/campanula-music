<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context';

  const { multiSelect } = getOverlays();
  const none = $derived(multiSelect.picked.length === 0);
</script>

<div
  class="grid h-full"
  style:grid-template-columns={`repeat(${Math.max(1, multiSelect.actions.length)}, minmax(0, 1fr))`}
>
  {#each multiSelect.actions as action, i (action.key)}
    {@const Icon = action.icon}
    <button
      type="button"
      class={[
        'h-full flex flex-col items-center justify-center gap-1 active:bg-primary-100 disabled:opacity-45',
        action.tone === 'destructive' ? 'text-error-700' : 'text-neutral-800',
        i === 0 && 'rounded-l-xl',
        i === multiSelect.actions.length - 1 && 'rounded-r-xl',
      ]}
      disabled={none || action.blocked !== null}
      title={action.blocked ?? undefined}
      onclick={(event: MouseEvent) =>
        action.run(
          multiSelect.picked,
          event.currentTarget as HTMLElement,
          null,
        )}
    >
      <Icon size={20} aria-hidden="true" />
      <span class="text-caption font-500">{action.label}</span>
    </button>
  {/each}
</div>
