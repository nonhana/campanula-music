<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { mockPlaylist } from '$lib/mock'
  import { Ellipsis, Play } from 'lucide-svelte'
</script>

<div class='flex flex-col items-center space-y-5 w-64'>
  <img
    src={mockPlaylist.cover}
    alt={`歌单 ${mockPlaylist.name} 的封面`}
    class='aspect-square w-64 rounded-lg'
  />
  <h1 class='text-2xl font-semibold text-center w-80'>{mockPlaylist.name}</h1>
  <p class='text-neutral w-full text-wrap text-center break-words'>{mockPlaylist.description}</p>
  <p class='text-neutral'>{mockPlaylist.musicCount} 首歌曲</p>
  <div class='flex space-x-5'>
    <Tooltip content='播放全部'>
      <Button iconButton variant='secondary' shape='circle'>
        <Play />
      </Button>
    </Tooltip>
    <Tooltip content='更多'>
      <Button iconButton variant='secondary' shape='circle'>
        <Ellipsis />
      </Button>
    </Tooltip>
  </div>
</div>
