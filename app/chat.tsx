// app/chats.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { endpoints, api } from "../lib/api";

/* Tipos */
type MiniUser = {
  username: string;
  display_name: string;
  avatar?: string | null;
  is_online?: boolean;
  last_seen?: string | null;
};

type InboxItem = {
  room_id: number;
  last_message: string | null;
  last_at: string;
  peer: MiniUser;
  unread: number;
};

type MyProfile = {
  avatar: string | null;
  gender?: "M" | "F" | "O" | string | null;
};

/* Utils */
const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = (s: string) => stripAccents((s || "").toLowerCase().trim());

const timeAgo = (iso?: string | null) => {
  if (!iso) return "hace un momento";
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m === 1) return "hace 1 minuto";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h === 1) return "hace 1 hora";
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ayer";
  return `hace ${days} d`;
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [query, setQuery] = useState("");

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTarget, setMenuTarget] = useState<InboxItem | null>(null);

  const [topMenuVisible, setTopMenuVisible] = useState(false);

  const HEADER_AV_SIZE = 44;
  const [myAvatarUri, setMyAvatarUri] = useState<string | null>(null);

  const normalizeAvatar = (u?: string | null) => {
    if (!u) return null;
    const trimmed = u.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const base = api("");
    if (trimmed.startsWith("/")) return `${base}${trimmed}`;
    return `${base}/${trimmed.replace(/^\/+/, "")}`;
  };

  const Avatar: React.FC<{ uri: string | null; size?: number; online?: boolean }> = ({ uri, size = 40, online }) => {
    const [error, setError] = useState(false);
    const dotColor = online ? "#4CAF50" : "#EF5350";
    return (
      <View>
        {!uri || error ? (
          <Ionicons name="person-circle" size={size} color="#9CCC9C" />
        ) : (
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setError(true)} />
        )}
        <View
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: dotColor,
            borderWidth: 2,
            borderColor: "#061314",
          }}
        />
      </View>
    );
  };

  const fetchMyProfile = async () => {
    try {
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) return;
      const res = await fetch(endpoints.finca(), { headers: { Authorization: `Token ${tk}` } });
      if (!res.ok) return;
      const json = (await res.json()) as MyProfile;
      setMyAvatarUri(normalizeAvatar(json?.avatar ?? null));
    } catch {}
  };

  async function fetchInbox() {
    try {
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) {
        router.replace("/");
        return;
      }
      const [inboxRes] = await Promise.all([
        fetch(endpoints.chatsInbox(), { headers: { Authorization: `Token ${tk}` } }),
        fetchMyProfile(),
      ]);
      if (!inboxRes.ok) throw new Error(`HTTP ${inboxRes.status}`);
      const json = (await inboxRes.json()) as InboxItem[];
      setItems(Array.isArray(json) ? json : []);
    } catch {
      Alert.alert("Chats", "No se pudo cargar la bandeja.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchInbox();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };

  const openRoom = (it: InboxItem) => {
    router.push({
      pathname: "/conversation",
      params: {
        user: it.peer.username,
        displayName: it.peer.display_name || it.peer.username,
        avatar: normalizeAvatar(it.peer.avatar) ?? "",
      },
    });
  };

  const openMenu = (it: InboxItem) => {
    setMenuTarget(it);
    setMenuVisible(true);
  };
  const closeMenu = () => {
    setMenuVisible(false);
    setMenuTarget(null);
  };

  const callArchive = async (value: boolean) => {
    if (!menuTarget) return;
    try {
      const tk = await AsyncStorage.getItem("userToken");
      const res = await fetch(endpoints.chatsRoomArchive(menuTarget.room_id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (value) setItems((prev) => prev.filter((r) => r.room_id !== menuTarget.room_id));
      closeMenu();
    } catch {
      Alert.alert("Chats", "No se pudo archivar la conversación.");
    }
  };

  const callDelete = async () => {
    if (!menuTarget) return;
    try {
      const tk = await AsyncStorage.getItem("userToken");
      const res = await fetch(endpoints.chatsRoomDelete(menuTarget.room_id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((r) => r.room_id !== menuTarget.room_id));
      closeMenu();
    } catch {
      Alert.alert("Chats", "No se pudo borrar la conversación.");
    }
  };

  /* Filtro de búsqueda */
  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return items;
    return items.filter((it) => {
      const name = norm(it.peer.display_name || it.peer.username);
      const user = norm(it.peer.username);
      const matchByName = name.includes(q) || user.includes(q);
      const matchByLast = norm(it.last_message || "").includes(q);
      return matchByName || matchByLast;
    });
  }, [items, query]);

  const renderItem = ({ item }: { item: InboxItem }) => {
    const name = item.peer.display_name || item.peer.username;
    const avatarUri = normalizeAvatar(item.peer.avatar);
    const isOnline = !!item.peer.is_online;
    const subtitle = isOnline ? "En línea" : `Activo ${timeAgo(item.peer.last_seen)}`;

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => openRoom(item)}>
        <View style={styles.avatar}>
          <Avatar uri={avatarUri} online={isOnline} />
        </View>

        <View style={styles.rowCenter}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          <Text numberOfLines={1} style={[styles.preview, isOnline && { color: "#A5D6A7" }]}>
            {subtitle}
          </Text>
          <Text numberOfLines={1} style={styles.previewMsg}>
            {item.last_message || "—"}
          </Text>
        </View>

        <View style={styles.rowRight}>
          {!!item.unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => openMenu(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={Platform.OS === "ios" ? "ellipsis-horizontal" : "ellipsis-vertical"}
              size={18}
              color="#B0BEC5"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top ? 0 : 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color="#E0E0E0" />
          </TouchableOpacity>

          <View
            style={[
              styles.headerAvatarWrap,
              { width: 44, height: 44, borderRadius: 22 },
            ]}
          >
            <Image
              source={myAvatarUri ? { uri: myAvatarUri } : require("../assets/images/avatar.png")}
              style={{ width: 44, height: 44, borderRadius: 22 }}
            />
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          Bandeja de entrada
        </Text>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={fetchInbox} style={styles.refreshBtn}>
            <Ionicons name="reload" size={16} color="#9CCC9C" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTopMenuVisible(true)}
            style={[styles.refreshBtn, { marginLeft: 8 }]}
          >
            <Ionicons
              name={Platform.OS === "ios" ? "ellipsis-horizontal" : "ellipsis-vertical"}
              size={16}
              color="#E0E0E0"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* BÚSQUEDA */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#90A4AE" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o @usuario…"
          placeholderTextColor="#78909C"
          style={styles.input}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#90A4AE" />
          </TouchableOpacity>
        )}
      </View>

      {/* LISTA */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.room_id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2E7D32" />}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
        />
      )}

      {/* MENÚ por fila */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={closeMenu}>
          <View />
        </TouchableOpacity>

        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <Text style={styles.menuTitle}>Acciones</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => callArchive(true)}>
            <Ionicons name="archive-outline" size={18} color="#ECEFF1" />
            <Text style={styles.menuItemText}>Archivar conversación</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem,
              { backgroundColor: "rgba(244, 67, 54, 0.10)", borderColor: "rgba(244,67,54,0.25)" },
            ]}
            onPress={() =>
              Alert.alert("Borrar conversación", "Se moverá a la papelera (15 días). ¿Continuar?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Borrar", style: "destructive", onPress: callDelete },
              ])
            }
          >
            <Ionicons name="trash-outline" size={18} color="#EF9A9A" />
            <Text style={[styles.menuItemText, { color: "#EF9A9A" }]}>Enviar a papelera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCancel} onPress={closeMenu}>
            <Text style={styles.menuCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* MENÚ SUPERIOR (tres puntos) */}
      <Modal
        visible={topMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTopMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setTopMenuVisible(false)}
        >
          <View />
        </TouchableOpacity>

        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <Text style={styles.menuTitle}>Bandeja</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setTopMenuVisible(false);
              Alert.alert("Archivadas", "Aquí mostrarías las conversaciones archivadas.");
            }}
          >
            <Ionicons name="archive-outline" size={18} color="#ECEFF1" />
            <Text style={styles.menuItemText}>Conversaciones archivadas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setTopMenuVisible(false);
              router.push("/trash");  // ← ir a Papelera
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#EF9A9A" />
            <Text style={[styles.menuItemText, { color: "#EF9A9A" }]}>Papelera de reciclaje</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCancel}
            onPress={() => setTopMenuVisible(false)}
          >
            <Text style={styles.menuCancelText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#061314" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginTop: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginRight: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerAvatarWrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#E0F2F1",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 12,
    gap: 8,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  input: { flex: 1, color: "#E0E0E0", paddingVertical: 8 },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 72,
  },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  rowCenter: { flex: 1 },
  name: { color: "#FFFFFF", fontWeight: "800", fontSize: 14, marginBottom: 2 },
  preview: { color: "#B0BEC5", fontSize: 12 },
  previewMsg: { color: "#8FA3AD", fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },

  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  menuSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 18,
    backgroundColor: "#0C1A1B",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  menuHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 8,
  },
  menuTitle: { color: "#E0F2F1", fontWeight: "800", fontSize: 13, marginBottom: 6 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginTop: 6,
  },
  menuItemText: { color: "#ECEFF1", fontSize: 13, fontWeight: "700" },
  menuCancel: { alignSelf: "center", marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  menuCancelText: { color: "#90CAF9", fontWeight: "800" },
});
