import { setSelectedMenu } from '$lib/stores'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MenuFixture from './Menu.fixture.svelte'

// Menu/MenuItem 直接读写全局 selectedMenu store，用例后复位避免串扰
afterEach(() => {
  cleanup()
  setSelectedMenu('lyrics')
})

describe('menu onselect 回调时机（M10）', () => {
  it('挂载零回调：激活态同步不再触发 onselect', async () => {
    const onselect = vi.fn()
    render(MenuFixture, { props: { onselect } })
    await tick()

    expect(onselect).not.toHaveBeenCalled()
  })

  it('点击条目回调恰好一次', async () => {
    const onselect = vi.fn()
    render(MenuFixture, { props: { onselect } })
    await tick()

    fireEvent.click(screen.getByText('播放列表'))
    await tick()

    expect(onselect).toHaveBeenCalledTimes(1)
    expect(onselect).toHaveBeenCalledWith('playlist')
  })

  it('连续点击不同条目，每次点击各回调一次', async () => {
    const onselect = vi.fn()
    render(MenuFixture, { props: { onselect } })
    await tick()

    fireEvent.click(screen.getByText('播放列表'))
    await tick()
    fireEvent.click(screen.getByText('歌词'))
    await tick()

    expect(onselect).toHaveBeenCalledTimes(2)
  })
})
