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

export interface UserStateType {
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

export interface BibleType {
  bible_quote_id: string;
  title: string;
  content: string;
  created_date: string;
}

export interface PrayerHistoryType {
  prayer_history_id: string;
  user_id: string;
  lecture_id: string;
  duration: number;
  note: string;
  created_date: number;
  updated_date: number;
}

export interface PlanType {
  plan_id: string;
  title: string;
  description: string;
  author_name: string;
  author_description: string;
  author_profile: string;
  thumbnail: string;
  s_thumbnail: string;
  is_active: boolean;
  created_date: number; // UTC timestamp
  updated_date: number; // UTC timestamp
}

export interface PlanLikeType {
  plan_like_id: string;
  user_id: string;
  plan_id: string;
  created_date: string;
}

export interface Session {
  user_id: string;
}