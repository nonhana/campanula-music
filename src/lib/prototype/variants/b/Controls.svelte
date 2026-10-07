<!--
  PROTOTYPE · 播放页的五个控制键：播放/暂停最大最深（实心墨色圆），上一首/下一首是描边圆，
  循环/随机是最轻的纯图标；开启时换成墨绿并在下方点一个小点。
-->
<script lang='ts'>
  import { player, playModeLabel } from '$lib/prototype/player.svelte'
  import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from '@lucide/svelte'

  interface Props {
    touch?: boolean
  }

  const { touch = false }: Props = $props()

  const big = $derived(touch ? 72 : 64)
  const mid = $derived(touch ? 56 : 48)

  function toggleRepeat() {
    player.mode = player.mode === 'one' ? 'loop' : 'one'
  }

  function toggleShuffle() {
    player.mode = player.mode === 'shuffle' ? 'loop' : 'shuffle'
  }
</script>

<div class={['controls', touch && 'touch']} style:--big='{big}px' style:--mid='{mid}px'>
  <button
    type='button'
    class={['light', player.mode === 'one' && 'on']}
    aria-label={player.mode === 'one' ? '单曲循环，点按改为列表循环' : `${playModeLabel[player.mode === 'shuffle' ? 'shuffle' : 'loop']}，点按改为单曲循环`}
    aria-pressed={player.mode === 'one'}
    onclick={toggleRepeat}
  >
    {#if player.mode === 'one'}
      <Repeat1 size={20} strokeWidth={2} />
    {:else}
      <Repeat size={20} strokeWidth={2} />
    {/if}
  </button>
  <button type='button' class='ring' aria-label='上一首' onclick={() => player.prev()}>
    <SkipBack size={touch ? 22 : 20} strokeWidth={2} />
  </button>
  <button type='button' class='main' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
    {#if player.playing}
      <Pause size={touch ? 28 : 26} strokeWidth={2.25} fill='currentColor' />
    {:else}
      <Play size={touch ? 28 : 26} strokeWidth={2.25} fill='currentColor' class='nudge' />
    {/if}
  </button>
  <button type='button' class='ring' aria-label='下一首' onclick={() => player.next()}>
    <SkipForward size={touch ? 22 : 20} strokeWidth={2} />
  </button>
  <button
    type='button'
    class={['light', player.mode === 'shuffle' && 'on']}
    aria-label={player.mode === 'shuffle' ? '随机播放，点按改为列表循环' : '点按改为随机播放'}
    aria-pressed={player.mode === 'shuffle'}
    onclick={toggleShuffle}
  >
    <Shuffle size={20} strokeWidth={2} />
  </button>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  button {
    display: grid;
    place-items: center;
    flex: none;
    border-radius: 9999px;
    transition: background-color 160ms, color 160ms, transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  button:active {
    transform: scale(0.94);
  }

  .main {
    width: var(--big);
    height: var(--big);
    background: #111827;
    color: #fff;
    box-shadow: 0 2px 6px rgb(17 24 39 / 0.12), 0 12px 28px -10px rgb(17 24 39 / 0.35);
  }

  .main :global(.nudge) {
    transform: translateX(2px);
  }

  .ring {
    width: var(--mid);
    height: var(--mid);
    border: 1.5px solid rgb(17 24 39 / 0.16);
    color: #1f2937;
  }

  .light {
    position: relative;
    width: 44px;
    height: 44px;
    color: #6b7280;
  }

  .light.on {
    color: #206f52;
  }

  .light.on::after {
    content: '';
    position: absolute;
    bottom: 6px;
    left: 50%;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 9999px;
    background: currentColor;
  }

  @media (hover: hover) and (pointer: fine) {
    .ring:hover {
      background: rgb(255 255 255 / 0.7);
      border-color: rgb(17 24 39 / 0.24);
    }

    .light:hover {
      color: #1f2937;
    }

    .main:hover {
      background: #1f2937;
    }
  }
</style>
