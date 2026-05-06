import Link from 'next/link';
import { getSessionIdFromCookies } from '@/lib/auth/session';
import { getEbayTokenSummary } from '@/lib/ebay/token-store';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const authStatus = getParam(params, 'auth');
  const authMessage = getParam(params, 'message');
  const sessionId = await getSessionIdFromCookies();
  const ebaySession = sessionId ? await getEbayTokenSummary(sessionId) : null;

  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-300">
              eBay account
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Monitor connection health and move quickly into product import and publishing.
            </p>
          </div>

          {ebaySession ? (
            <form action="/api/auth/logout" method="post" className="w-full sm:w-auto">
              <button className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/10 sm:w-auto">
                Log out
              </button>
            </form>
          ) : (
            <Link
              href="/api/ebay/login"
              className="min-h-11 w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 sm:w-auto"
            >
              Connect eBay
            </Link>
          )}
        </div>

        {authStatus === 'success' && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            eBay connected successfully. Tokens are stored server-side and are
            not exposed to the browser.
          </div>
        )}

        {authStatus === 'error' && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {authMessage ?? 'eBay login failed. Please try again.'}
          </div>
        )}

        {authStatus === 'logged-out' && (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
            You have been logged out.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section className="min-w-0 rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Auth state</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="break-words font-medium text-slate-100">
                  {ebaySession ? 'Connected' : 'Not connected'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Environment</dt>
                <dd className="break-words font-medium text-slate-100">
                  {ebaySession?.environment ?? 'Unavailable'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Refresh token</dt>
                <dd className="break-words font-medium text-slate-100">
                  {ebaySession?.hasRefreshToken ? 'Stored encrypted' : 'None'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="min-w-0 rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Token metadata</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Access expires</dt>
                <dd className="break-words font-medium text-slate-100 sm:text-right">
                  {ebaySession?.accessTokenExpiresAt ?? 'Unavailable'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Refresh expires</dt>
                <dd className="break-words font-medium text-slate-100 sm:text-right">
                  {ebaySession?.refreshTokenExpiresAt ?? 'Unavailable'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <nav className="grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href="/products"
            className="min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/10 sm:w-auto"
          >
            View products
          </Link>
          <Link
            href="/import"
            className="min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/10 sm:w-auto"
          >
            Import products
          </Link>
        </nav>
      </section>
    </div>
  );
}
