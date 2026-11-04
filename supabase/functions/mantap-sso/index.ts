// Sign-in from MJM Intranet (Intranet "level 2: token redirect").
//   { token } → { session, portal: { email, name, web, mobile }, worker | null }
// The Intranet sends people to Mantap with ?gw_token=<60-second token>. We
// redeem it once with the Intranet's gw-check-access (server to server, with
// the module API key), then check Mantap's own User Access list.
import {
  ApiError, getPortalUser, handler, issueSession, serviceClient, toWorkerSession,
  USERS_TABLE, type UserRow,
} from '../_shared/common.ts';

const INTRANET_URL = Deno.env.get('INTRANET_SUPABASE_URL') ?? 'https://briqzyxfxsvulyizzbiu.supabase.co';
const API_KEY = Deno.env.get('INTRANET_MODULE_API_KEY') ?? '';

interface CheckResult {
  allowed: boolean;
  user?: { id: string; email: string; full_name?: string };
  error?: string;
}

async function redeem(token: string): Promise<CheckResult> {
  if (!API_KEY) throw new ApiError('err_sso_not_set_up', 500);
  const res = await fetch(`${INTRANET_URL}/functions/v1/gw-check-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gw-api-key': API_KEY },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError('err_sso_invalid', 401);
  return body as CheckResult;
}

Deno.serve(handler(async (_req, body) => {
  const token = String(body.token ?? '');
  if (!token || token.length > 4000) throw new ApiError('err_sso_invalid', 400);

  const check = await redeem(token);
  if (!check.allowed || !check.user?.email) throw new ApiError('err_forbidden', 403);
  const email = check.user.email.toLowerCase();

  const portal = await getPortalUser(email);
  if (!portal || (!portal.web_access && !portal.mobile_access)) throw new ApiError('err_no_portal_access', 403);

  // Keep name / Intranet id up to date
  await serviceClient().from('mantap_portal_users').update({
    name: check.user.full_name ?? portal.name, intranet_user_id: check.user.id, updated_at: new Date().toISOString(),
  }).eq('email', email);

  let worker = null;
  if (portal.mobile_access) {
    const { data } = await serviceClient().from(USERS_TABLE).select('*').eq('email', email).maybeSingle();
    if (data && (data as UserRow).status !== 'inactive') worker = toWorkerSession(data as UserRow);
  }

  const session = await issueSession(email, { name: check.user.full_name ?? portal.name, intranet_user_id: check.user.id });
  return {
    session,
    portal: { email, name: check.user.full_name ?? portal.name, web: portal.web_access, mobile: portal.mobile_access && !!worker },
    worker,
  };
}));
