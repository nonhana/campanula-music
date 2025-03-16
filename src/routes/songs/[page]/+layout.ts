import type { LayoutLoad } from './$types'

export const load = (({ data }) => {
  return {
    ...data,
  }
}) satisfies LayoutLoad
