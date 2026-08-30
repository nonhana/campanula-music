import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Input from './Input.svelte'

afterEach(() => {
  cleanup()
})

describe('输入框', () => {
  it('显式 id 透传给 input 与 label 的 for', () => {
    const { container } = render(Input, { label: '昵称', id: 'custom-id' })

    expect(container.querySelector('input')!.id).toBe('custom-id')
    expect(container.querySelector('label')!.getAttribute('for')).toBe('custom-id')
  })

  it('未传 id 时自动生成：双渲染各自稳定且互不相同', () => {
    const a = render(Input, { label: '甲' })
    const b = render(Input, { label: '乙' })

    const aId = a.container.querySelector('input')!.id
    const bId = b.container.querySelector('input')!.id
    expect(aId).toBeTruthy()
    expect(bId).toBeTruthy()
    expect(aId).not.toBe(bId)
    // label 的 for 指向同实例的 input，不串到其他实例
    expect(a.container.querySelector('label')!.getAttribute('for')).toBe(aId)
    expect(b.container.querySelector('label')!.getAttribute('for')).toBe(bId)
  })

  it('同一实例重渲染后 id 保持一致（SSR/水合一致性的客户端等价）', async () => {
    const { container, rerender } = render(Input, { label: '占位', placeholder: 'x' })

    const before = container.querySelector('input')!.id
    await rerender({ label: '改名', placeholder: 'y' })

    expect(container.querySelector('input')!.id).toBe(before)
  })
})
