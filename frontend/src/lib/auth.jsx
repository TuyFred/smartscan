import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [socket, setSocket] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('smartscan_token');
    setUser(null);
    setPaymentRequest(null);
    if (socket) socket.disconnect();
    setSocket(null);
  }, [socket]);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('smartscan_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data);
      return data.data;
    } catch {
      localStorage.removeItem('smartscan_token');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!user) return undefined;
    const liveSocketUrl = import.meta.env.VITE_SOCKET_URL || 'https://smartscan-p8j6.onrender.com';
    const s = io(liveSocketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 20000,
    });

    const joinUserRoom = () => {
      s.emit('join', { userId: user.id, supermarketId: user.supermarketId });
    };

    const restoreConnection = () => {
      if (!s.connected) s.connect();
    };

    s.on('connect', joinUserRoom);
    joinUserRoom();
    s.on('payment:request', (payload) => setPaymentRequest(payload));
    s.on('payment:success', () => setPaymentRequest(null));
    s.on('card:updated', () => {});

    window.addEventListener('pageshow', restoreConnection);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') restoreConnection();
    });

    setSocket(s);
    return () => {
      window.removeEventListener('pageshow', restoreConnection);
      document.removeEventListener('visibilitychange', restoreConnection);
      s.disconnect();
    };
  }, [user?.id]);

  const loginWithToken = async (token, nextUser) => {
    localStorage.setItem('smartscan_token', token);
    setUser(nextUser);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      socket,
      paymentRequest,
      setPaymentRequest,
      refreshMe,
      logout,
      loginWithToken,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, socket, paymentRequest, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
