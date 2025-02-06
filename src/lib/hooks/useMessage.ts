import type { MessageOptions } from '$lib/stores'
import { messageStore } from '$lib/stores'

export default function useMessage() {
  const callHanaMessage = (options: MessageOptions) => {
    messageStore.addMessage(options)
  }

  return { callHanaMessage }
}
