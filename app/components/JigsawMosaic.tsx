// components/JigsawMosaic.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Image, StyleSheet, LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";

export type MosaicMedia = { uri: string; type: "image" | "video" };

type Props = {
  rows: number;
  columns: number;
  aspectRatio?: number; // width / height; por defecto 1
  borderRadius?: number; // radios suaves en cada tile
  media: MosaicMedia[];
};

export default function JigsawMosaic({
  rows,
  columns,
  aspectRatio = 1,
  borderRadius = 16,
  media,
}: Props) {
  const [w, setW] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setW(Math.round(e.nativeEvent.layout.width));
  }, []);

  const h = useMemo(() => {
    if (w <= 0) return 0;
    const ar = Math.max(0.1, aspectRatio);
    return Math.max(1, Math.round(w / ar));
  }, [w, aspectRatio]);

  const pool = (media && media.length ? media : []) as MosaicMedia[];

  const tiles = useMemo(() => {
    const total = Math.max(0, rows * columns);
    const out: MosaicMedia[] = [];
    for (let i = 0; i < total; i++) {
      out.push(pool.length ? pool[i % pool.length] : { uri: "", type: "image" });
    }
    return out;
  }, [rows, columns, pool]);

  if (!rows || !columns) return null;

  const cellW = w > 0 ? w / columns : 0;
  const cellH = h > 0 ? h / rows : 0;

  return (
    <View style={{ width: "100%" }} onLayout={onLayout}>
      {!!h && (
        <View style={{ width: "100%", height: h }}>
          {tiles.map((item, i) => {
            const r = Math.floor(i / columns);
            const c = i % columns;
            const left = Math.round(c * cellW);
            const top = Math.round(r * cellH);

            return (
              <View
                key={`cell-${i}`}
                style={[
                  styles.cell,
                  {
                    left,
                    top,
                    width: Math.ceil(cellW),
                    height: Math.ceil(cellH),
                    borderRadius,
                  },
                ]}
              >
                {item?.type === "video" ? (
                  <>
                    <Video
                      source={{ uri: item.uri }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode={ResizeMode.COVER}
                      isMuted
                      isLooping
                      shouldPlay={false} // diseño: pausado, sirve de “poster”
                    />
                    <View style={styles.playBadge}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  </>
                ) : item?.uri ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.fallback} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  playBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
});
