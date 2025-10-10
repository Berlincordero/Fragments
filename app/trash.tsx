// app/trash.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints, api } from "../lib/api";

/* ─────────── Tipos esperados del backend ─────────── */
type TrashRoomItem = {
  room_id: number;
  deleted_at: string;         // ISO
  expires_at?: string | null; // opcional (si el backend lo manda)
  peer?: {
    username: string;
    display_name: string;
    avatar?: string | null;
  } | null;
  last_message?: string | null;
};

type TrashMsgItem = {
  id: number;
  room: number;
  text: string | null;
  deleted_at: string;         // ISO
  expires_at?: string | null; // opcional
  // (opcional) si decides enviar peer también aquí desde el backend
  peer?: {
    username: string;
    display_name: string;
    avatar?: string | null;
  } | null;
};

/* ─────────── Helpers ─────────── */
const DAYS_TO_LIVE = 15;
const MS_DAY = 24 * 60 * 60 * 1000;

const normalizeURL = (u?: string | null) => {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = api("");
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
};

const timeLeftLabel = (deletedISO: string, expiresISO?: string | null) => {
  const now = Date.now();
  const start = new Date(deletedISO).getTime();
  const expiresAt = expiresISO ? new Date(expiresISO).getTime() : start + DAYS_TO_LIVE * MS_DAY;
  const diff = Math.max(0, expiresAt - now);
  const days = Math.floor(diff / MS_DAY);
  const hours = Math.floor((diff % MS_DAY) / (60 * 60 * 1000));
  if (days <= 0 && hours <= 0) return "Expira en minutos";
  if (days <= 0) return `Expira en ${hours} h`;
  if (days === 1) return "Expira en 1 día";
  return `Expira en ${days} días`;
};

const percentLeft = (deletedISO: string, expiresISO?: string | null) => {
  const start = new Date(deletedISO).getTime();
  const end = expiresISO ? new Date(expiresISO).getTime() : start + DAYS_TO_LIVE * MS_DAY;
  const total = end - start;
  if (total <= 0) return 0;
  const left = Math.max(0, end - Date.now());
  return Math.max(0, Math.min(1, left / total));
};

