import Link from 'next/link';

export default function Home() {
  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 border-b border-white/10 pb-6">
          <p className="mb-1 text-sm font-medium text-cyan-300">Workspace</p>
          <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
            eBay Listing App
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Manage imports, product cleanup, and eBay publishing from one dashboard.
          </p>
        </div>

        <nav className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href="/dashboard"
            className="min-h-11 rounded-lg bg-cyan-400 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 sm:w-auto"
          >
            Dashboard
          </Link>

          <Link
            href="/import"
            className="min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/10 sm:w-auto"
          >
            Go to Import
          </Link>

          <Link
            href="/products"
            className="min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-white/10 sm:w-auto"
          >
            View Products
          </Link>
        </nav>
      </div>
    </div>
  );
}
