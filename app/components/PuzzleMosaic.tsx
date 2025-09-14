import React, { useMemo } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * Mosaic estilo rompecabezas (maqueta visual).
 * Dibuja curvas "tipo encaje" sobre un grid de imágenes.
 *
 * NOTA: no recorta las imágenes; sólo pinta las líneas encima.
 */

type Props = {
  images: (string | null | undefined)[];
  rows?: number;
  columns?: number;
  gap?: number;           // separación entre celdas (en px)
  knobRadius?: number;    // tamaño del “botón” del puzzle
  borderRadius?: number;  // radio de las esquinas externas
  aspectRatio?: number;   // ancho/alto del mosaico (por defecto 1 = cuadrado)
  style?: StyleProp<ViewStyle>;
};

export default function PuzzleMosaic({
  images,
  rows = 2,
  columns = 2,
  gap = 2,
  knobRadius = 14,
  borderRadius = 12,
  aspectRatio = 1,
  style,
}: Props) {
  const total = rows * columns;
  const pics = useMemo(() => {
    const arr = new Array(total).fill(null).map((_, i) => images[i] || null);
    return arr;
  }, [images, rows, columns]);

  return (
    <View style={[styles.wrap, { aspectRatio }, style]}>
      {/* Grid de imágenes */}
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden", borderRadius }]}>
        {pics.map((uri, idx) => {
          const r = Math.floor(idx / columns);
          const c = idx % columns;
          return (
            <View
              key={idx}
              style={[
                styles.cell,
                {
                  top: `${(r * 100) / rows}%`,
                  left: `${(c * 100) / columns}%`,
                  width: `${100 / columns}%`,
                  height: `${100 / rows}%`,
                  padding: gap / 2,
                },
              ]}
            >
              <Image
                source={uri ? { uri } : undefined}
                resizeMode="cover"
                style={styles.img}
              />
            </View>
          );
        })}
      </View>

      {/* Overlay de líneas tipo rompecabezas */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 1000 1000">
          {/* Borde exterior (suave, para dar acabado) */}
          <Path
            d={roundedRectPath(0, 0, 1000, 1000, (borderRadius / 300) * 1000)}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={14}
          />
          <Path
            d={roundedRectPath(0, 0, 1000, 1000, (borderRadius / 300) * 1000)}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={4}
          />

          {/* Separadores verticales con “botones” */}
          {Array.from({ length: columns - 1 }, (_, i) => {
            const x = ((i + 1) * 1000) / columns;
            const dir = i % 2 === 0 ? 1 : -1; // alterna hacia izq/der
            return (
              <Path
                key={`v-${i}`}
                d={puzzleVerticalPath(x, 0, 1000, knobRadius * 1.5, dir)}
                fill="none"
                stroke="rgba(0,0,0,0.65)"
                strokeWidth={18}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
          {Array.from({ length: columns - 1 }, (_, i) => {
            const x = ((i + 1) * 1000) / columns;
            const dir = i % 2 === 0 ? 1 : -1;
            return (
              <Path
                key={`v2-${i}`}
                d={puzzleVerticalPath(x, 0, 1000, knobRadius * 1.5, dir)}
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Separadores horizontales con “botones” */}
          {Array.from({ length: rows - 1 }, (_, j) => {
            const y = ((j + 1) * 1000) / rows;
            const dir = j % 2 === 0 ? 1 : -1; // alterna arriba/abajo
            return (
              <Path
                key={`h-${j}`}
                d={puzzleHorizontalPath(0, y, 1000, knobRadius * 1.5, dir)}
                fill="none"
                stroke="rgba(0,0,0,0.65)"
                strokeWidth={18}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
          {Array.from({ length: rows - 1 }, (_, j) => {
            const y = ((j + 1) * 1000) / rows;
            const dir = j % 2 === 0 ? 1 : -1;
            return (
              <Path
                key={`h2-${j}`}
                d={puzzleHorizontalPath(0, y, 1000, knobRadius * 1.5, dir)}
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

/* ===== Helpers de dibujo ===== */

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.min(w, h) / 2);
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    "Z",
  ].join(" ");
}

/** Línea vertical (x fijo) con “botón” central hacia izquierda/ derecha (dir = -1 | 1) */
function puzzleVerticalPath(x: number, y0: number, length: number, k: number, dir: 1 | -1) {
  const y1 = y0 + length;
  const ym = (y0 + y1) / 2;
  const out = dir * k; // cuánto “sale” el botón
  const d = [
    `M ${x} ${y0}`,
    `L ${x} ${ym - k * 2.0}`,
    // lóbulo superior
    `C ${x} ${ym - k * 1.25}, ${x + out * 0.25} ${ym - k * 1.15}, ${x + out * 0.95} ${ym - k * 0.45}`,
    // punta
    `C ${x + out * 1.50} ${ym - k * 0.10}, ${x + out * 1.50} ${ym + k * 0.10}, ${x + out * 0.95} ${ym + k * 0.45}`,
    // lóbulo inferior
    `C ${x + out * 0.25} ${ym + k * 1.15}, ${x} ${ym + k * 1.25}, ${x} ${ym + k * 2.0}`,
    `L ${x} ${y1}`,
  ];
  return d.join(" ");
}

/** Línea horizontal (y fijo) con “botón” arriba/abajo (dir = -1 | 1) */
function puzzleHorizontalPath(x0: number, y: number, length: number, k: number, dir: 1 | -1) {
  const x1 = x0 + length;
  const xm = (x0 + x1) / 2;
  const out = dir * k;
  const d = [
    `M ${x0} ${y}`,
    `L ${xm - k * 2.0} ${y}`,
    // lóbulo izquierdo
    `C ${xm - k * 1.25} ${y}, ${xm - k * 1.15} ${y - out * 0.25}, ${xm - k * 0.45} ${y - out * 0.95}`,
    // punta
    `C ${xm - k * 0.10} ${y - out * 1.50}, ${xm + k * 0.10} ${y - out * 1.50}, ${xm + k * 0.45} ${y - out * 0.95}`,
    // lóbulo derecho
    `C ${xm + k * 1.15} ${y - out * 0.25}, ${xm + k * 1.25} ${y}, ${xm + k * 2.0} ${y}`,
    `L ${x1} ${y}`,
  ];
  return d.join(" ");
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  cell: {
    position: "absolute",
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#111",
  },
});
