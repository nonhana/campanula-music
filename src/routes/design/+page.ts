import { dev } from '$app/environment'
import { error } from '@sveltejs/kit'

// 设计系统页只在开发时打开，用来看颜色、字号、组件各状态和两种骨架；部署出去的实例里没有这一页
export function load() {
  if (!dev)
    error(404, 'Not found')
}
