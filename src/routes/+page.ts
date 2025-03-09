// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
import type { PageLoad } from './$types'

export const prerender = true

export const load = (({ data }) => {
  return {
    ...data,
  }
}) satisfies PageLoad
