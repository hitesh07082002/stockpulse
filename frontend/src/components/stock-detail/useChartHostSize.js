import { useEffect, useRef, useState } from 'react';

export function useChartHostSize() {
  const hostRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const updateSize = () => {
      setChartSize({
        width: host.clientWidth || 0,
        height: host.clientHeight || 0,
      });
    };

    updateSize();

    let observer = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(host);
    } else {
      window.addEventListener('resize', updateSize);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, []);

  return {
    hostRef,
    chartSize,
    isCompact: chartSize.width > 0 && chartSize.width < 520,
  };
}
