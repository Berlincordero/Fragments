// app/components/TopComposeBar.tsx
import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Tipado mínimo que necesitamos del perfil */
export type MiniProfile = {
  avatar: string | null;
  gender?: string | null;
};

type Props = {
  style?: ViewStyle;                 // para posicionarlo (absolute/top/left/right)
  profile?: MiniProfile | null;
  immersive?: boolean;               // si es true, oculta la barra de “¿Qué estás pensando?”
  AV_SIZE?: number;                  // por si quieres tunear el avatar size (default 52)
  onPressAvatar: () => void;
  onPressCompose: () => void;
  onPressLeaf: () => void;
};

const avatarMale = require("../../assets/images/avatar.png");
const avatarFemale = require("../../assets/images/avatar_female.png");
const avatarNeutral = require("../../assets/images/avatar_neutral.png");

const getAvatarSource = (p?: MiniProfile | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String(p?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

function TopComposeBarImpl({
  style,
  profile,
  immersive = false,
  AV_SIZE = 42,
  onPressAvatar,
  onPressCompose,
  onPressLeaf,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      {/* Avatar */}
      <TouchableOpacity
        onPress={onPressAvatar}
        activeOpacity={0.85}
        style={[
          styles.avatarBtn,
          { width: AV_SIZE, height: AV_SIZE, borderRadius: AV_SIZE / 2 },
        ]}
      >
        <Image source={getAvatarSource(profile || undefined)} style={styles.avatarImg} />
      </TouchableOpacity>

      {/* ¿Qué estás pensando? + hoja */}
      {!immersive && (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={onPressCompose}
            activeOpacity={0.9}
            style={[styles.composeBar, { flexShrink: 1, flexGrow: 1, marginRight: 10 }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.composeText, styles.txtShadow]}>¿Qué estás pensando?</Text>
            <Text style={[styles.plus, styles.txtShadow]}>＋</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.topIconBtn}
            onPress={onPressLeaf}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Abrir opciones"
          >
            <Ionicons name="leaf-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default memo(TopComposeBarImpl);

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarBtn: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.98)",
  },
  avatarImg: { width: "100%", height: "100%" },
  composeBar: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composeText: { color: "#fff", fontSize: 16 },
  plus: { color: "#fff", fontSize: 22, fontWeight: "800" },
  topIconBtn: {
    width: 35,
    height: 35,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  txtShadow: {
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
