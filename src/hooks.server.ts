import type { HandleServerError } from '@sveltejs/kit'
import useMessage from '$lib/hooks/useMessage'

const { callHanaMessage } = useMessage()

// export function handleError({ error }: { error: Error }) {
//   callHanaMessage({ type: 'error', message: error.message })

//   return { message: error.message }
// }

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const errorId = Math.random().toString(16).slice(2)

  callHanaMessage({ type: 'error', message: error.message })

  return {
    message: 'Whoops!',
    errorId,
  }
}
