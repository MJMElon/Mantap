export type Access = 'none' | 'view' | 'edit';

/** A worker as returned by the server (never includes the password hash). */
export interface Worker {
  id: number;
  name: string;
  email: string;
  estates: string[];
  permissions: Record<string, unknown>;
  status: 'active' | 'inactive';
  lastActive: string | null;
  /** true for an MJM Intranet user with mobile access (signs in from the Intranet) */
  intranet?: boolean;
}

/** Shape the legacy Stock module expects in localStorage. */
export interface WorkerSession {
  id: number;
  email: string;
  name: string;
  estates: string[];
  estate: string;
  role: 'estate_user';
  permissions: Record<string, unknown>;
}
