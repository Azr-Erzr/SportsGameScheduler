import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, PropsWithChildren } from 'react'

// Thin shadcn-style primitives against the theme tokens. Deliberately minimal: we copy in
// heavier shadcn components (dialog, sheet, tabs...) only when a screen actually needs them.

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'solid' | 'ghost' | 'export' | 'subtle' | 'danger'

// Neon fills carry void-dark text (broadcast rule: neon is light, so type goes dark).
const buttonStyles: Record<ButtonVariant, string> = {
  solid: 'bg-primary text-void font-bold hover:opacity-90 shadow-[0_0_22px_color-mix(in_srgb,var(--mp-primary)_30%,transparent)]',
  ghost: 'border border-primary/30 bg-transparent text-primary hover:bg-primary/10',
  export: 'bg-export text-void font-bold hover:opacity-90 shadow-[0_0_22px_color-mix(in_srgb,var(--mp-export)_30%,transparent)]',
  subtle: 'bg-primary/12 text-primary hover:bg-primary/20',
  danger: 'border border-flap-chg/50 bg-transparent text-flap-chg hover:bg-flap-chg/10',
}

export function Button({
  variant = 'solid',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-card border border-primary/15 bg-surface p-4 shadow-sm', className)}
      {...props}
    />
  )
}

export function PanelHeading({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm normal-case tracking-normal text-ink/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Badge({
  tone = 'primary',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'primary' | 'secondary' | 'warning' | 'muted' }) {
  const tones = {
    primary: 'bg-primary/12 text-primary border border-primary/30',
    secondary: 'bg-primary text-void',
    warning: 'bg-flap-tbd/12 text-flap-tbd border border-flap-tbd/50',
    muted: 'bg-ink/8 text-ink/60 border border-ink/15',
  }
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone], className)}
      {...props}
    />
  )
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-ink/70">{label}</span>
      <input
        className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        {...props}
      />
    </label>
  )
}

export function EmptyState({
  title,
  body,
  children,
}: PropsWithChildren<{ title: string; body: string }>) {
  return (
    <Panel className="p-10 text-center">
      <h3 className="text-lg font-bold text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{body}</p>
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </Panel>
  )
}
