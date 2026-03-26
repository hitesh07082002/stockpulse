import React from 'react';
import { joinClasses } from '../../utils/joinClasses';

export function ChartToolbarRail({ children, className = '' }) {
  return (
    <div className={joinClasses('-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none', className)}>
      <div className="flex w-max gap-2">
        {children}
      </div>
    </div>
  );
}

export function ChartReadoutRow({ children, className = '' }) {
  return (
    <div className={joinClasses('flex min-w-0 flex-wrap gap-2', className)}>
      {children}
    </div>
  );
}

export function ChartActionRow({ children, className = '' }) {
  return (
    <div className={joinClasses('flex flex-wrap items-center gap-2 xl:justify-end', className)}>
      {children}
    </div>
  );
}

export function ChartWorkspaceShell({
  toolbar = null,
  readout = null,
  actions = null,
  chart = null,
  state = null,
  bleedChart = false,
}) {
  const chartContent = state || chart;

  return (
    <div className="flex flex-col gap-4">
      {(toolbar || readout || actions) ? (
        <div className="flex flex-col gap-4">
          {toolbar}
          {(readout || actions) ? (
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              {readout ? <ChartReadoutRow>{readout}</ChartReadoutRow> : <div />}
              {actions ? <ChartActionRow>{actions}</ChartActionRow> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {chartContent ? (
        bleedChart ? (
          <div className="-mx-4 sm:mx-0">
            {chartContent}
          </div>
        ) : chartContent
      ) : null}
    </div>
  );
}

export function ResponsiveSplitPanel({
  primary,
  secondary,
  secondaryFirstOnMobile = false,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
}) {
  return (
    <div
      className={joinClasses(
        'grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-start',
        className,
      )}
    >
      <div className={joinClasses(secondaryFirstOnMobile ? 'order-2 xl:order-1' : '', primaryClassName)}>
        {primary}
      </div>
      <div className={joinClasses(secondaryFirstOnMobile ? 'order-1 xl:order-2' : '', secondaryClassName)}>
        {secondary}
      </div>
    </div>
  );
}
