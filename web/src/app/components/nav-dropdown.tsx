'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { AppNavigationItem } from './app-navigation';
import { isAppNavigationItemActive } from './app-navigation';

type NavDropdownProps = {
  label: string;
  items: AppNavigationItem[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function NavDropdown({
  label,
  items,
  isOpen,
  onOpen,
  onClose,
}: NavDropdownProps) {
  const pathname = usePathname();

  const hasActiveItem = items.some((item) =>
    isAppNavigationItemActive(pathname, item.href),
  );

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onMouseEnter={onOpen}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
          hasActiveItem
            ? 'border-accent/40 bg-accent/15 text-foreground shadow-[0_10px_26px_-18px_rgba(245,158,11,0.6)]'
            : 'border-transparent text-muted hover:border-border hover:bg-surface-strong/60 hover:text-foreground'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-full z-[60] w-[280px] -translate-x-1/2 pt-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-[1.5rem] border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isAppNavigationItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group flex items-start gap-3 rounded-2xl p-3 transition-all ${
                      active
                        ? 'bg-accent/12 text-foreground'
                        : 'hover:bg-surface hover:text-white'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active
                          ? 'bg-accent/20 text-accent-strong'
                          : 'bg-surface-strong text-muted group-hover:bg-surface-muted group-hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none mb-1">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted leading-tight line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
