<script lang='ts'>
  import type { MessageItem } from '$lib/stores'
  import { messageStore } from '$lib/stores/messageStore'
  import { onDestroy } from 'svelte'
  import Message from './Item.svelte'

  let messages = $state<MessageItem[]>([])

  const unsubscribe = messageStore.subscribe((value) => {
    messages = value
  })

  onDestroy(unsubscribe)
</script>

<div class='fixed left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-4'>
  {#each messages as msg (msg.id)}
    <div class='relative'>
      <Message {...msg} />
    </div>
  {/each}
</div>
