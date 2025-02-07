<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown/index.svelte'
  import DropdownItem from '$lib/components/hana/Dropdown/Item.svelte'
  import DropdownMenu from '$lib/components/hana/Dropdown/Menu.svelte'
  import {
    mute,
    muted,
    nowPlaying,
    volume,
  } from '$lib/stores'
  import {
    Ellipsis,
    Music4,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
  } from 'lucide-svelte'

  interface Props {
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handlePointerDown: () => void
    paused: boolean
    togglePaused: () => void
  }

  const {
    currentProgress,
    handleInput,
    handleChange,
    handlePointerDown,
    paused,
    togglePaused,
  }: Props = $props()

  const handleCommand = (command: string | number | object) => {
    console.log(command)
  }
</script>

<div class='flex flex-col gap-5'>
  {#if $nowPlaying}
    <img
      src={$nowPlaying?.cover}
      alt={$nowPlaying.name}
      class='w-[27rem] h-[27rem] object-cover rounded-2xl'
    />
  {:else}
    <div>
      <Music4 size='64' />
    </div>
  {/if}
  <div class='flex flex-col gap-2'>
    <span class='text-xl font-semibold'>{$nowPlaying?.name ?? '未在播放'}</span>
    {#if $nowPlaying?.alias}
      <span class='text-neutral font-semibold'>{$nowPlaying.alias.join(' / ')}</span>
    {/if}
    {#if $nowPlaying}
      <span class='text-neutral text-sm'>{$nowPlaying.artists.join(' / ')}</span>
    {/if}
  </div>
  <input
    type='range'
    min='0'
    max='1'
    step='0.001'
    value={currentProgress}
    oninput={handleInput}
    onchange={handleChange}
    onpointerdown={handlePointerDown}
    class='w-full'
  />
  <div class='w-full flex justify-between items-center text-neutral'>
    <Dropdown>
      <Button iconButton variant='transparent' onclick={mute}>
        {#if $muted}
          <VolumeX />
        {:else if $volume === 0}
          <Volume />
        {:else if $volume < 0.5}
          <Volume1 />
        {:else if $volume <= 1}
          <Volume2 />
        {:else}
          <Volume />
        {/if}
      </Button>
      {#snippet dropdown()}
        <DropdownMenu>
          <DropdownItem>
            <input
              type='range'
              min='0'
              max='1'
              step='0.01'
              bind:value={$volume}
              disabled={$muted}
              class='w-28'
            />
          </DropdownItem>
        </DropdownMenu>
      {/snippet}
    </Dropdown>

    <div class='flex items-center gap-10'>
      <SkipBack class='cursor-pointer' />
      <Play size='32' class={`cursor-pointer ${paused ? 'block' : 'hidden'}`} onclick={togglePaused} />
      <Pause size='32' class={`cursor-pointer ${paused ? 'hidden' : 'block'}`} onclick={togglePaused} />
      <SkipForward class='cursor-pointer' />
    </div>

    <Dropdown oncommand={handleCommand}>
      <Button iconButton variant='transparent'>
        <Ellipsis />
      </Button>
      {#snippet dropdown()}
        <DropdownMenu>
          <DropdownItem command='a'>
            歌曲信息
          </DropdownItem>
          <DropdownItem command='b'>
            原始歌词文件
          </DropdownItem>
        </DropdownMenu>
      {/snippet}
    </Dropdown>
  </div>
</div>
