import axios from 'axios';

let inMemoryToken: string | null = null;

export function setApiToken(token: string | null) {
  inMemoryToken = token;
}

export function getApiToken(): string | null {
  return inMemoryToken;
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});
