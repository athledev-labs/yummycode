import { useEffect, useState } from 'react';

export interface Route {
  view: 'picker' | 'session' | 'debrief';
  sessionId?: string;
}

function parse(pathname: string): Route {
  const debrief = pathname.match(/^\/session\/([^/]+)\/debrief\/?$/);
  if (debrief) return { view: 'debrief', sessionId: debrief[1] };
  const session = pathname.match(/^\/session\/([^/]+)\/?$/);
  if (session) return { view: 'session', sessionId: session[1] };
  return { view: 'picker' };
}

/** Tiny history-based router. Keeps refresh and back-button working. */
export function useRoute(): [Route, (path: string) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setRoute(parse(path));
  };

  return [route, navigate];
}
