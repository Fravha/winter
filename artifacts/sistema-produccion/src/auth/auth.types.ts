export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type WinterUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
};

export type AuthMeResponse = WinterUser;
