import { fireEvent, render } from '@testing-library/svelte'
import { createRawSnippet, tick } from 'svelte'
import { describe, expect, it } from 'vitest'
import Tooltip from './Tooltip.svelte'

const children = createRawSnippet(() => ({
  render: () => '<button type="button">触发</button>',
}))

// 面板元素带 z-10 定位类，据此定位
function panel(container: HTMLElement) {
  const el = container.querySelector('.z-10')
  if (!el)
    throw new Error('Tooltip 面板未找到')
  return el
}

describe('tooltip 触发语义（M25）', () => {
  it('click 触发：触发器具备 role=button 与 tabindex=0，面板不再带按钮语义', () => {
    const { container } = render(Tooltip, {
      props: { trigger: 'click', content: '提示', children },
    })

    const triggers = container.querySelectorAll('[role="button"]')
    expect(triggers).toHaveLength(1)
    expect(triggers[0].getAttribute('tabindex')).toBe('0')
    expect(panel(container).getAttribute('role')).not.toBe('button')
    expect(panel(container).hasAttribute('tabindex')).toBe(false)
  })

  it('hover 触发（默认）：触发器是普通元素，无 role 与 tabindex', () => {
    const { container } = render(Tooltip, {
      props: { content: '提示', children },
    })

    expect(container.querySelector('[role="button"]')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
  })

  it('click 触发时 Space 可打开面板', async () => {
    const { container } = render(Tooltip, {
      props: { trigger: 'click', content: '提示', children },
    })
    const triggerEl = container.querySelector('[role="button"]')
    if (!triggerEl)
      throw new Error('触发器未找到')

    // 关闭态面板带 md:hidden，打开后该类被移除
    expect(panel(container).className).toContain('md:hidden')
    fireEvent.keyDown(triggerEl, { key: ' ' })
    await tick()

    expect(panel(container).className).not.toContain('md:hidden')
  })
})
