import React from 'react';
import { getChartHeightClasses } from './stockDetailLayout';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function StockDetailSection({
  title,
  subtitle,
  actions = null,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  flush = false,
}) {
  return (
    <section className={joinClasses('rounded-2xl border border-border bg-surface', className)}>
      {(title || subtitle || actions) ? (
        <div
          className={joinClasses(
            'flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 lg:px-6',
            headerClassName,
          )}
        >
          <div className="flex min-w-0 flex-col gap-1">
            {title ? (
              <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="font-body text-sm text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div
        className={joinClasses(
          flush ? '' : 'flex flex-col gap-4',
          'px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function StockDetailMetricGrid({ children, className = '' }) {
  return (
    <div
      className={joinClasses(
        'grid gap-3 rounded-xl border border-border bg-elevated p-4 sm:grid-cols-2 xl:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StockDetailMetricCard({
  label,
  value,
  supporting = null,
  className = '',
  valueClassName = '',
}) {
  return (
    <div className={joinClasses('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="font-body text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
      <div className={joinClasses('font-data text-2xl text-text-primary', valueClassName)}>
        {value}
      </div>
      {supporting ? (
        <div className="font-body text-xs text-text-tertiary">{supporting}</div>
      ) : null}
    </div>
  );
}

export function StockDetailStatePanel({
  message,
  tone = 'default',
  height = 'panel',
  className = '',
}) {
  const toneClass = tone === 'error'
    ? 'border-error text-error'
    : 'border-border text-text-secondary';

  return (
    <div
      className={joinClasses(
        'flex items-center justify-center rounded-xl border bg-surface px-6 text-center',
        getChartHeightClasses(height),
        toneClass,
        className,
      )}
    >
      <p className="font-body text-base">{message}</p>
    </div>
  );
}

export function StockDetailChartStage({
  children,
  preset = 'panel',
  className = '',
}) {
  return (
    <div
      className={joinClasses(
        'min-w-0 w-full overflow-hidden rounded-xl',
        getChartHeightClasses(preset),
        className,
      )}
    >
      {children}
    </div>
  );
}
