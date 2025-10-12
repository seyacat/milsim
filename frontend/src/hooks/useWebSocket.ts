import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../services/auth';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: (gameId: number) => void;
  disconnect: () => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback((gameId: number) => {
    if (socketRef.current) {
      return; // Already connected
    }

    const token = AuthService.getToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const newSocket = io(wsUrl, {
      auth: {
        token: token
      }
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Listen for successful connection
    newSocket.on('connect', () => {
      setIsConnected(true);
      
      // Join game room
      newSocket.emit('joinGame', { gameId });
    });

    // Listen for disconnection
    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      
      if (reason === 'io server disconnect' || reason === 'transport close') {
        console.log('Unexpected disconnection');
      }
    });

    // Listen for connection errors
    newSocket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    connect,
    disconnect
  };
};