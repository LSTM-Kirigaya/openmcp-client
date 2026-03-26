export type BackendCommonResponse<T = any> = {
  code: number;
  message: string;
  data: T;
};

export type Project = {
  id: string;
  name: string;
  creator_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    username: string;
    email?: string;
    avatar_url?: string | null;
  };
};

export type ProjectInvite = {
  id: string;
  project_id: string;
  invite_code: string;
  creator_id: string;
  role: string;
  expires_at?: string | null;
  max_uses?: number | null;
  use_count?: number | null;
  is_revoked?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type SpecCase = {
  id: string;
  project_id: string;
  parent_id?: string | null;
  node_type: string;
  level: number;
  type: string;
  name: string;
  input?: string;
  output?: string;
  created_at?: string;
  updated_at?: string;
  children?: SpecCase[];
};

