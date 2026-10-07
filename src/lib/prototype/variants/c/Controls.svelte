<!-- PROTOTYPE（变体 C）：播放页的五个控制键，靠形状和深浅分主次：
  播放/暂停 = 最大的深薄荷圆；上一首/下一首 = 浅薄荷圆；循环/随机 = 只有图标。 -->
<script lang='ts'>
  import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from '@lucide/svelte'
  import { player, playModeLabel } from '$lib/prototype/player.svelte'

  interface Props {
    phone?: boolean
  }

  const { phone = false }: Props = $props()

  function repeat() {
    player.mode = player.mode === 'loop' ? 'one' : 'loop'
  }

  function shuffle() {
    player.mode = player.mode === 'shuffle' ? 'loop' : 'shuffle'
  }
</script>

<div class='controls' class:phone>
  <button type='button' class='plain' class:on={player.mode !== 'shuffle'} aria-label='循环：{player.mode === 'one' ? playModeLabel.one : playModeLabel.loop}' aria-pressed={player.mode !== 'shuffle'} onclick={repeat}>
    {#if player.mode === 'one'}<Repeat1 size={20} aria-hidden='true' />{:else}<Repeat size={20} aria-hidden='true' />{/if}
  </button>
  <button type='button' class='tonal' aria-label='上一首' onclick={() => player.prev()}>
    <SkipBack size={phone ? 24 : 20} fill='currentColor' aria-hidden='true' />
  </button>
  <button type='button' class='main' aria-label={player.playing ? '暂停' : '播放'} onclick={() => player.toggle()}>
    {#if player.playing}
      <Pause size={phone ? 30 : 26} fill='currentColor' aria-hidden='true' />
    {:else}
      <Play size={phone ? 30 : 26} fill='currentColor' class='translate-x-[2px]' aria-hidden='true' />
    {/if}
  </button>
  <button type='button' class='tonal' aria-label='下一首' onclick={() => player.next()}>
    <SkipForward size={phone ? 24 : 20} fill='currentColor' aria-hidden='true' />
  </button>
  <button type='button' class='plain' class:on={player.mode === 'shuffle'} aria-label='随机播放' aria-pressed={player.mode === 'shuffle'} onclick={shuffle}>
    <Shuffle size={20} aria-hidden='true' />
  </button>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  button {
    display: grid;
    place-items: center;
    border-radius: 999px;
    transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 160ms;
  }

  button:active {
    transform: scale(0.94);
  }

  .plain {
    width: 40px;
    height: 40px;
    color: #6b7280;
    position: relative;
  }

  .plain.on {
    color: #206f52;
  }

  /* 开着的那一个下面一个小点，不只靠颜色 */
  .plain.on::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 999px;
    background: currentColor;
  }

  .tonal {
    width: 48px;
    height: 48px;
    background: #e8f8f1;
    color: #1a5b43;
  }

  .main {
    width: 64px;
    height: 64px;
    background: #1a5b43;
    color: #fff;
    box-shadow: 0 6px 16px -6px rgb(26 91 67 / 0.45);
  }

  .phone .plain {
    width: 48px;
    height: 48px;
  }

  .phone .tonal {
    width: 60px;
    height: 60px;
  }

  .phone .main {
    width: 76px;
    height: 76px;
  }

  @media (hover: hover) and (pointer: fine) {
    .plain:hover {
      background: #e8f8f1;
    }

    .tonal:hover {
      background: #d1f1e3;
    }

    .main:hover {
      background: #206f52;
    }
  }
</style>
