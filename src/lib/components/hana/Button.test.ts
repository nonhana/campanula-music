import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Button from './Button.svelte'

const label = createRawSnippet(() => ({ render: () => '<span>按钮</span>' }))

describe('button class 归一化（LOW·class 污染）', () => {
  it('数组 class 以空格拼接，不产生逗号污染', () => {
    const { container } = render(Button, {
      props: { class: ['flex', 'gap-2', 'justify-center'], children: label },
    })
    const button = container.querySelector('button')

    expect(button?.className).toContain('flex gap-2 justify-center')
    expect(button?.className).not.toContain(',')
  })

  it('字符串 class 原样保留', () => {
    const { container } = render(Button, {
      props: { class: 'w-full', children: label },
    })
    const button = container.querySelector('button')

    expect(button?.className).toContain('w-full')
  })
})

describe('button 锚点禁用态（LOW）', () => {
  it('href 分支禁用时补 aria-disabled', () => {
    const { container } = render(Button, {
      props: { href: '/search', disabled: true, children: label },
    })
    const anchor = container.querySelector('a')

    expect(anchor?.getAttribute('aria-disabled')).toBe('true')
  })
})
