import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import Dropdown from './Dropdown.svelte'

// 面板内容用原生片段复刻 DropdownMenu/DropdownItem 的真实 DOM 形态：
// data-command 挂在条目按钮上，图标元素没有——委托必须沿祖先链回溯才能命中
const dropdownMenu = createRawSnippet(() => ({
  render: () => `
    <ul class='flex flex-col gap-1'>
      <li class='contents'>
        <button data-command='edit' type='button'>
          <span data-testid='item-icon'>icon</span>
          <span>编辑</span>
        </button>
      </li>
    </ul>
  `,
}))

const trigger = createRawSnippet(() => ({
  render: () => '<button type="button">触发</button>',
}))

describe('dropdown 事件委托（M19）', () => {
  it('点击条目图标（无 data-command 的后代）仍命中命令', async () => {
    const oncommand = vi.fn()
    render(Dropdown, {
      props: { trigger: 'click', oncommand, dropdown: dropdownMenu, children: trigger },
    })

    // 先打开面板，再点击图标
    fireEvent.click(screen.getByText('触发'))
    fireEvent.click(screen.getByTestId('item-icon'))

    expect(oncommand).toHaveBeenCalledTimes(1)
    expect(oncommand).toHaveBeenCalledWith('edit')
  })
})
