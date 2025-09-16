import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  bgSource: ImageSourcePropType;
  /** Pásame el blurRadius que ya usas en finca.tsx para que quede idéntico */
  blurRadius?: number;
};

export default function ProfileOptionsModal({
  visible,
  onClose,
  onLogout,
  bgSource,
  blurRadius,
}: Props) {
  const fallbackBlur = Platform.OS === "android" ? 18 : 60;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Fondo difuminado idéntico al de finca.tsx */}
      <ImageBackground
        source={bgSource}
        style={styles.backdrop}
        resizeMode="cover"
        blurRadius={blurRadius ?? fallbackBlur}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.70)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.40)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Card del modal (look & feel igual al de opciones) */}
        <View style={styles.card}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Opciones</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.list}>
            <TouchableOpacity style={styles.optionRow} onPress={onLogout} activeOpacity={0.9}>
              <Ionicons name="log-out-outline" size={22} color="#FFB74D" style={{ width: 30 }} />
              <Text style={[styles.optionLabel, { color: "#ffde9b" }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "86%",
    backgroundColor: "#1B1B1B",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1B1B1B",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 12, flex: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#444" },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 18,
    marginVertical: 2,
  },
  optionLabel: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
});
