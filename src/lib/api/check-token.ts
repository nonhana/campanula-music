export const CHECK_TOKENS_HEADER = 'x-campanula-check-tokens';

export const CHECK_TOKEN = /^[\x21-\x7E]{1,1024}$/;

export interface CheckTokens {
  requests: string[];
  renewal?: string;
}
