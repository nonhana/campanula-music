<script lang="ts">
  import type { Snippet } from 'svelte';

  import Button from '../ui/Button.svelte';
  import DialogBody from './DialogBody.svelte';

  interface Props {
    sheet: boolean;
    cancelLabel?: string;
    oncancel: () => void;
    body?: Snippet;
    confirm: Snippet;
  }

  const {
    sheet,
    cancelLabel = '取消',
    oncancel,
    body,
    confirm,
  }: Props = $props();
</script>

<DialogBody {sheet} {body}>
  {#snippet actions()}
    <Button variant="outline" onclick={oncancel} data-autofocus
      >{cancelLabel}</Button
    >
    {@render confirm()}
  {/snippet}
</DialogBody>
