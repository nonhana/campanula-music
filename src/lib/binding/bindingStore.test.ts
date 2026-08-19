import { messages } from '$lib/stores/messageStore'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bindingInvalid, clearBindingInvalid, markBindingInvalid } from './bindingStore'

describe('bindingStore', () => {
  beforeEach(() => {
    clearBindingInvalid()
    messages.set([])
  })

  afterEach(() => {
    clearBindingInvalid()
    messages.set([])
  })

  it('标记失效：置位横幅并弹出一条全局提示', () => {
    markBindingInvalid()

    expect(get(bindingInvalid)).toBe(true)
    expect(get(messages)).toHaveLength(1)
    expect(get(messages)[0]).toMatchObject({ type: 'error' })
  })

  it('重复标记不重复弹提示（并发请求去重）', () => {
    markBindingInvalid()
    markBindingInvalid()
    markBindingInvalid()

    expect(get(messages)).toHaveLength(1)
  })

  it('清除后重新武装：下一次失效可再次提示', () => {
    markBindingInvalid()
    clearBindingInvalid()
    markBindingInvalid()

    expect(get(messages)).toHaveLength(2)
  })

  it('清除复位横幅标记', () => {
    markBindingInvalid()
    clearBindingInvalid()

    expect(get(bindingInvalid)).toBe(false)
  })
})
