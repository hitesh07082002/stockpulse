import { useEffect, useState } from 'react';

function getMatches(minWidth) {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth >= minWidth;
}

export function useMinWidth(minWidth) {
  const [matches, setMatches] = useState(() => getMatches(minWidth));

  useEffect(() => {
    function handleResize() {
      setMatches(getMatches(minWidth));
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [minWidth]);

  return matches;
}
