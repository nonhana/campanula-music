/**
 * 绑定凭据接入点：解析当前部署账号的 uid 与 cookie。
 *
 * 我的歌单等需要登录账号的接口经此取凭据。
 * 真实实现（本地数据目录凭据文件读取）随 Ticket 02（凭据与绑定引导）落地；
 * 当前绑定层未就绪，恒返回 null（驱动上层呈现「请先绑定」引导态）。
 */
export interface BoundUser {
  /** 绑定账号的网易云用户 id */
  uid: number
  /** 绑定所得 cookie（凭据文件的唯一来源） */
  cookie: string
}

export async function resolveBoundUser(): Promise<BoundUser | null> {
  return null
}
