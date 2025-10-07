// app/conversation.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints } from "../lib/api";

type Msg = {
  id: number;
  room: number;
  sender: { id: number; username: string };
  text: string;
  image?: string | null;
  created_at: string;
};
type PageRes = { results: Msg[]; next: string | null; previous: string | null };

const avatarFallback = require("../assets/images/avatar.png");

const COLORS = {
  bg: "#0d0f12",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  text: "#fff",
  textDim: "#A8A8A8",
  bubbleMine: "#1f6feb",
  bubbleOther: "#262626",
  composerBg: "#181A1D",
  pillBg: "rgba(255,255,255,0.08)",
};

export default function ConversationScreen() {
  const router = useRouter();
  const { user: usernameParam, displayName, avatar } = useLocalSearchParams<{
    user?: string; displayName?: string; avatar?: string;
  }>();
  const targetUsername = (usernameParam || "").toString();

  const [roomId, setRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [selfUsername, setSelfUsername] = useState<string>("");

  // token helper
  const getToken = useCallback(async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  }, []);

  // obtener mi username (para diferenciar burbujas)
  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        const res = await fetch(endpoints.finca(), { headers: { Authorization: `Token ${tk}` } });
        const json = await res.json();
        if (json?.username) setSelfUsername(String(json.username));
      } catch {}
    })();
  }, []);

  // abrir/crear sala
  const ensureRoom = useCallback(async () => {
    const tk = await getToken();
    const res = await fetch(endpoints.chatsOpenDm(targetUsername), {
      method: "POST",
      headers: { Authorization: `Token ${tk}` },
    });
    const data = await res.json();
    if (!res.ok || !data?.room_id) throw new Error(data?.detail || "No se pudo abrir el chat");
    setRoomId(Number(data.room_id));
    return { id: Number(data.room_id), token: tk };
  }, [getToken, targetUsername]);

  // cargar página (más nuevo → más viejo; devolvemos ascendente para lista invertida)
  const fetchPage = useCallback(async (rid: number, tk: string, pageNum = 1) => {
    const url = endpoints.chatsMessages(rid, pageNum);
    const res = await fetch(url, { headers: { Authorization: `Token ${tk}` } });
    if (!res.ok) return [] as Msg[];
    const json = (await res.json()) as PageRes | Msg[];
    const arr: Msg[] = Array.isArray((json as any).results) ? (json as any).results : (json as any);
    return [...arr].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, []);

  // arranque
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opened = await ensureRoom();
        if (!mounted) return;
        const first = await fetchPage(opened.id, opened.token, 1);
        setMessages(first);
        setHasMore(first.length > 0);
        setPage(1);
        try {
          await fetch(endpoints.chatsMarkRead(opened.id), { method: "POST", headers: { Authorization: `Token ${opened.token}` } });
        } catch {}
      } catch (e: any) {
        console.warn(e?.message);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [ensureRoom, fetchPage]);

  // paginar hacia arriba
  const loadMore = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const tk = await getToken();
      const nextPage = page + 1;
      const more = await fetchPage(roomId, tk, nextPage);
      if (!more.length) setHasMore(false);
      else {
        setMessages((prev) => [...more, ...prev]);
        setPage(nextPage);
      }
    } catch {} finally { setLoadingMore(false); }
  }, [roomId, page, hasMore, loadingMore, getToken, fetchPage]);

  // enviar texto
  const send = useCallback(async () => {
    if (!roomId || sending) return;
    const payload = text.trim();
    if (!payload) return;

    setSending(true);
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.chatsMessages(roomId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const j = await res.json();
      if (!res.ok || !j?.id) throw new Error(j?.detail || "No se pudo enviar");
      setText("");
      setMessages((prev) => [...prev, j]); // al final (lista invertida lo pone abajo)
    } catch (e: any) {
      console.warn(e?.message);
    } finally {
      setSending(false);
    }
  }, [roomId, text, sending, getToken]);

  // ===== UI =====
  const headerTitle = useMemo(
    () => (displayName ? String(displayName) : targetUsername ? `@${targetUsername}` : "Chat"),
    [displayName, targetUsername]
  );

  const renderDayPill = (d: Date) => (
    <View style={styles.dayPill}>
      <Text style={styles.dayPillText}>
        {d.toDateString() === new Date().toDateString()
          ? "Hoy"
          : d.toDateString() === new Date(Date.now() - 86400000).toDateString()
          ? "Ayer"
          : d.toLocaleDateString()}
      </Text>
    </View>
  );

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const mine = item.sender?.username === selfUsername;
    const ts = new Date(item.created_at);
    const showDay =
      index === 0 ||
      new Date(messages[index - 1]?.created_at).toDateString() !== ts.toDateString();

    return (
      <>
        {showDay && renderDayPill(ts)}
        <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
          {!mine && (
            <Image
              source={avatar ? { uri: String(avatar) } : avatarFallback}
              style={styles.avatar}
            />
          )}
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            {!!item.text && <Text style={styles.msgText}>{item.text}</Text>}
            <Text style={[styles.meta, mine && { alignSelf: "flex-end" }]}>
              {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </>
    );
  };

  const keyExtractor = (m: Msg, i: number) =>
    m?.id ? `m-${m.id}` : `tmp-${m.created_at}-${i}`;

  const canSend = !!text.trim() && !sending;

  return (
    <View style={styles.root}>
      {/* Header IG-like */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <Image
          source={avatar ? { uri: String(avatar) } : avatarFallback}
          style={styles.headerAvatar}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.headerTitle}>{headerTitle}</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>Activo(a) recientemente</Text>
        </View>

        <TouchableOpacity style={styles.iconGhost}>
          <Ionicons name="call-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconGhost}>
          <Ionicons name="videocam-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconGhost}>
          <Ionicons name="information-circle-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={84}
        >
          <FlatList
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 10, paddingBottom: 78 }}
            inverted
            onEndReachedThreshold={0.12}
            onEndReached={loadMore}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null
            }
          />

          {/* Composer IG */}
          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              <TouchableOpacity style={styles.composerIcon}>
                <Ionicons name="happy-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Enviar mensaje…"
                placeholderTextColor={COLORS.textDim}
                value={text}
                onChangeText={setText}
                multiline
              />
              {!canSend ? (
                <>
                  <TouchableOpacity style={styles.composerIcon}>
                    <Ionicons name="camera-outline" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.composerIcon}>
                    <Ionicons name="image-outline" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.composerIcon}>
                    <Ionicons name="mic-outline" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={send} style={styles.sendFab} disabled={!canSend}>
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
    backgroundColor: "#0b0e12",
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 8,
  },
  iconGhost: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginLeft: 6,
  },
  headerAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: "#000" },
  headerTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  headerSubtitle: { color: COLORS.textDim, fontSize: 12, marginTop: -2 },

  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 6, alignItems: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  rowMine: { justifyContent: "flex-end" },

  avatar: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: COLORS.bubbleMine,
    alignSelf: "flex-end",
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: COLORS.bubbleOther,
    alignSelf: "flex-start",
    borderTopLeftRadius: 6,
  },
  msgText: { color: COLORS.text, fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 11, marginTop: 4 },

  dayPill: {
    alignSelf: "center",
    backgroundColor: COLORS.pillBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 8,
  },
  dayPillText: { color: COLORS.text, fontSize: 11, fontWeight: "700" },

  composerWrap: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 10, paddingBottom: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairlineStrong,
    backgroundColor: "#0b0e12",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.composerBg,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairlineStrong,
  },
  composerIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 6,
  },
  sendFab: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bubbleMine, marginLeft: 6,
  },
});