// app/chat.tsx  ← INBOX
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints } from "../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

type InboxItem = {
  room_id?: number;
  last_at?: string;
  unread: number;
  last_message?: string | null;
  peer: { username: string; display_name?: string | null; avatar?: string | null };
};

type ProfileDTO = {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
};

const avatarFallback = require("../assets/images/avatar.png");

const COLORS = {
  bg: "#0d0f12",
  text: "#fff",
  dim: "#A8A8A8",
  hair: "rgba(255,255,255,0.08)",
  inputPlaceholder: "#A7B6A9",
};

export default function ChatInbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<ProfileDTO | null>(null);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const getToken = useCallback(async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.finca(), { headers: { Authorization: `Token ${tk}` } });
      if (res.ok) {
        const p = (await res.json()) as ProfileDTO;
        setMe(p);
      }
    } catch {}
  }, [getToken]);

  const loadInbox = useCallback(async () => {
    try {
      const tk = await getToken();

      // 1) Intentar inbox directo
      const res = await fetch(endpoints.chatsInbox(), { headers: { Authorization: `Token ${tk}` } });
      if (res.ok) {
        const data = (await res.json()) as InboxItem[] | undefined;
        setItems(Array.isArray(data) ? data : []);
      } else {
        // 2) Fallback a rooms → construir lista simple
        const roomsRes = await fetch(endpoints.chatsRooms(), { headers: { Authorization: `Token ${tk}` } });
        const rooms = (await roomsRes.json()) as any[];
        const mapped: InboxItem[] = (rooms || []).map((r) => ({
          room_id: r?.id,
          last_at: r?.last_message?.created_at || r?.updated_at || new Date().toISOString(),
          unread: Number(r?.unread || 0),
          last_message: r?.last_message?.text || "",
          peer: {
            username: r?.peer?.username || "",
            display_name: r?.peer?.display_name || r?.peer?.username || "",
            avatar: r?.peer?.avatar || null,
          },
        }));
        setItems(mapped);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  const reloadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadInbox()]);
  }, [loadProfile, loadInbox]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadInbox()]);
    })();
  }, [loadProfile, loadInbox]);

  const openConversation = (peer: InboxItem["peer"]) => {
    router.push({
      pathname: "/conversation",
      params: {
        user: peer.username,
        displayName: peer.display_name || peer.username,
        avatar: peer.avatar || "",
      },
    });
  };

  const goBackToFinca = () => {
    // Regresa si hay historial; si no, manda a /finca
    try {
      // @ts-ignore - expo-router v3 expone canGoBack()
      if (router.canGoBack && router.canGoBack()) {
        router.back();
      } else {
        router.replace("/finca");
      }
    } catch {
      router.replace("/finca");
    }
  };

  const renderItem = ({ item }: { item: InboxItem }) => {
    const { peer } = item;
    const timeStr = item.last_at
      ? new Date(item.last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return (
      <View style={styles.row}>
        <TouchableOpacity onPress={() => openConversation(peer)} activeOpacity={0.75}>
          <Image source={peer.avatar ? { uri: peer.avatar } : avatarFallback} style={styles.avatar} />
          {!!item.unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.textBlock} onPress={() => openConversation(peer)} activeOpacity={0.85}>
          <View style={styles.topLine}>
            <Text numberOfLines={1} style={styles.name}>
              {peer.display_name || `@${peer.username}`}
            </Text>
            {!!timeStr && <Text style={styles.time}>{timeStr}</Text>}
          </View>
          <Text numberOfLines={1} style={styles.preview}>
            {item.last_message || "Empieza la conversación"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.trailingIcon} onPress={() => openConversation(peer)} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // Filtro local
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const dn = (it.peer.display_name || "").toLowerCase();
      const un = (it.peer.username || "").toLowerCase();
      const lm = (it.last_message || "").toLowerCase();
      return dn.includes(q) || un.includes(q) || lm.includes(q);
    });
  }, [items, query]);

  // Empty states
  const ListEmpty = () => {
    const isSearching = query.trim().length > 0;
    return (
      <View style={styles.emptyWrap}>
        <Image source={me?.avatar ? { uri: me.avatar } : avatarFallback} style={styles.emptyAvatar} />
        <Text style={styles.emptyTitle}>
          {isSearching ? "No hay resultados" : "No hay conversaciones aún"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching ? "Prueba con otro nombre o @usuario." : "Busca perfiles y envía tu primer mensaje."}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header con back sutil + safe-top */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={goBackToFinca}
          style={styles.backBtn}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.dim} />
        </TouchableOpacity>

        <Image source={me?.avatar ? { uri: me.avatar } : avatarFallback} style={styles.headerAvatar} />

        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{me?.display_name || me?.username || "—"}</Text>
          <Text style={styles.headerSub}>Bandeja de entrada</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={reloadAll} activeOpacity={0.8}>
          <Ionicons name="refresh" size={18} color="#C5E1A5" />
        </TouchableOpacity>
      </View>

      {/* ── Barra de búsqueda (glassy + degradado) ── */}
      <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
        <LinearGradient
          colors={["#9CCC9C55", "#80CBC455", "#FFFFFF10"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.searchGrad}
        >
          <View style={[styles.searchInner, focused && styles.searchInnerFocused]}>
            <Ionicons
              name="search"
              size={18}
              color={COLORS.inputPlaceholder}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar en conversaciones…"
              placeholderTextColor={COLORS.inputPlaceholder}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuery("")}
                style={styles.clearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.inputPlaceholder} />
              </TouchableOpacity>
            ) : (
              <View style={styles.trailingSpacer} />
            )}
          </View>
        </LinearGradient>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it, i) => `${it.peer.username}-${i}`}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{
            paddingVertical: 8,
            paddingBottom: Math.max(16, insets.bottom + 8),
            flexGrow: 1,
          }}
          ListEmptyComponent={ListEmpty}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={reloadAll} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hair,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    // sutil sin fondo sólido
    backgroundColor: "transparent",
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#000" },
  headerName: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  headerSub: { color: COLORS.dim, fontSize: 12, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },

  // ── Search (glassy) ──
  searchGrad: {
    borderRadius: 14,
    padding: 1.2, // grosor del borde degradado
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(8, 12, 10, 0.55)", // vidrio oscuro
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchInnerFocused: {
    borderColor: "#9CCC9C",
    shadowOpacity: 0.28,
    elevation: 5,
  },
  searchIcon: { marginLeft: 10, opacity: 0.9 },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 14,
    minHeight: 42,
  },
  clearBtn: {
    paddingHorizontal: 10,
    height: "100%",
    justifyContent: "center",
  },
  trailingSpacer: { width: 10 },

  // Lista
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hair, marginLeft: 72 },

  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#000" },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#EA4335",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  textBlock: { flex: 1, marginLeft: 12, marginRight: 8 },
  topLine: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "700" },
  time: { color: COLORS.dim, fontSize: 12, marginLeft: 8 },
  preview: { color: COLORS.dim, fontSize: 13, marginTop: 2 },

  trailingIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, opacity: 0.9 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  emptySubtitle: { color: COLORS.dim, fontSize: 13, textAlign: "center" },
});
