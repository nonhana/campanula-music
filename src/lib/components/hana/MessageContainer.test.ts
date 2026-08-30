import { addMessage, messages } from '$lib/stores'
import { cleanup, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MessageContainer from './MessageContainer.svelte'

// jsdom 未实现 Element.animate（Web Animations）：消息进出场 fly/flip 过渡不抛错
Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation)

afterEach(() => {
  cleanup()
  // addMessage 的自动消失定时器不依赖测试推进：直接清空 store 防止串扰
  messages.set([])
})

describe('消息容器（M24）', () => {
  it('容器具备 role=status 与 aria-live=polite，读屏可感知', () => {
    render(MessageContainer)

    const container = screen.getByRole('status')
    expect(container.getAttribute('aria-live')).toBe('polite')
  })

  it('消息渲染于唯一容器内', async () => {
    render(MessageContainer)
    addMessage({ message: '绑定成功', type: 'success' })
    await tick()

    const containers = screen.getAllByRole('status')
    expect(containers).toHaveLength(1)
    expect(containers[0]!.textContent).toContain('绑定成功')
  })
})
