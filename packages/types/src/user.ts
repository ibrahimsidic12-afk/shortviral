export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  plan: UserPlan;
  /** Monthly clip credits remaining */
  credits: number;
  /** Total clips generated all-time */
  totalClips: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
