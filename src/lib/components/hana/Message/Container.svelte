<script lang='ts'>
  import { messages } from '$lib/stores'
  import Message from './Item.svelte'
</script>

<div class='fixed left-1/2 top-4 z-50 flex flex-col items-center gap-4 -translate-x-1/2'>
  {#each $messages as msg (msg.id)}
    <div class='relative'>
      <Message {...msg} />
    </div>
  {/each}
</div>
