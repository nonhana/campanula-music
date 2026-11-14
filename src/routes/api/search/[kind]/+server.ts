import { searchPage } from '#lib/api/endpoints.ts';
import { searches } from '#lib/server/netease/search.ts';
import {
  readKeywords,
  readOffset,
  readSearchKind,
} from '#lib/server/request.ts';
import { respondSignedIn } from '#lib/server/session.ts';

import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ params, url, cookies, request }) => {
  const kind = readSearchKind(params.kind);
  const keywords = readKeywords(url.searchParams.get('keywords'));
  const offset = readOffset(url.searchParams.get('offset'));
  return respondSignedIn(
    searchPage(kind),
    { cookies, request },
    (config) => searches[kind](keywords, offset, config),
    { retryRead: true },
  );
};
