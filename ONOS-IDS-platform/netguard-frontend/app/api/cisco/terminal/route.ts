/**
 * WebSocket Proxy for Cisco Terminal SSH
 * Maps ws://localhost:3000/api/cisco/terminal to ws://localhost:8000/api/cisco/terminal
 */

import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Redirect to WebSocket endpoint on backend
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const host = searchParams.get('host') || '192.168.1.1';
  const port = searchParams.get('port') || '22';
  const username = searchParams.get('username') || 'admin';
  const password = searchParams.get('password') || 'cisco';

  // Return connection info so frontend can connect directly
  return Response.json({
    url: `ws://localhost:8000/api/cisco/terminal?token=${token}&host=${host}&port=${port}&username=${username}&password=${password}`,
  });
}
