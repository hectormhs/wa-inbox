import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getApiBase } from '../api.js';

export function useSocket(token, handlers) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(getApiBase(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('🟢 Socket connected'));
    socket.on('disconnect', () => console.log('🔴 Socket disconnected'));

    if (handlers.onNewMessage) socket.on('new_message', handlers.onNewMessage);
    if (handlers.onMessageStatus) socket.on('message_status', handlers.onMessageStatus);
    if (handlers.onConversationUpdated) socket.on('conversation_updated', handlers.onConversationUpdated);
    if (handlers.onConversationCreated) socket.on('conversation_created', handlers.onConversationCreated);
    if (handlers.onAgentStatus) socket.on('agent_status', handlers.onAgentStatus);
    if (handlers.onTyping) socket.on('typing', handlers.onTyping);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const emitTyping = useCallback((conversationId) => {
    socketRef.current?.emit('typing', { conversation_id: conversationId });
  }, []);

  return { emitTyping };
}
