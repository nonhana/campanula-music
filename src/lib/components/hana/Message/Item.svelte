<script lang='ts'>
  import type { MessageOptions } from '$lib/stores'
  import { Check, CircleAlert, Info, X } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'

  type NonUndefined<T> = T extends undefined ? never : T

  const {
    message = '默认消息',
    type = 'info',
    timeout = 3000,
  }: MessageOptions = $props()

  let visible = $state(false)

  onMount(() => {
    visible = true
    setTimeout(() => {
      visible = false
    }, timeout)
  })

  const messageClasses: Record<NonUndefined<MessageOptions['type']>, string> = {
    info: 'bg-hana-blue-100 text-hana-blue border-hana-blue border-2',
    success: 'bg-green-100 text-green-600 border-green-600 border-2',
    warning: 'bg-yellow-100 text-yellow-600 border-yellow-600 border-2',
    error: 'bg-red-100 text-red-600 border-red-600 border-2',
  }
</script>

{#if visible}
  <div
    transition:fade={{ duration: 300 }}
    class={['m-auto flex w-fit items-center gap-2 text-nowrap rounded-lg p-3 text-sm shadow-lg', messageClasses[type]]}
  >
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
{/if}
