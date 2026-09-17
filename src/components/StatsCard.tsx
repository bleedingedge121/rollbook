import React from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'blue',
}) => {
  const variantStyles = {
    blue: 'border-blue-500/20 bg-blue-950/20 text-blue-400',
    emerald: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400',
    amber: 'border-amber-500/20 bg-amber-950/20 text-amber-400',
    rose: 'border-rose-500/20 bg-rose-950/20 text-rose-400',
    slate: 'border-slate-800 bg-slate-900/40 text-slate-400',
  }

  return (
    <div className="bg-[#131b2e] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-2 tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1.5 font-medium">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl border ${variantStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
