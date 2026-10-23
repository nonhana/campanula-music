import { dev } from '$app/env'
import { error } from '@sveltejs/kit'

// 开发时加载设计系统页；生产只保留返回 404 的路由薄壳，不构建设计页主体（#61）。
export function load() {
  if (!dev)
    error(404, 'Not found')
}
