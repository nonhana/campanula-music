import { writable } from 'svelte/store'

export interface MessageOptions {
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  timeout?: number
}

export interface MessageItem extends MessageOptions {
  id: number
}

export const messages = writable<MessageItem[]>([])

let idCounter = 0

export function addMessage(options: MessageOptions) {
  const id = idCounter++
  const newMessage = {
    id,
    message: options.message || '默认消息',
    type: options.type || 'info',
    timeout: options.timeout || 3000,
  }

  messages.update((messages) => {
    return [...messages, newMessage]
  })

  setTimeout(() => {
    messages.update(messages => messages.filter(m => m.id !== id))
  }, newMessage.timeout + 300)
}
