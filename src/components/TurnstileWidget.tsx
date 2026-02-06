import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
    __operitTurnstilePromise?: Promise<void>;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const loadTurnstile = (): Promise<void> => {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (window.__operitTurnstilePromise) {
    return window.__operitTurnstilePromise;
  }

  window.__operitTurnstilePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile_load_failed'));
    document.head.appendChild(script);
  });

  return window.__operitTurnstilePromise;
};

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark';
}

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ siteKey, onVerify, onExpire, theme }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderWidget = async () => {
      if (!siteKey || !containerRef.current) return;
      try {
        await loadTurnstile();
      } catch {
        return;
      }
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onExpire?.(),
      });
    };

    renderWidget();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onVerify, onExpire, theme]);

  return <div ref={containerRef} />;
};

export default TurnstileWidget;
