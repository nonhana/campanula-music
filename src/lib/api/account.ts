export interface Account {
  id: number;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface AccountResponse {
  account: Account | null;
}
