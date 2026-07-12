export interface User {
  user_id: number;
  display_name: string;
  email: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
