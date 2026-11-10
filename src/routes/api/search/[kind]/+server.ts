import { searchPage } from '#lib/api/endpoints.js';
import { searches } from '#lib/server/netease.js';
import {
  readKeywords,
  readOffset,
  readSearchKind,
} from '#lib/server/request.js';
import { respondSignedIn } from '#lib/server/session.js';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies }) => {
  const kind = readSearchKind(params.kind);
  const keywords = readKeywords(url.searchParams.get('keywords'));
  const offset = readOffset(url.searchParams.get('offset'));
  return respondSignedIn(searchPage(kind), cookies, (listener) =>
    searches[kind](keywords, offset, listener),
  );
};
