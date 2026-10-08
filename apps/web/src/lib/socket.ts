import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    return {} as Socket;
  }

  if (!socketInstance) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const role = localStorage.getItem('cab_active_role') || 'RIDER';
    const userId = localStorage.getItem('cab_active_user_id') || '';

    socketInstance = io(socketUrl, {
      auth: {
        token: `demo_${role.toLowerCase()}`,
        userId,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected to realtime gateway');
    });

    socketInstance.on('disconnect', () => {
      console.log('⚡ Socket disconnected');
    });
  }

  return socketInstance;
}

export function resetSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
