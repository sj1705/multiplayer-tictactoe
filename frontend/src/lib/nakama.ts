import { Client, Session, type Socket } from '@heroiclabs/nakama-js';

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || window.location.hostname;
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || 'defaultkey';

let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
  }
  return client;
}

export async function authenticate(nickname: string): Promise<Session> {
  const c = getClient();

  // Device-based auth with persistent ID
  let deviceId = localStorage.getItem('nakama_device_id');
  if (!deviceId) {
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('nakama_device_id', deviceId);
  }

  session = await c.authenticateDevice(deviceId, true, nickname);

  // Update display name if different
  if (session.username !== nickname) {
    await c.updateAccount(session, { display_name: nickname, username: nickname + '_' + deviceId.slice(0, 4) });
  }

  return session;
}

export function getSession(): Session | null {
  return session;
}

export async function connectSocket(): Promise<Socket> {
  if (!session) throw new Error('Not authenticated');
  const c = getClient();
  socket = c.createSocket(NAKAMA_USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export async function rpc<T>(id: string, payload?: unknown): Promise<T> {
  const c = getClient();
  if (!session) throw new Error('Not authenticated');
  const result = await c.rpc(session, id, payload ?? {});
  const p = result.payload;
  if (typeof p === 'string') {
    return JSON.parse(p) as T;
  }
  return p as T;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect(true);
    socket = null;
  }
}
