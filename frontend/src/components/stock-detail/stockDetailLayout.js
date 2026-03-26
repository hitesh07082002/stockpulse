const CHART_HEIGHT_PRESETS = {
  price: 'h-[280px] sm:h-[320px] lg:h-[400px] xl:h-[460px]',
  projection: 'h-[280px] sm:h-[320px] lg:h-[360px] xl:h-[400px]',
  panel: 'h-[280px] sm:h-[320px] lg:h-[360px]',
};

export function getChartHeightClasses(preset = 'panel') {
  return CHART_HEIGHT_PRESETS[preset] || CHART_HEIGHT_PRESETS.panel;
}
