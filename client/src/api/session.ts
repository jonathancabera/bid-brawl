import { request } from './client';
import { setToken } from './auth';
import type { LoginResponse, User } from '../types/user';

export async function login(email: string, password: string): Promise<User> {
  const res = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setToken(res.token);
  return res.user;
}

export async function register(
  email: string,
  password: string,
  display_name: string,
): Promise<User> {
  const res = await request<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name }),
  });

  setToken(res.token);
  return res.user;
}
