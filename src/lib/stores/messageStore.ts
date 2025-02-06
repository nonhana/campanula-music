import { writable } from 'svelte/store'

export interface MessageOptions {
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  timeout?: number
}

export interface MessageItem extends MessageOptions {
  id: number
}

const { subscribe, update } = writable<MessageItem[]>([])

let idCounter = 0

function addMessage(options: MessageOptions) {
  const id = idCounter++
  const newMessage: MessageItem = {
    id,
    message: options.message || '默认消息',
    type: options.type || 'info',
    timeout: options.timeout || 3000,
  }

  update((messages) => {
    return [...messages, newMessage]
  })

  setTimeout(() => {
    update(messages => messages.filter(m => m.id !== id))
  }, newMessage.timeout)
}

export const messageStore = {
  subscribe,
  addMessage,
}
