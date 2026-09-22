import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [socket, setSocket] = useState(null);

  const triggerPaymentRequest = useCallback((payload) => {
    if (!payload) {
      setPaymentRequest(null);
      return;
    }
    setPaymentRequest({
      authorizationId: payload.authorizationId || 'local-dev-demo',
      customer: payload.customer || user || {},
      session: payload.session || { session_code: 'LOCAL-DEV' },
      amountToPay: Number(payload.amountToPay || 0),
      cardBalance: Number(payload.cardBalance || 0),
      cardUid: payload.cardUid || 'LOCAL-DEV',
    });
  }, [user]);

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
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : 'https://smartscan-p8j6.onrender.com');
    const s = io(socketUrl, {
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
    // Re-join rooms after reconnect so cashier RFID events keep arriving on hosted apps
    s.io.on('reconnect', joinUserRoom);
    s.on('payment:request', (payload) => triggerPaymentRequest(payload));
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
  }, [user?.id, user?.supermarketId]);

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
      triggerPaymentRequest,
      refreshMe,
      logout,
      loginWithToken,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, socket, paymentRequest, refreshMe, logout, triggerPaymentRequest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
