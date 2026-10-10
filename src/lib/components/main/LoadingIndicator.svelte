<script lang='ts'>
  import { afterNavigate, beforeNavigate } from '$app/navigation'
  import { onDestroy } from 'svelte'

  let isLoading = $state(false)
  let progress = $state(0)
  let show = $state(false)

  const TRANSITION_DURATION_MS = 200
  const FINISH_DELAY_MS = 100
  const PROGRESS_TRANSITION_DURING_NAV_MS = 10000
  const PROGRESS_TRANSITION_FINISH_MS = 150

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  beforeNavigate(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }

    isLoading = true
    show = true
    progress = 0

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isLoading) {
          progress = 95
        }
      })
    })
  })

  afterNavigate(() => {
    if (!isLoading)
      return

    progress = 100

    timeoutId = setTimeout(() => {
      show = false

      setTimeout(() => {
        if (!show) {
          isLoading = false
          progress = 0
        }
      }, TRANSITION_DURATION_MS)

      timeoutId = undefined
    }, FINISH_DELAY_MS)
  })

  onDestroy(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })

  const progressTransitionDuration = $derived(
    isLoading && progress < 100
      ? PROGRESS_TRANSITION_DURING_NAV_MS
      : PROGRESS_TRANSITION_FINISH_MS,
  )

  const progressBarStyle = $derived(
    `width: ${progress}%; transition: width ${progressTransitionDuration}ms cubic-bezier(0.1, 0.5, 0.1, 1);`,
  )

  const containerStyle = $derived(
    `opacity: ${show ? 1 : 0}; transition: opacity ${TRANSITION_DURATION_MS}ms ease-in-out;`,
  )

</script>

{#if isLoading || show}
  <div
    class='fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden'
    style={containerStyle}
    role='progressbar'
    aria-valuenow={progress}
    aria-valuemin='0'
    aria-valuemax='100'
    aria-busy={isLoading}
    aria-hidden={!isLoading && !show}
  >
    <div
      class='h-full bg-primary transition-colors duration-300'
      style={progressBarStyle}
    ></div>
  </div>
{/if}
