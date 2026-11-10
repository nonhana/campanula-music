<script lang="ts">
  import type { Snippet } from 'svelte';

  import Scrollbar from '../ui/Scrollbar.svelte';

  interface Props {
    sheet: boolean;
    body?: Snippet;
    actions?: Snippet;
    flush?: boolean;
  }

  const { sheet, body, actions, flush = false }: Props = $props();
</script>

{#if body}
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <Scrollbar />
    <div
      class={flush
        ? ''
        : sheet
          ? actions
            ? 'px-6 pt-2'
            : 'px-5 pb-6 pt-2'
          : 'px-6 pb-2 pt-2'}
    >
      {@render body()}
    </div>
  </div>
{/if}
{#if actions}
  <div
    class={sheet
      ? 'grid flex-none gap-2 px-6 pb-4 pt-6 [&>*:first-child]:order-1'
      : 'flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'}
  >
    {@render actions()}
  </div>
{/if}
