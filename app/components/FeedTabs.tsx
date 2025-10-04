// app/components/FeedTabs.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";

type Props = {
  tabs: readonly string[];
  value: number;                 // índice activo
  onChange: (index: number) => void;
  topOffset: number;             // distancia desde la parte superior (y)
  visible?: boolean;             // mostrar/ocultar (por ej. !immersive)
  containerStyle?: ViewStyle;    // opcional para overrides
};

export default function FeedTabs({
  tabs,
  value,
  onChange,
  topOffset,
  visible = true,
  containerStyle,
}: Props) {
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabsRow, { top: topOffset }, containerStyle]}
    >
      {tabs.map((label, i) => (
        <TouchableOpacity
          key={label}
          onPress={() => onChange(i)}
          activeOpacity={0.9}
          style={styles.tabBtn}
        >
          <Text style={[styles.tabWord, i === value && styles.tabWordActive]}>
            {label}
          </Text>
          {i === value && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 8, alignItems: "center" },
  tabWord: { color: "rgba(255,255,255,0.9)", fontSize: 14, letterSpacing: 0.6 },
  tabWordActive: { color: "#fff", fontWeight: "800" },
  tabUnderline: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 2,
    width: "70%",
    marginTop: 2,
  },
});
