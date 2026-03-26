import { useCallback, useEffect, useState } from 'react';

export function useChartHostSize() {
  const [hostNode, setHostNode] = useState(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const hostRef = useCallback((node) => {
    setHostNode(node);
  }, []);

  useEffect(() => {
    const host = hostNode;
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
  }, [hostNode]);

  return {
    hostRef,
    hostNode,
    chartSize,
    isCompact: chartSize.width > 0 && chartSize.width < 520,
  };
}
