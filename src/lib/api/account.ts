/** 当前登录的网易云账号；曲库副本按 id 区分。昵称、头像网易云没给时是 null（#78） */
export interface Account {
  id: number
  nickname: string | null
  avatarUrl: string | null
}

/** 没有登录 Cookie 时是 null，不调网易云；凭据失效回需要登录（ErrorBody） */
export interface AccountResponse {
  account: Account | null
}
