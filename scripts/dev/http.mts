import { Buffer } from 'node:buffer';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const requestURL = (
  url: string,
  {
    method = 'GET',
    headers = {},
    body,
    ca,
  }: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    ca?: string | Buffer;
  } = {},
): Promise<Response> =>
  new Promise((resolve, reject) => {
    const address = new URL(url);
    const request = (
      address.protocol === 'https:' ? httpsRequest : httpRequest
    )(
      address,
      {
        method,
        headers,
        ca,
        ...(address.protocol === 'https:'
          ? { servername: address.hostname }
          : {}),
        ...(address.hostname.endsWith('.test')
          ? {
              family: 4,
              lookup: (_name, _options, callback) =>
                callback(null, '127.0.0.1', 4),
            }
          : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.once('error', reject);
        response.once('end', () => {
          const received = new Headers();
          for (let i = 0; i < response.rawHeaders.length; i += 2)
            received.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode,
              headers: received,
            }),
          );
        });
      },
    );
    request.setTimeout(15_000, () =>
      request.destroy(new Error(`HTTP 超时：${url}`)),
    );
    request.once('error', reject);
    request.end(body);
  });
