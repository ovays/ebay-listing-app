'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'D' },
  { label: 'Products (Draft)', href: '/products', icon: 'D' },
  { label: 'Published', href: '/products/published', icon: 'P' },
  { label: 'Errors', href: '/products/errors', icon: 'E' },
  { label: 'Import', href: '/import', icon: 'I' },
  { label: 'Settings', href: '/settings', icon: 'S' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-white/10 bg-slate-950/95 px-4 py-4 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center justify-between gap-4 lg:block">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-400 text-sm font-bold text-slate-950">
            EB
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              eBay Listing
            </span>
            <span className="block truncate text-xs text-slate-500">
              Inventory workspace
            </span>
          </span>
        </Link>
      </div>

      <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-8 lg:grid-cols-1">
        {menuItems.map((item) => {
          const isActive =
            item.href === '/products'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                  isActive ? 'bg-slate-950/10' : 'bg-white/5'
                }`}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm lg:block">
        <p className="font-medium text-white">Marketplace ops</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Import, validate, and publish products from one dashboard.
        </p>
      </div>
    </aside>
  );
}
