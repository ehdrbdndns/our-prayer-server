export interface UserType {
  user_id: string;
  email: string;
  oauth_email: string;
  oauth_provider: string;
  name: string;
  profile: string;
  updated_date: string;
  created_date: string;
}

export interface UserState {
  user_state_id: string;
  user_id: string;
  role: 'admin' | 'counselor' | 'user';
  status: 'active' | 'inactive' | 'banned';
  alarm: boolean;
  updated_date: string;
  created_date: string;
}

export interface RefreshToken {
  refresh_token_id: string;
  user_id: string;
  token: string;
  expires_date: string;
}