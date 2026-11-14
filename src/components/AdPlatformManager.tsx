import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdBannerUnit, AdPlatformConfig, AdProviderId, User } from '../types';

export interface AdPlatformRuntimeConfig {
  provider: AdProviderId;
  enabled: boolean;
  directLinkUrl: string;
  inPageScriptUrl: string;
  popunderScriptUrl: string;
  nativeContainerId: string;
  nativeScriptUrl: string;
  bannerTop: AdBannerUnit;
  bannerBottom: AdBannerUnit;
  updatedAt: string;
}

export const AD_PLATFORM_STORAGE_KEY = 'metany_local_ad_config';
export const AD_PLATFORM_UPDATED_EVENT = 'metany:ad-platform-updated';

export function readLocalAdConfig(): AdPlatformConfig | null {
  try {
    const raw = localStorage.getItem(AD_PLATFORM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdPlatformConfig;
  } catch {
    return null;
  }
}

export function trackLocalAdEvent(type: 'impression' | 'direct_link_click') {
  try {
    const cfg = readLocalAdConfig();
    if (!cfg) return;
    if (!cfg.stats) cfg.stats = { impressions: 0, directLinkClicks: 0 };
    if (type === 'impression') {
      cfg.stats.impressions = (cfg.stats.impressions || 0) + 1;
    } else if (type === 'direct_link_click') {
      cfg.stats.directLinkClicks = (cfg.stats.directLinkClicks || 0) + 1;
    }
    cfg.stats.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(AD_PLATFORM_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota issues
  }
}

interface AdPlatformManagerProps {
  effectiveUser: User | null;
  onConfigLoaded?: (config: AdPlatformRuntimeConfig | null) => void;
}

export const AdPlatformManager: React.FC<AdPlatformManagerProps> = ({
  effectiveUser,
  onConfigLoaded,
}) => {
  const [config, setConfig] = useState<AdPlatformRuntimeConfig | null>(null);
  const trackedSignatureRef = useRef<string>('');

  const loadConfig = useCallback(() => {
    const parsed = readLocalAdConfig();
    setConfig(parsed);
    onConfigLoaded?.(parsed);
  }, [onConfigLoaded]);

  useEffect(() => {
    loadConfig();
    const handleUpdated = () => loadConfig();
    window.addEventListener(AD_PLATFORM_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener(AD_PLATFORM_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadConfig]);

  // Inject runtime scripts strictly for non-Admin, non-VIP users when configured
  useEffect(() => {
    const removeScripts = () => {
      document
        .querySelectorAll('script[data-metany-ad-unit]')
        .forEach((node) => node.remove());
    };

    const shouldShowAds = Boolean(
      config?.enabled &&
        effectiveUser &&
        !effectiveUser.isAdmin &&
        !effectiveUser.isVIP &&
        !effectiveUser.hideAds
    );

    if (!shouldShowAds || !config) {
      removeScripts();
      return;
    }

    removeScripts();

    const scriptsToLoad: Array<{ unit: string; src: string }> = [];
    if (config.inPageScriptUrl) {
      scriptsToLoad.push({ unit: 'in-page', src: config.inPageScriptUrl });
    }
    if (config.popunderScriptUrl) {
      scriptsToLoad.push({ unit: 'popunder', src: config.popunderScriptUrl });
    }

    for (const item of scriptsToLoad) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = item.src;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.setAttribute('data-metany-ad-unit', item.unit);
      document.body.appendChild(script);
    }

    const hasAnyAd =
      scriptsToLoad.length > 0 ||
      Boolean(config.directLinkUrl) ||
      Boolean(config.nativeContainerId && config.nativeScriptUrl) ||
      Boolean(config.bannerTop?.enabled && (config.bannerTop.key || config.bannerTop.invokeUrl)) ||
      Boolean(config.bannerBottom?.enabled && (config.bannerBottom.key || config.bannerBottom.invokeUrl));

    if (hasAnyAd) {
      const sig = `${effectiveUser?.id}:${config.updatedAt}`;
      if (trackedSignatureRef.current !== sig) {
        trackedSignatureRef.current = sig;
        trackLocalAdEvent('impression');
      }
    }

    return () => {
      removeScripts();
    };
  }, [config, effectiveUser]);

  return null;
};

interface AdBannerSlotProps {
  banner?: AdBannerUnit;
  nativeConfig?: {
    containerId: string;
    scriptUrl: string;
  };
}

export const AdBannerSlot: React.FC<AdBannerSlotProps> = ({ banner, nativeConfig }) => {
  const nativeHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = nativeHostRef.current;
    if (!host) return;
    host.innerHTML = '';

    if (!nativeConfig?.containerId || !nativeConfig?.scriptUrl) {
      return;
    }

    const containerDiv = document.createElement('div');
    containerDiv.id = nativeConfig.containerId;
    host.appendChild(containerDiv);

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = nativeConfig.scriptUrl;
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
    };
  }, [nativeConfig?.containerId, nativeConfig?.scriptUrl]);

  if (nativeConfig?.containerId && nativeConfig?.scriptUrl) {
    return <div ref={nativeHostRef} className="w-full flex justify-center overflow-x-auto py-1" />;
  }

  if (!banner?.enabled) return null;

  if (banner.mode === 'aads_unit' && banner.key) {
    const safeUnit = encodeURIComponent(banner.key);
    return (
      <div className="w-full flex justify-center overflow-x-auto">
        <iframe
          title={`aads-unit-${safeUnit}`}
          data-aa={banner.key}
          src={`https://acceptable.a-ads.com/${safeUnit}/?size=Adaptive`}
          style={{
            border: 0,
            padding: 0,
            width: '100%',
            maxWidth: `${banner.width || 728}px`,
            height: `${banner.height || 90}px`,
            overflow: 'hidden',
            display: 'block',
            margin: 'auto',
          }}
        />
      </div>
    );
  }

  if (banner.mode === 'script_url' && banner.invokeUrl) {
    const safeInvoke = banner.invokeUrl.replace(/"/g, '&quot;');
    const safeWidth = Number(banner.width) || 728;
    const safeHeight = Number(banner.height) || 90;
    const srcDoc = `<!doctype html>
<html>
  <head><base target="_blank" /></head>
  <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:transparent;overflow:hidden;">
    <script type="text/javascript" src="${safeInvoke}" data-cfasync="false"></script>
  </body>
</html>`;
    return (
      <div className="w-full flex justify-center overflow-x-auto">
        <iframe
          title="ad-banner-script-frame"
          srcDoc={srcDoc}
          width={safeWidth}
          height={safeHeight}
          scrolling="no"
          frameBorder={0}
          className="border-0 max-w-full"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    );
  }

  if (banner.key && banner.invokeUrl) {
    const safeKey = JSON.stringify(banner.key);
    const safeWidth = Number(banner.width) || 728;
    const safeHeight = Number(banner.height) || 90;
    const safeInvoke = banner.invokeUrl.replace(/"/g, '&quot;');

    const srcDoc = `<!doctype html>
<html>
  <head><base target="_blank" /></head>
  <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:transparent;overflow:hidden;">
    <script type="text/javascript">
      atOptions = {
        'key': ${safeKey},
        'format': 'iframe',
        'height': ${safeHeight},
        'width': ${safeWidth},
        'params': {}
      };
    </script>
    <script type="text/javascript" src="${safeInvoke}"></script>
  </body>
</html>`;

    return (
      <div className="w-full flex justify-center overflow-x-auto">
        <iframe
          title={`ad-banner-${banner.key}`}
          srcDoc={srcDoc}
          width={safeWidth}
          height={safeHeight}
          scrolling="no"
          frameBorder={0}
          className="border-0 max-w-full"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    );
  }

  return null;
};
