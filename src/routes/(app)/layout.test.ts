import { cleanup, render, screen } from '@testing-library/svelte'
import { createRawSnippet, tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RootLayout from '../+layout.svelte'
import AppLayout from './+layout.svelte'

// 心跳仅编排网络校验，测试中桩掉避免真实请求；失效状态与心跳逻辑另有专属测试
vi.mock('$lib/binding/heartbeat', () => ({
  runBindingCheck: vi.fn(async () => null),
}))

const page = createRawSnippet(() => ({
  render: () => '<p data-testid="page-content">页面内容</p>',
}))

afterEach(() => {
  cleanup()
})

describe('toast 容器唯一性（M5）', () => {
  it('根布局恰好渲染一个 toast 容器（覆盖 /bind 与全部组页）', async () => {
    render(RootLayout, { props: { children: page } })
    await tick()

    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('(app) 组布局不再渲染 toast 容器（由根布局唯一提供，避免双挂载）', async () => {
    render(AppLayout, { props: { children: page } })
    await tick()

    expect(screen.queryAllByRole('status')).toHaveLength(0)
    expect(screen.getByTestId('page-content')).toBeTruthy()
  })
})
