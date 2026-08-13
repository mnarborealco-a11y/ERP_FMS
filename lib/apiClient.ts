// Thin wrapper around the Supabase client's RPC surface. Every business-logic
// action lives in a Postgres function (see the `supabase/` migrations) and is
// invoked here by name, e.g. callApi('matters_complete_step1', { p_matter_id }).
// Direct table/view reads (holidays, active_employees, and any RLS-scoped
// `matters`/`independent_tasks`/etc. selects) go straight through
// the `supabase` client exported from `./supabaseClient` instead of this file.

import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Database } from '@/types/supabase';

export type ErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'SERVER_ERROR' | 'NETWORK_ERROR';

export class ApiError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// RPC functions raise `RAISE EXCEPTION '<CODE>: <message>'`, which PostgREST
// surfaces as a PostgrestError whose `message` starts with that same "CODE: "
// prefix. Parse it back out so callers can branch on `.code` like before.
const KNOWN_CODES: ErrorCode[] = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'CONFLICT', 'SERVER_ERROR'];

function normalizeError(error: PostgrestError): ApiError {
  const match = KNOWN_CODES.find((code) => error.message.startsWith(code + ': '));
  if (match) {
    return new ApiError(match, error.message.slice(match.length + 2), error.details);
  }
  if (error.code === 'PGRST301' || error.code === '42501') {
    return new ApiError('FORBIDDEN', error.message, error.details);
  }
  return new ApiError('SERVER_ERROR', error.message, error.details);
}

export type RpcName = keyof Database['public']['Functions'];

export async function callApi<T = unknown>(
  fn: RpcName,
  params?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params as never);
  if (error) throw normalizeError(error);
  return data as T;
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
