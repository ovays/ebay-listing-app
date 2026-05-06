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
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              eBay account
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
              Dashboard
            </h1>
          </div>

          {ebaySession ? (
            <form action="/api/auth/logout" method="post" className="w-full sm:w-auto">
              <button className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100 sm:w-auto">
                Log out
              </button>
            </form>
          ) : (
            <Link
              href="/api/ebay/login"
              className="min-h-11 w-full rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              Connect eBay
            </Link>
          )}
        </div>

        {authStatus === 'success' && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            eBay connected successfully. Tokens are stored server-side and are
            not exposed to the browser.
          </div>
        )}

        {authStatus === 'error' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {authMessage ?? 'eBay login failed. Please try again.'}
          </div>
        )}

        {authStatus === 'logged-out' && (
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            You have been logged out.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">Auth state</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="break-words font-medium">
                  {ebaySession ? 'Connected' : 'Not connected'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Environment</dt>
                <dd className="break-words font-medium">
                  {ebaySession?.environment ?? 'Unavailable'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Refresh token</dt>
                <dd className="break-words font-medium">
                  {ebaySession?.hasRefreshToken ? 'Stored encrypted' : 'None'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">Token metadata</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Access expires</dt>
                <dd className="break-words font-medium sm:text-right">
                  {ebaySession?.accessTokenExpiresAt ?? 'Unavailable'}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-slate-500">Refresh expires</dt>
                <dd className="break-words font-medium sm:text-right">
                  {ebaySession?.refreshTokenExpiresAt ?? 'Unavailable'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <nav className="grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href="/products"
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100 sm:w-auto"
          >
            View products
          </Link>
          <Link
            href="/import"
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100 sm:w-auto"
          >
            Import products
          </Link>
        </nav>
      </section>
    </main>
  );
}
