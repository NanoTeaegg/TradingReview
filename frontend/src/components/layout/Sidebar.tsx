import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  ListOrdered,
  Lightbulb,
  FileText,
  BookOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, end: true },
  { to: '/holdings', label: '持仓', icon: Briefcase },
  { to: '/pnl', label: '盈亏', icon: TrendingUp },
  { to: '/trades', label: '流水', icon: ListOrdered },
  { to: '/intents', label: '交易意图', icon: Lightbulb },
  { to: '/reviews', label: '复盘报告', icon: FileText },
  { to: '/rules', label: '交易规则', icon: BookOpen },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-bg-sidebar)',
        borderRight: '1px solid var(--color-border-subtle)',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-4"
        style={{ height: 64, borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          TradingReview
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 px-4 h-11 text-sm transition-all duration-[120ms] group select-none',
                isActive
                  ? 'font-medium'
                  : 'font-normal'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active left indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                    style={{ height: 20, background: 'var(--color-primary)' }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  style={{
                    color: isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-text-tertiary)',
                    transition: 'color var(--motion-fast)',
                  }}
                  className="group-hover:[color:var(--color-text-secondary)]"
                />
                <span
                  style={{
                    color: isActive
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                    transition: 'color var(--motion-fast)',
                  }}
                  className="group-hover:[color:var(--color-text-primary)]"
                >
                  {label}
                </span>
                {/* Hover background */}
                <span
                  className={cn(
                    'absolute inset-0 rounded-sm transition-opacity duration-[120ms]',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  style={{
                    background: isActive
                      ? 'var(--color-bg-surface-selected)'
                      : 'var(--color-border-subtle)',
                  }}
                  aria-hidden
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings — bottom fixed */}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 px-4 h-11 text-sm transition-all duration-[120ms] group select-none',
              isActive ? 'font-medium' : 'font-normal'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{ height: 20, background: 'var(--color-primary)' }}
                />
              )}
              <Settings
                size={20}
                strokeWidth={1.5}
                style={{
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                }}
                className="group-hover:[color:var(--color-text-secondary)]"
              />
              <span
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
                className="group-hover:[color:var(--color-text-primary)]"
              >
                设置
              </span>
              <span
                className={cn(
                  'absolute inset-0 rounded-sm transition-opacity duration-[120ms]',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                style={{
                  background: isActive
                    ? 'var(--color-bg-surface-selected)'
                    : 'var(--color-border-subtle)',
                }}
                aria-hidden
              />
            </>
          )}
        </NavLink>
      </div>
    </aside>
  )
}
