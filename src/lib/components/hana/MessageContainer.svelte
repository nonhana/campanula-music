<script lang='ts'>
  import { messages } from '$lib/stores'
  import { flip } from 'svelte/animate'
  import { quintOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import Message from './MessageItem.svelte'
</script>

<div class='fixed left-1/2 top-4 z-50 flex flex-col items-center gap-4 -translate-x-1/2'>
  {#each $messages as msg (msg.id)}
    <div
      class='relative'
      transition:fly={{ y: -50, duration: 300 }}
      animate:flip={{ duration: 300, easing: quintOut }}
    >
      <Message {...msg} />
    </div>
  {/each}
</div>
