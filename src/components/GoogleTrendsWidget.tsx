import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    trends?: {
      embed: {
        renderExploreWidgetTo: (
          container: HTMLElement,
          type: string,
          url: string,
          config: any
        ) => void;
      };
    };
  }
}

export const GoogleTrendsWidget: React.FC<{ topic: string }> = ({ topic }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear container
    containerRef.current.innerHTML = '';

    const renderWidget = () => {
      if (window.trends && window.trends.embed && containerRef.current) {
        window.trends.embed.renderExploreWidgetTo(
          containerRef.current,
          "TIMESERIES",
          JSON.stringify({"comparisonItem":[{"keyword":topic,"geo":"US","time":"today 1-m"}],"category":0,"property":""}),
          {"exploreQuery":`date=today 1-m&geo=US&q=${encodeURIComponent(topic)}`,"guestPath":"https://trends.google.com:443/trends/embed/"}
        );
      }
    };

    if (window.trends && window.trends.embed) {
      renderWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://ssl.gstatic.com/trends_nrtr/3962_RC01/embed_loader.js';
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }
  }, [topic]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[200px] overflow-hidden bg-white"
    />
  );
};