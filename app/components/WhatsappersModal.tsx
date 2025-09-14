import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints } from "../api";

// ✅ correcto desde app/components/*
const avatarMale = require("../../assets/images/avatar.png");
const avatarFemale = require("../../assets/images/avatar_female.png");
const avatarNeutral = require("../../assets/images/avatar_neutral.png");

type StarrUser = {
  username: string;
  display_name: string;
  avatar: string | null;
};

const getAvatarSource = (p?: { avatar?: string | null; gender?: string | null } | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri };
  const g = String(p?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export default function WhatsappersModal({
  visible,
  postId,
  onClose,
}: {
  visible: boolean;
  postId: number | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<StarrUser[]>([]);

  useEffect(() => {
    (async () => {
      if (!visible || !postId) return;
      try {
        setLoading(true);
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) {
          setList([]);
          setLoading(false);
          return;
        }
        const res = await fetch(endpoints.fincaPostWhatsappers(postId), {
          headers: { Authorization: `Token ${tk}` },
        });
        const data = await res.json();
        setList(Array.isArray(data.results) ? data.results : []);
      } catch {
        Alert.alert("Error", "No se pudo cargar el listado de compartidos");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, postId]);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={mStyles.modalSafe}>
        <View style={mStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={mStyles.headerTitle}>Compartido por WhatsApp</Text>
          <View style={{ width: 92 }} />
        </View>

        {loading ? (
          <View style={mStyles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView>
            {list.map((u) => (
              <View key={u.username} style={mStyles.row}>
                <Image
                  source={u.avatar ? { uri: u.avatar } : getAvatarSource(null)}
                  style={mStyles.avatar}
                />
                <Text style={mStyles.rowText}>
                  <Text style={{ fontWeight: "700" }}>{u.display_name}</Text> compartió esta
                  publicación por WhatsApp
                </Text>
              </View>
            ))}
            {!list.length && (
              <Text style={mStyles.empty}>Aún no hay compartidos</Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: "#262626" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1B1B1B",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 12, flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  rowText: { color: "#fff", fontSize: 15 },
  empty: { color: "#ccc", textAlign: "center", marginTop: 20 },
});
