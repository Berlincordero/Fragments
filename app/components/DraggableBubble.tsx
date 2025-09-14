// app/components/DraggableBubble.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  LayoutChangeEvent,
  TextStyle,
  StyleProp,
  Platform,
} from "react-native";
import {
  PanGestureHandler,
  State as GHState,
  PanGestureHandlerStateChangeEvent,
  PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";

export type BubblePos = { x: number; y: number }; // 0..1 (top-left)

const BUBBLE_BG = "rgba(0, 0, 0, 0.85)";
const BUBBLE_BG_EDIT = "rgba(0, 0, 0, 0.86)";

type Props = {
  text: string;
  color: string;
  textStyle?: StyleProp<TextStyle>;
  containerSize: { w: number; h: number };
  initial: BubblePos;                   // posición normalizada al montar
  onChange?: (pos: BubblePos) => void;  // reporta al soltar
  editing?: boolean;                    // si es true: se puede arrastrar y editar
  onTextChange?: (t: string) => void;   // escribir dentro de la burbuja
  onDragStateChange?: (dragging: boolean) => void; // para desactivar el scroll del padre
};

export default function DraggableBubble({
  text,
  color,
  textStyle,
  containerSize,
  initial,
  onChange,
  editing = false,
  onTextChange,
  onDragStateChange,
}: Props) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const [bubbleSize, setBubbleSize] = useState({ w: 0, h: 0 });

  // Posición en píxeles (absoluta dentro del slot)
  const [posPx, setPosPx] = useState(() => ({
    x: initial.x * (containerSize.w || 1),
    y: initial.y * (containerSize.h || 1),
  }));

  // Recalcular si cambia el tamaño del contenedor
  useEffect(() => {
    setPosPx({
      x: clamp(initial.x, 0, 1) * (containerSize.w || 1),
      y: clamp(initial.y, 0, 1) * (containerSize.h || 1),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.w, containerSize.h]);

  // Referencia de partida al comenzar un gesto
  const startRef = useRef({ x: 0, y: 0 });

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, oldState, translationX, translationY } = e.nativeEvent;

    if (!editing) return;

    if (state === GHState.BEGAN) {
      startRef.current = { ...posPx };
      onDragStateChange?.(true);
    }

    if (state === GHState.ACTIVE) {
      const maxX = Math.max(0, containerSize.w - bubbleSize.w);
      const maxY = Math.max(0, containerSize.h - bubbleSize.h);
      setPosPx({
        x: clamp(startRef.current.x + translationX, 0, maxX),
        y: clamp(startRef.current.y + translationY, 0, maxY),
      });
    }

    if (
      state === GHState.END ||
      state === GHState.CANCELLED ||
      state === GHState.FAILED ||
      (oldState === GHState.ACTIVE && state !== GHState.ACTIVE)
    ) {
      onDragStateChange?.(false);
      if (!containerSize.w || !containerSize.h) return;
      onChange?.({
        x: clamp(posPx.x / containerSize.w, 0, 1),
        y: clamp(posPx.y / containerSize.h, 0, 1),
      });
    }
  };

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    if (!editing) return;
    const { translationX, translationY } = e.nativeEvent;
    const maxX = Math.max(0, containerSize.w - bubbleSize.w);
    const maxY = Math.max(0, containerSize.h - bubbleSize.h);
    setPosPx({
      x: clamp(startRef.current.x + translationX, 0, maxX),
      y: clamp(startRef.current.y + translationY, 0, maxY),
    });
  };

  const onBubbleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBubbleSize({ w: width, h: height });
  };

  return (
    <PanGestureHandler
      enabled={editing}                     // solo arrastra cuando estás editando
      onHandlerStateChange={onHandlerStateChange}
      onGestureEvent={onGestureEvent}
      shouldCancelWhenOutside={false}
    >
      <View
        onLayout={onBubbleLayout}
        pointerEvents="box-none"
        style={[
          styles.bubble,
          {
            left: posPx.x,
            top: posPx.y,
            backgroundColor: editing ? BUBBLE_BG_EDIT : BUBBLE_BG,
            borderColor: "rgba(255,255,255,0.12)",
          },
        ]}
      >
        {editing ? (
          <TextInput
            style={[styles.textBase, { color }, textStyle]}
            placeholder="Escribe un texto corto"
            placeholderTextColor="#BDBDBD"
            value={text}
            onChangeText={onTextChange}
            autoFocus
            multiline
            scrollEnabled={false}
            maxLength={140}
          />
        ) : (
          <Text style={[styles.textBase, { color }, textStyle]}>{text}</Text>
        )}
      </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "92%",
  },
  textBase: {
    fontSize: 16, // unificado con la portada
    fontWeight: (Platform.OS === "ios" ? "700" : "700") as any,
  },
});
