<!-- PROTOTYPE · 操作后的轻提示（只在听众做了操作之后出现）。 -->
<script lang='ts'>
  import { ui } from './ui.svelte'

  interface Props {
    bottom: number
  }

  const { bottom }: Props = $props()
</script>

<div class='toast-wrap' style:bottom='{bottom}px' aria-live='polite'>
  {#if ui.toast}
    <p class='toast'>{ui.toast}</p>
  {/if}
</div>

<style>
  .toast-wrap {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 90;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .toast {
    margin: 0;
    padding: 9px 16px;
    border-radius: 9999px;
    background: #111827;
    color: #fff;
    font-size: 13px;
    line-height: 18px;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    animation: up 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
