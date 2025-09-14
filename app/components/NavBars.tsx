import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

/* ---------- Icono con animación de presión ---------- */
function IconNav({
  icon,
  size = 28,
  onPress,
}: {
  icon: string;
  size?: number;
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      style={styles.iconBtn}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.9,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }).start()
      }
    >
      {({ pressed }) => (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons
            name={icon as any}
            size={size}
            color={pressed ? "#2E7D32" : "#000"}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

/* ---------- Barra superior ---------- */
export function HeaderCenter() {
  const router = useRouter();

  return (
    <View style={styles.headerCenter}>
      <IconNav icon="home-outline" onPress={() => router.replace("/home")} />
      <IconNav
        icon="storefront-outline"
        onPress={() => router.replace("/marketplace")}
      />
      <IconNav
        icon="notifications-outline"
        onPress={() => router.replace("/notificaciones")}
      />
    </View>
  );
}

/* ---------- Barra inferior ---------- */
export function FooterBar() {
  const router = useRouter();

  return (
    <View style={styles.footer}>
      <IconNav
        icon="add-circle-outline"
        size={32}
        onPress={() => router.push("/menu")}
      />
      <IconNav
        icon="search-outline"
        onPress={() => router.replace("/buscar")}
      />
    </View>
  );
}

/* ---------- Estilos ---------- */
const styles = StyleSheet.create({
  headerCenter: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    elevation: 3,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    backgroundColor: "#fff",
    width,
    paddingVertical: 10,
    elevation: 3,
  },
  iconBtn: { marginHorizontal: 8 },
});
