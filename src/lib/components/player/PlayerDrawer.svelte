<script lang='ts'>
  import Detail from './Detail.svelte'

  interface Props {
    showDrawer: boolean
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handlePointerDown: () => void
    paused: boolean
    togglePaused: () => void
  }

  const {
    showDrawer,
    currentProgress,
    handleInput,
    handleChange,
    handlePointerDown,
    paused,
    togglePaused,
  }: Props = $props()
</script>

{#if showDrawer}
  <div class='z-30 absolute top-0 left-0 w-full h-full bg-neutral-200/40 backdrop-blur flex justify-center items-center'>
    <Detail
      currentProgress={currentProgress}
      handleInput={handleInput}
      handleChange={handleChange}
      handlePointerDown={handlePointerDown}
      paused={paused}
      togglePaused={togglePaused}
    />
  </div>
{/if}
