export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          Ebay Listing App
        </h1>

        <nav className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
          <a
            href="/dashboard"
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm sm:w-auto"
          >
            Dashboard
          </a>

          <a
            href="/import"
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm sm:w-auto"
          >
            Go to Import
          </a>

          <a
            href="/products"
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm sm:w-auto"
          >
            View Products
          </a>
        </nav>
      </div>
    </main>
  );
}
