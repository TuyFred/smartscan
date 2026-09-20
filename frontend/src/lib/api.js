import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartscan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      // keep silent for optional endpoints
    }
    return Promise.reject(err);
  }
);

export const formatRwf = (n) =>
  `${Number(n || 0).toLocaleString('en-RW')} RWF`;

export default api;
