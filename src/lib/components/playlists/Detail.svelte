<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown/index.svelte'
  import DropdownItem from '$lib/components/hana/Dropdown/Item.svelte'
  import DropdownMenu from '$lib/components/hana/Dropdown/Menu.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { mockPlaylist } from '$lib/mock'
  import { Ellipsis, Play, Plus } from 'lucide-svelte'

  const moreMap = [
    {
      icon: Plus,
      text: '添加到播放列表',
    },
  ]

  const handleCommand = (command: string | number | object) => {
    console.log(command)
  }
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
    <Dropdown oncommand={handleCommand}>
      <Button iconButton variant='secondary' shape='circle'>
        <Ellipsis />
      </Button>
      {#snippet dropdown()}
        <DropdownMenu>
          {#each moreMap as { icon: Icon, text }}
            <DropdownItem command={text}>
              {#snippet icon()}
                <Icon />
              {/snippet}
              {text}
            </DropdownItem>
          {/each}
        </DropdownMenu>
      {/snippet}
    </Dropdown>
  </div>
</div>
