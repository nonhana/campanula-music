import { hasScrollbar } from '$lib/utils'

export function useToggleScrollable() {
  let isScrollableDisabled = $state(false)

  const disableScroll = () => {
    if (isScrollableDisabled)
      return
    if (hasScrollbar()) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'
    isScrollableDisabled = true
  }

  const enableScroll = () => {
    if (!isScrollableDisabled)
      return
    document.body.style.paddingRight = ''
    document.body.style.overflow = ''
    isScrollableDisabled = false
  }

  const toggleScrollable = (disable: boolean) => {
    if (disable) {
      disableScroll()
    }
    else {
      enableScroll()
    }
  }

  return {
    isScrollableDisabled,
    disableScroll,
    enableScroll,
    toggleScrollable,
  }
}
