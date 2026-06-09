import { useMemo } from "react";

export function Sparkline({
  data,
  multiData,
  max,
  color = "var(--color-accent)",
  colors = [],
  height = 60,
  fill = true,
}: {
  data?: number[];
  multiData?: number[][];
  max?: number;
  color?: string;
  colors?: string[];
  height?: number;
  fill?: boolean;
}) {
  const seriesList = useMemo(() => {
    if (multiData && multiData.length > 0) {
      return multiData;
    }
    if (data && data.length > 0) {
      return [data];
    }
    return [];
  }, [data, multiData]);

  const paths = useMemo(() => {
    if (seriesList.length === 0) return [];

    // Find overall maximum
    let computedMax = max;
    if (computedMax === undefined) {
      let absoluteMax = 1;
      seriesList.forEach((arr) => {
        if (arr.length > 0) {
          const arrMax = Math.max(...arr);
          if (arrMax > absoluteMax) absoluteMax = arrMax;
        }
      });
      computedMax = absoluteMax;
    }

    const w = 100;
    const h = 100;

    return seriesList.map((series) => {
      if (series.length === 0) return { d: "", area: "" };
      const step = w / Math.max(series.length - 1, 1);
      let pathD = "";
      let areaD = "";
      
      series.forEach((v, i) => {
        const x = i * step;
        const y = h - (v / computedMax!) * h;
        pathD += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
        areaD += `${i === 0 ? `M ${x.toFixed(2)} ${h}` : ""} L ${x.toFixed(2)} ${y.toFixed(2)} `;
      });

      if (fill) areaD += `L ${w} ${h} L 0 ${h} Z`;

      return { d: pathD, area: areaD };
    });
  }, [seriesList, max, fill]);

  if (seriesList.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
    >
      {paths.map((path, idx) => {
        const strokeColor = colors[idx] || color;
        return (
          <g key={idx}>
            {fill && path.area ? (
              <path
                d={path.area}
                fill={strokeColor}
                opacity={0.10}
              />
            ) : null}
            {path.d ? (
              <path
                d={path.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
