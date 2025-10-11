// app/components/TopTabs.tsx
import React, { useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";

type Props = {
  tabs: readonly string[];
  value: number;
  onChange: (i: number) => void;
  topOffset?: number;
  visible?: boolean;
};

function TopTabsImpl({
  tabs,
  value,
  onChange,
  topOffset = 0,
  visible = true,
}: Props) {
  const scRef = useRef<ScrollView>(null);
  const positions = useRef<number[]>([]);
  const widths = useRef<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    const x = positions.current[value] ?? 0;
    const w = widths.current[value] ?? 80;
    scRef.current?.scrollTo({ x: Math.max(0, x - w), animated: true });
  }, [value, visible]);

  if (!visible) return null;

  return (
    <View style={[styles.tabsWrap, { top: topOffset }]}>
      <ScrollView
        ref={scRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {tabs.map((t, i) => (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(i)}
            activeOpacity={0.9}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onLayout={(e: LayoutChangeEvent) => {
              positions.current[i] = e.nativeEvent.layout.x;
              widths.current[i] = e.nativeEvent.layout.width;
            }}
            style={[styles.tab, i === value ? styles.tabActive : undefined]}
          >
            <Text
              style={[styles.tabText, i === value ? styles.tabTextActive : undefined]}
              numberOfLines={1}
            >
              {t}
            </Text>
            {i === value && <View style={styles.underline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const TopTabs = memo(TopTabsImpl);
export default TopTabs;

const styles = StyleSheet.create({
  // posición absoluta bajo la barra superior
  tabsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
  },
  // más compacto
  tabsRow: {
    paddingHorizontal: 10, // antes 12
    paddingVertical: 4,    // antes 8
  },
  // chip compacto + elegante
  tab: {
    paddingHorizontal: 10, // antes 14
    paddingVertical: 4,    // antes 8
    marginRight: 6,        // antes 8
    borderRadius: 10,      // antes 14
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
    minHeight: 28,
  },
  tabActive: {
    backgroundColor: "rgba(197,225,165,0.14)",
    borderColor: "#98c98f",
  },
  tabText: {
    color: "#e0e0e0",
    fontSize: 11.5,    // antes 13
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: "#C5E1A5",
  },
  underline: {
    height: 1.5,       // antes 2
    backgroundColor: "#C5E1A5",
    marginTop: 4,      // antes 6
    borderRadius: 1.5,
  },
});