/* ─────────── Pantalla ─────────── */
export default function TrashScreen() {
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<"rooms" | "messages">("rooms");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rooms, setRooms] = useState<TrashRoomItem[]>([]);
  const [msgs, setMsgs] = useState<TrashMsgItem[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [targetRoom, setTargetRoom] = useState<TrashRoomItem | null>(null);
  const [targetMsg, setTargetMsg] = useState<TrashMsgItem | null>(null);
  const [working, setWorking] = useState(false);

  /* JSON seguro: muestra HTML/errores textuales si no viene application/json */
  async function readSafeJSON(res: Response, label: string) {
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${label} HTTP ${res.status} – ${body.slice(0, 200)}`);
    }
    if (!/application\/json/i.test(ct)) {
      const body = await res.text();
      throw new Error(`${label}: respuesta no JSON (ct=${ct}). Body: ${body.slice(0, 200)}`);
    }
    try {
      return await res.json();
    } catch {
      const body = await res.text();
      throw new Error(`${label}: JSON inválido. Body: ${body.slice(0, 200)}`);
    }
  }

  /* Acepta {items:[...]} o lista plana */
  const ensureItemsArray = <T,>(payload: any): T[] =>
    Array.isArray(payload?.items) ? (payload.items as T[])
    : Array.isArray(payload) ? (payload as T[])
    : [];

  /* Carga */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) throw new Error("No token");

      const [rRes, mRes] = await Promise.all([
        fetch(endpoints.trashRooms(),    { headers: { Authorization: `Token ${tk}` } }),
        fetch(endpoints.trashMessages(), { headers: { Authorization: `Token ${tk}` } }),
      ]);

      const rJson = await readSafeJSON(rRes, "trashRooms");
      const mJson = await readSafeJSON(mRes, "trashMessages");

      setRooms(ensureItemsArray<TrashRoomItem>(rJson));
      setMsgs(ensureItemsArray<TrashMsgItem>(mJson));
    } catch (e: any) {
      Alert.alert("Papelera", e?.message || "No se pudo cargar la papelera.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  /* Acciones Rooms */
  const askRoom = (it: TrashRoomItem) => {
    setTargetMsg(null);
    setTargetRoom(it);
    setMenuOpen(true);
  };
  const restoreRoom = async () => {
    if (!targetRoom) return;
    try {
      setWorking(true);
      const tk = await AsyncStorage.getItem("userToken");
      const res = await fetch(endpoints.trashRoomRestore(targetRoom.room_id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      await readSafeJSON(res, "restoreRoom");
      setRooms((prev) => prev.filter((r) => r.room_id !== targetRoom.room_id));
      setMenuOpen(false);
    } catch (e: any) {
      Alert.alert("Papelera", e?.message || "No se pudo restaurar la conversación.");
    } finally {
      setWorking(false);
    }
  };
  const destroyRoom = async () => {
    if (!targetRoom) return;
    Alert.alert(
      "Eliminar permanentemente",
      "¿Seguro que deseas borrar de forma definitiva esta conversación? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setWorking(true);
              const tk = await AsyncStorage.getItem("userToken");
              const res = await fetch(endpoints.trashRoomDestroy(targetRoom.room_id), {
                method: "POST",
                headers: { Authorization: `Token ${tk}` },
              });
              await readSafeJSON(res, "destroyRoom");
              setRooms((prev) => prev.filter((r) => r.room_id !== targetRoom.room_id));
              setMenuOpen(false);
            } catch (e: any) {
              Alert.alert("Papelera", e?.message || "No se pudo eliminar definitivamente.");
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  };

  /* Acciones Mensajes */
  const askMsg = (it: TrashMsgItem) => {
    setTargetRoom(null);
    setTargetMsg(it);
    setMenuOpen(true);
  };
  const restoreMsg = async () => {
    if (!targetMsg) return;
    try {
      setWorking(true);
      const tk = await AsyncStorage.getItem("userToken");
      const res = await fetch(endpoints.trashMsgRestore(targetMsg.id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      await readSafeJSON(res, "restoreMsg");
      setMsgs((prev) => prev.filter((m) => m.id !== targetMsg.id));
      setMenuOpen(false);
    } catch (e: any) {
      Alert.alert("Papelera", e?.message || "No se pudo restaurar el mensaje.");
    } finally {
      setWorking(false);
    }
  };
  const destroyMsg = async () => {
    if (!targetMsg) return;
    Alert.alert(
      "Eliminar permanentemente",
      "¿Seguro que deseas borrar de forma definitiva este mensaje? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setWorking(true);
              const tk = await AsyncStorage.getItem("userToken");
              const res = await fetch(endpoints.trashMsgDestroy(targetMsg.id), {
                method: "POST",
                headers: { Authorization: `Token ${tk}` },
              });
              await readSafeJSON(res, "destroyMsg");
              setMsgs((prev) => prev.filter((m) => m.id !== targetMsg.id));
              setMenuOpen(false);
            } catch (e: any) {
              Alert.alert("Papelera", e?.message || "No se pudo eliminar definitivamente.");
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  };

  /* Filtrado defensivo para evitar crasheos por datos malos */
  const safeRooms = useMemo(
    () => rooms.filter(r => typeof r?.room_id === "number" && !!r?.deleted_at),
    [rooms]
  );
  const safeMsgs = useMemo(
    () => msgs.filter(m => typeof m?.id === "number" && !!m?.deleted_at),
    [msgs]
  );

  /* Render Rooms */
  const renderRoom = ({ item }: { item: TrashRoomItem }) => {
    const avatar = normalizeURL(item.peer?.avatar);
    const name = item.peer?.display_name || item.peer?.username || `Sala #${item.room_id}`;
    const leftPct = percentLeft(item.deleted_at, item.expires_at);
    const leftLbl = timeLeftLabel(item.deleted_at, item.expires_at);

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => askRoom(item)}>
        <View style={styles.avatarWrap}>
          <Image
            source={avatar ? { uri: avatar } : require("../assets/images/avatar.png")}
            style={styles.avatar}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.last_message ? item.last_message : "Conversación enviada a papelera"}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { flex: leftPct }]} />
            <View style={{ flex: 1 - leftPct }} />
          </View>
          <Text style={styles.expire}>{leftLbl}</Text>
        </View>
        <Ionicons
          name={Platform.OS === "ios" ? "ellipsis-horizontal" : "ellipsis-vertical"}
          size={18}
          color="#AAB2BA"
        />
      </TouchableOpacity>
    );
  };

  /* Render Mensajes */
  const renderMsg = ({ item }: { item: TrashMsgItem }) => {
    const avatar = normalizeURL(item.peer?.avatar);
    const name = item.peer?.display_name || item.peer?.username || `Sala #${item.room}`;
    const leftPct = percentLeft(item.deleted_at, item.expires_at);
    const leftLbl = timeLeftLabel(item.deleted_at, item.expires_at);

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => askMsg(item)}>
        <View style={styles.avatarWrap}>
          <Image
            source={avatar ? { uri: avatar } : require("../assets/images/avatar.png")}
            style={styles.avatar}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {item.text ? `"${item.text}"` : "Mensaje sin texto"}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { flex: leftPct }]} />
            <View style={{ flex: 1 - leftPct }} />
          </View>
          <Text style={styles.expire}>{leftLbl}</Text>
        </View>
        <Ionicons
          name={Platform.OS === "ios" ? "ellipsis-horizontal" : "ellipsis-vertical"}
          size={18}
          color="#AAB2BA"
        />
      </TouchableOpacity>
    );
  };

  const data = tab === "rooms" ? safeRooms : safeMsgs;

  const emptyText =
    tab === "rooms"
      ? "No hay conversaciones en la papelera."
      : "No hay mensajes en la papelera.";

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top ? 0 : 6 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => Alert.alert("Volver", "Usa el botón atrás de tu app.")}>
          <Ionicons name="chevron-back" size={20} color="#DDE3EA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Papelera</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchAll}>
          <Ionicons name="reload" size={16} color="#9CCC9C" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "rooms" && styles.tabActive]}
          onPress={() => setTab("rooms")}
        >
          <Text style={[styles.tabTxt, tab === "rooms" && styles.tabTxtActive]}>Conversaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "messages" && styles.tabActive]}
          onPress={() => setTab("messages")}
        >
          <Text style={[styles.tabTxt, tab === "messages" && styles.tabTxtActive]}>Mensajes</Text>
        </TouchableOpacity>
      </View>

      {/* Lista (SIN FlatList) */}
      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9CCC9C"
              colors={["#9CCC9C"]}
            />
          }
        >
          {data.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          ) : (
            data.map((it: any, idx: number) => (
              <React.Fragment
                key={tab === "rooms" ? `room-${it.room_id}-${idx}` : `msg-${it.id}-${idx}`}
              >
                {tab === "rooms" ? renderRoom({ item: it }) : renderMsg({ item: it })}
                {idx < data.length - 1 && <View style={styles.sep} />}
              </React.Fragment>
            ))
          )}
        </ScrollView>
      )}

      {/* Menú acciones (sheet simple) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Acciones</Text>

          {!!targetRoom && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primary]}
                onPress={restoreRoom}
                disabled={working}
              >
                {working ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="arrow-undo" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Restaurar conversación</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.danger]}
                onPress={destroyRoom}
                disabled={working}
              >
                {working ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Eliminar definitivamente</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {!!targetMsg && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primary]}
                onPress={restoreMsg}
                disabled={working}
              >
                {working ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="arrow-undo" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Restaurar mensaje</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.danger]}
                onPress={destroyMsg}
                disabled={working}
              >
                {working ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Eliminar definitivamente</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.actionBtn, styles.neutral]} onPress={() => setMenuOpen(false)}>
            <Ionicons name="close" size={16} color="#101214" />
            <Text style={[styles.actionTxt, { color: "#101214" }]}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0D10" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerTitle: { flex: 1, textAlign: "center", color: "#E9EEF5", fontWeight: "800", fontSize: 16 },
  refreshBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },

  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tabActive: {
    backgroundColor: "rgba(92,142,242,0.16)",
    borderColor: "rgba(92,142,242,0.42)",
  },
  tabTxt: { color: "#C0CAD4", fontWeight: "800", fontSize: 13 },
  tabTxtActive: { color: "#DDE6FF" },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)", marginLeft: 72 },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 24, overflow: "hidden",
    alignItems: "center", justifyContent: "center", backgroundColor: "#000",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.10)",
    marginRight: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  title: { color: "#F2F6FA", fontWeight: "800", fontSize: 14 },
  subtitle: { color: "#AEB7C1", fontSize: 12, marginTop: 2 },
  progressBar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: "#5C8EF2",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  expire: { color: "#9FB2FF", fontSize: 11, marginTop: 6, fontWeight: "800" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#8DA0AE", fontSize: 13, textAlign: "center" },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18,
    backgroundColor: "#0C1419",
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.10)",
  },
  handle: {
    alignSelf: "center",
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 8,
  },
  sheetTitle: { color: "#E1E8EE", fontWeight: "800", fontSize: 13, marginBottom: 6 },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  primary: { backgroundColor: "rgba(92,142,242,0.16)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(92,142,242,0.42)" },
  danger:  { backgroundColor: "rgba(255,107,107,0.16)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,107,107,0.45)" },
  neutral: { backgroundColor: "#E5E7EB", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB", marginTop: 12, alignSelf: "center" },
  actionTxt: { color: "#F5F8FF", fontWeight: "800", fontSize: 14 },
});
