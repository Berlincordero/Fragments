// app/components/SubscribeBell.tsx
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  subscribed: boolean;
  onPress: () => void;
  /** opcional: número de suscriptores para mostrarlo junto al ícono si quieres */
  count?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/** Campana de suscripción (presentacional)
 *  - Controla sólo UI. El toggle/llamadas viven en el padre (home.tsx).
 */
export default function SubscribeBell({
  subscribed,
  onPress,
  count,
  style,
  textStyle,
}: Props) {
  // === Tamaño y color (ajusta aquí) ===
  const ICON_SIZE_BELL = 22;              // ← tamaño de la campana
  const BELL_COLOR_ON  = "#A5D6A7";       // ← color cuando está suscrito
  const BELL_COLOR_OFF = "#FFFFFF";       // ← color cuando NO está suscrito
  const COUNT_COLOR    = "#FFFFFF";       // ← color del numerito (si se muestra)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.bellBtn, style, subscribed && styles.bellBtnOn]}
    >
      <Ionicons
        name={subscribed ? "notifications" : "notifications-outline"}
        size={ICON_SIZE_BELL}
        color={subscribed ? BELL_COLOR_ON : BELL_COLOR_OFF}
      />
      {typeof count === "number" && (
        <Text style={[styles.bellCount, { color: COUNT_COLOR }, textStyle]} numberOfLines={1}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  bellBtnOn: {
    backgroundColor: "rgba(165,214,167,0.30)",
    borderColor: "#A5D6A7",
  },
  bellCount: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "800",
  },
});
