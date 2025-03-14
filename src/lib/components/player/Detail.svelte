<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownItem from '$lib/components/hana/DropdownItem.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import {
    mute,
    muted,
    nowPlaying,
    paused,
    setPaused,
    volume,
  } from '$lib/stores'
  import {
    Ellipsis,
    Music,
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
  }

  const {
    currentProgress,
    handleInput,
    handleChange,
    handlePointerDown,
  }: Props = $props()

  const handleCommand = (command: string | number | object) => {
    console.log(command)
  }
</script>

<div class='h-[40rem] flex flex-col justify-between'>
  {#if $nowPlaying}
    <LazyImage
      src={$nowPlaying.album.cover}
      alt={$nowPlaying.name}
      class='size-[27rem] rounded-2xl object-cover'
    />
  {:else}
    <div class='size-[27rem] flex items-center justify-center rounded-2xl bg-white/60 text-neutral'>
      <Music size={128} />
    </div>
  {/if}
  <div class='flex flex-col gap-2'>
    <span class='text-xl font-semibold'>{$nowPlaying?.name ?? '未在播放'}</span>
    {#if $nowPlaying?.alias}
      <span class='text-neutral font-semibold'>{$nowPlaying.alias.join(' / ')}</span>
    {/if}
    {#if $nowPlaying}
      <span class='text-sm text-neutral'>{$nowPlaying.artists.map(artist => artist.name).join(' / ')}</span>
    {/if}
  </div>
  <input
    type='range'
    disabled={!$nowPlaying}
    min='0'
    max='1'
    step='0.001'
    value={currentProgress}
    oninput={handleInput}
    onchange={handleChange}
    onpointerdown={handlePointerDown}
    class='w-full'
  />
  <div class='w-full flex items-center justify-between text-neutral'>
    <Dropdown clickClose={false}>
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
      <Play size='32' class={`cursor-pointer ${$paused ? 'block' : 'hidden'}`} onclick={() => setPaused(false)} />
      <Pause size='32' class={`cursor-pointer ${$paused ? 'hidden' : 'block'}`} onclick={() => setPaused(true)} />
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
