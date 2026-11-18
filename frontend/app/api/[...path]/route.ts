import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeBaseUrl(raw: string, defaultScheme: 'http' | 'https'): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `${defaultScheme}://${trimmed}`;
}

function getApiGatewayCandidates(): string[] {
  const candidates: string[] = [];
  if (process.env.API_GATEWAY_URL) {
    candidates.push(normalizeBaseUrl(process.env.API_GATEWAY_URL, 'http'));
  }
  if (process.env.API_GATEWAY_HOSTPORT) {
    candidates.push(normalizeBaseUrl(process.env.API_GATEWAY_HOSTPORT, 'http'));
  }
  if (process.env.API_GATEWAY_HOST) {
    const rawHost = process.env.API_GATEWAY_HOST.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const fullHost =
      process.env.RENDER === 'true' && rawHost && !rawHost.includes('.')
        ? `${rawHost}.onrender.com`
        : rawHost;
    candidates.push(normalizeBaseUrl(fullHost, 'https'));
  }
  if (process.env.RENDER === 'true') {
    candidates.push('https://socialflow-api-gateway.onrender.com');
  }
  if (candidates.length === 0) {
    candidates.push('http://localhost:8088');
  }
  return Array.from(new Set(candidates));
}

const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

async function proxyToGateway(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const joinedPath = Array.isArray(path) ? path.join('/') : '';
  const candidates = getApiGatewayCandidates();

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    const targetUrl = `${baseUrl}/api/${joinedPath}${req.nextUrl.search}`;
    try {
      const upstreamRes = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: hasBody && bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
        redirect: 'manual',
        cache: 'no-store',
      });

      const responseHeaders = new Headers();
      upstreamRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== 'set-cookie') {
          responseHeaders.set(key, value);
        }
      });

      // Preserve all Set-Cookie headers (e.g. HttpOnly JWT cookie from AuthController)
      const getSetCookie = (upstreamRes.headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie;
      if (typeof getSetCookie === 'function') {
        for (const cookie of getSetCookie.call(upstreamRes.headers)) {
          responseHeaders.append('set-cookie', cookie);
        }
      } else {
        const singleCookie = upstreamRes.headers.get('set-cookie');
        if (singleCookie) {
          responseHeaders.append('set-cookie', singleCookie);
        }
      }

      const resBody = await upstreamRes.arrayBuffer();
      return new NextResponse(resBody, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'Unknown gateway connection error';
  return NextResponse.json(
    {
      status: 503,
      error: 'Gateway Unreachable',
      message: `לא ניתן להתחבר לשער ה-API (${detail}). ודא ששירותי השרת פעילים.`,
    },
    { status: 503 }
  );
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToGateway(req, context);
}
