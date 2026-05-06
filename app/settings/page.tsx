export default function SettingsPage() {
  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-6 border-b border-white/10 pb-6">
          <p className="mb-1 text-sm font-medium text-cyan-300">Workspace</p>
          <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Configure account defaults, publishing preferences, and marketplace options.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30">
            <h2 className="text-lg font-semibold text-white">Account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              eBay connection and session controls will live here.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30">
            <h2 className="text-lg font-semibold text-white">Defaults</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Shipping, payment, and return policy defaults will live here.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30">
            <h2 className="text-lg font-semibold text-white">Automation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Import and publishing automation settings will live here.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
