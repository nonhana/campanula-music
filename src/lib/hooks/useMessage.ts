import type { MessageOptions } from '$lib/stores'
import { addMessage } from '$lib/stores'

export function useMessage() {
  const callHanaMessage = (options: MessageOptions) => {
    addMessage(options)
  }

  return { callHanaMessage }
}
