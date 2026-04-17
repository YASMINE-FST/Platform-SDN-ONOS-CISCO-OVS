/**
 * Cisco Devices API Routes (Next.js Proxy)
 * These routes proxy requests from the frontend to the FastAPI backend
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function proxyRequest(endpoint: string, options: RequestInit = {}) {
  try {
    const url = `${BACKEND_URL}/api/cisco${endpoint}`;
    console.log(`[Cisco API] Proxying: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      console.error(`[Cisco API] Error: ${response.status} ${response.statusText}`);
      const errorData = await response.json().catch(() => ({}));
      return {
        error: true,
        status: response.status,
        message: errorData.detail || response.statusText,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('[Cisco API] Fetch error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// GET /api/route.ts for each endpoint

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Extract the endpoint from /api/cisco/...
  const endpoint = pathname.replace('/api/cisco', '');

  // Query params
  const query = url.search ? `?${url.searchParams.toString()}` : '';

  const result = await proxyRequest(`${endpoint}${query}`);

  if (result.error) {
    return Response.json(result, { status: result.status || 500 });
  }

  return Response.json(result);
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const endpoint = pathname.replace('/api/cisco', '');

  try {
    const body = await request.json();
    const result = await proxyRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    if (result.error) {
      return Response.json(result, { status: result.status || 500 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: true, message: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const endpoint = pathname.replace('/api/cisco', '');

  try {
    const body = await request.json();
    const result = await proxyRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result.error) {
      return Response.json(result, { status: result.status || 500 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: true, message: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const endpoint = pathname.replace('/api/cisco', '');

  try {
    const body = await request.json().catch(() => ({}));
    const result = await proxyRequest(endpoint, {
      method: 'DELETE',
      ...(Object.keys(body).length > 0 && { body: JSON.stringify(body) }),
    });

    if (result.error) {
      return Response.json(result, { status: result.status || 500 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: true, message: 'Delete failed' },
      { status: 500 }
    );
  }
}
