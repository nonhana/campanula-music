import { writable } from 'svelte/store'

export const scrolled = writable(false)

export function setScrolled(value: boolean) {
  scrolled.set(value)
}
