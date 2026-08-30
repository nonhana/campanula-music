<script lang='ts'>
  import type { MessageOptions } from '$lib/stores'
  import { Check, CircleAlert, Info, X } from '@lucide/svelte'

  type NonUndefined<T> = T extends undefined ? never : T

  const {
    message = '默认消息',
    type = 'info',
  }: MessageOptions = $props()

  const messageClasses: Record<NonUndefined<MessageOptions['type']>, string> = {
    info: 'bg-neutral-100 text-neutral border-neutral border-2',
    success: 'bg-success-100 text-success-600 border-success-600 border-2',
    warning: 'bg-warning-100 text-warning-600 border-warning-600 border-2',
    error: 'bg-error-100 text-error-600 border-error-600 border-2',
  }
</script>

<div class={['m-auto flex w-fit items-center gap-2 text-nowrap rounded-lg p-3 text-sm shadow-lg', messageClasses[type]]}>
  {#if type === 'info'}
    <Info size={16} />
  {:else if type === 'success'}
    <Check size={16} />
  {:else if type === 'warning'}
    <CircleAlert size={16} />
  {:else if type === 'error'}
    <X size={16} />
  {/if}
  <span>{message}</span>
</div>
