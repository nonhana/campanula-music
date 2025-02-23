import debounce from 'debounce'

export function useDebounce() {
  const debouncer = <T>(getter: () => T, wait: number, immediate: boolean = false) => {
    let current = $state<T>()
    const update = debounce(v => current = v, wait, { immediate })
    $effect(() => update(getter()))

    return () => current as T
  }

  return debouncer
}
