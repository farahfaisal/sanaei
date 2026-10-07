import type { UserRole } from '@/lib/auth/roles';

export interface UserProfile {
  id: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  location: string | null;
  created_at: string;
  updated_at: string;
}
