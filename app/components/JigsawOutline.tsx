// components/JigsawOutline.tsx
import React, { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from "react-native-svg";

/**
 * Contorno de rompecabezas con soporte para:
 * - Degradado en el trazo (useGradient + gradientColors)
 * - Glow opcional (neon) con spread/opacidades configurables
 */
type Props = {
  rows?: number;
  columns?: number;
  aspectRatio?: number;
  borderRadius?: number;

  strokeColor?: string;     // usado si no hay degradado
  strokeWidth?: number;

  knobRatio?: number;
  neckRatio?: number;

  neon?: boolean;           // activa “glow”
  glowColor?: string;       // color del glow (si no hay degradado)
  glowSpread?: number;      // px extra del halo
  glowOpacityOuter?: number;
  glowOpacityInner?: number;

  // Degradado
  useGradient?: boolean;
  gradientColors?: string[]; // ej. ["#FF66CC","#C77DFF","#9B5DE5"]
  gradientAngle?: number;    // 0..360 (0 = horizontal, 90 = vertical)
  style?: StyleProp<ViewStyle>;
};

export default function JigsawOutline({
  rows = 3,
  columns = 3,
  aspectRatio = 1,
  borderRadius = 12,

  // tonos suaves por defecto
  strokeColor = "#FF66CC",
  strokeWidth = 2.4,

  knobRatio = 0.20,
  neckRatio = 0.28,

  // glow sutil
  neon = false,
  glowColor,
  glowSpread = 3,
  glowOpacityOuter = 0.15,
  glowOpacityInner = 0.35,

  // degradado suave (fucsia → lila)
  useGradient = true,
  gradientColors = ["#FF66CC", "#C77DFF", "#9B5DE5"],
  gradientAngle = 45,

  style,
}: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const gradId = useRef(`grad_${Math.random().toString(36).slice(2)}`).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    const height = width / Math.max(0.1, aspectRatio);
    setBox({ w: Math.max(1, width), h: Math.max(1, height) });
  };

  const W = box.w, H = box.h;
  const cellW = W / Math.max(1, columns);
  const cellH = H / Math.max(1, rows);

  // vector del ángulo (convertimos 0..360 a un (x1,y1)-(x2,y2) en [0..1])
  const angleRad = (gradientAngle % 360) * Math.PI / 180;
  const x2 = (Math.cos(angleRad) + 1) / 2;
  const y2 = (Math.sin(angleRad) + 1) / 2;

  const seamsPath = useMemo(() => {
    if (!W || !H) return "";
    const r = Math.min(cellW, cellH) * knobRatio;
    const neck = Math.min(cellW, cellH) * neckRatio;
    const K = 0.5522847498;

    const p: string[] = [];

    // verticales internas
    for (let c = 1; c < columns; c++) {
      const x = c * cellW;
      p.push(`M ${x} 0`);
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        const yTop = rIdx * cellH;
        const yBot = yTop + cellH;
        const cy = (yTop + yBot) / 2;
        const dir = ((rIdx + c) % 2 === 0) ? 1 : -1;

        p.push(`L ${x} ${cy - neck}`);
        p.push(`L ${x} ${cy - r}`);
        const cx1 = x + dir * r * K;
        const cy1 = cy - r;
        const cx2 = x + dir * r * K;
        const cy2 = cy + r;
        p.push(`C ${cx1} ${cy1} ${cx2} ${cy2} ${x} ${cy + r}`);
        p.push(`L ${x} ${cy + neck}`);
        p.push(`L ${x} ${yBot}`);
      }
    }

    // horizontales internas
    for (let rIdx = 1; rIdx < rows; rIdx++) {
      const y = rIdx * cellH;
      p.push(`M 0 ${y}`);
      for (let cIdx = 0; cIdx < columns; cIdx++) {
        const xL = cIdx * cellW;
        const xR = xL + cellW;
        const cx = (xL + xR) / 2;
        const dir = ((rIdx + cIdx) % 2 === 0) ? 1 : -1;

        p.push(`L ${cx - neck} ${y}`);
        p.push(`L ${cx - r} ${y}`);
        const cy1 = y + dir * r * K;
        const cx1 = cx - r;
        const cy2 = y + dir * r * K;
        const cx2 = cx + r;
        p.push(`C ${cx1} ${cy1} ${cx2} ${cy2} ${cx + r} ${y}`);
        p.push(`L ${cx + neck} ${y}`);
        p.push(`L ${xR} ${y}`);
      }
    }

    return p.join(" ");
  }, [W, H, rows, columns, cellW, cellH, knobRatio, neckRatio]);

  // helpers de stroke y glow
  const strokeRef = useGradient ? `url(#${gradId})` : (strokeColor || "#FF66CC");
  const haloColor = useGradient ? `url(#${gradId})` : (glowColor || strokeColor);

  // stops del degradado (espaciado uniforme)
  const stops = (gradientColors?.length ? gradientColors : [strokeColor]).map((c, i, arr) => {
    const t = arr.length === 1 ? i : i / (arr.length - 1);
    return <Stop key={`${c}-${i}`} offset={`${Math.round(t * 100)}%`} stopColor={c} />;
  });

  return (
    <View
      style={[styles.wrap, { aspectRatio, borderRadius }, style]}
      onLayout={onLayout}
      pointerEvents="none"
    >
      {W > 0 && (
        <Svg width={W} height={H}>
          {useGradient && (
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2={x2.toString()} y2={y2.toString()}>
                {stops}
              </LinearGradient>
            </Defs>
          )}

          {/* --- GLow (opcional, sutil) --- */}
          {neon && (
            <>
              <Rect
                x={0.5 * strokeWidth}
                y={0.5 * strokeWidth}
                width={W - strokeWidth}
                height={H - strokeWidth}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke={haloColor}
                strokeWidth={strokeWidth + glowSpread}
                strokeOpacity={glowOpacityOuter}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Rect
                x={0.5 * strokeWidth}
                y={0.5 * strokeWidth}
                width={W - strokeWidth}
                height={H - strokeWidth}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke={haloColor}
                strokeWidth={strokeWidth + glowSpread * 0.55}
                strokeOpacity={glowOpacityInner}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Borde exterior */}
          <Rect
            x={0.5 * strokeWidth}
            y={0.5 * strokeWidth}
            width={W - strokeWidth}
            height={H - strokeWidth}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={strokeRef}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Uniones internas */}
          {neon && (
            <>
              <Path
                d={seamsPath}
                fill="none"
                stroke={haloColor}
                strokeWidth={strokeWidth + glowSpread}
                strokeOpacity={glowOpacityOuter}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Path
                d={seamsPath}
                fill="none"
                stroke={haloColor}
                strokeWidth={strokeWidth + glowSpread * 0.55}
                strokeOpacity={glowOpacityInner}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
          <Path
            d={seamsPath}
            fill="none"
            stroke={strokeRef}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
});
