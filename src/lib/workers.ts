import { adminSupabase, callFunction } from './supabase';
import type { Worker } from './types';

// All worker changes go through the mantap-worker-admin Edge Function,
// which checks that the caller is the Super Admin.
const call = <T>(body: Record<string, unknown>) => callFunction<T>(adminSupabase, 'mantap-worker-admin', body);

export const listWorkers = () => call<{ workers: Worker[]; estates: string[] }>({ action: 'list' });

export const createWorker = (w: { userId: string; name: string; password: string; estates: string[]; access: Record<string, string> }) =>
  call<{ ok: true }>({ action: 'create', ...w });

export const updateWorker = (id: number, w: { name: string; estates: string[]; access: Record<string, string> }) =>
  call<{ ok: true }>({ action: 'update', id, ...w });

export const resetWorkerPassword = (id: number, password: string) =>
  call<{ ok: true }>({ action: 'reset_password', id, password });

export const setWorkerStatus = (id: number, status: 'active' | 'inactive') =>
  call<{ ok: true }>({ action: 'set_status', id, status });

export const deleteWorker = (id: number) => call<{ ok: true }>({ action: 'delete', id });
