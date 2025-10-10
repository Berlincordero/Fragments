// app/conversation.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Alert, Modal
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode, Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { endpoints, api } from "../lib/api";

type Msg = {
  id: number;
  room: number;
  sender: { id: number; username: string };
  text: string;
  image?: string | null;
  audio?: string | null;
  audio_duration?: number | null;
  video?: string | null;
  document?: string | null;
  document_name?: string | null;
  document_mime?: string | null;
  created_at: string;

  can_edit?: boolean;
  can_delete?: boolean;
  can_void?: boolean;
  voided_at?: string | null;
};
type PageRes = { results: Msg[]; next: string | null; previous: string | null };

const avatarFallback = require("../assets/images/avatar.png");

/** Paleta sobria tipo social */
const COLORS = {
  bg: "#0a0a0a",
  surface: "rgba(255,255,255,0.06)",
  surfaceDeep: "rgba(255,255,255,0.04)",
  glassBorder: "rgba(255,255,255,0.10)",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  text: "#F3F4F6",
  textDim: "#AEB1B7",
  textMuted: "#8D9198",
  bubbleMine: "#3F7DE6",    // acento más discreto
  bubbleOther: "#1E1F22",
  pillBg: "rgba(255,255,255,0.07)",
  /** Acentos del modal: suaves, no chillones */
  primary: "#5C8EF2",
  warn: "#FFC56B",
  danger: "#FF6B6B",
  success: "#67E8A5",
};

const HEADER_H = 60;
const MAX_INPUT_H = 140;

/* ─── Config presencia ─── */
const PRESENCE_POLL_MS = 15000;
const RECENT_MINUTES = 10;

/* Util: normaliza URL relativa → absoluta */
const normalizeURL = (u?: string | null) => {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = api("");
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
};

/* timeago ES corto */
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

/* ---- Reproductor de audio simple ---- */
function AudioBubble({ uri }: { uri: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync().catch(() => {}); };
  }, [sound]);

  const toggle = async () => {
    try {
      if (!sound) {
        const { sound: s } = await Audio.Sound.createAsync({ uri });
        setSound(s);
        await s.playAsync();
        setPlaying(true);
        s.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish || (st.isLoaded && !st.isPlaying)) setPlaying(false);
        });
      } else {
        const st = await sound.getStatusAsync();
        if ((st as any).isPlaying) { await sound.pauseAsync(); setPlaying(false); }
        else { await sound.playAsync(); setPlaying(true); }
      }
    } catch (e: any) {
      Alert.alert("Audio", e?.message || "No se pudo reproducir el audio.");
    }
  };

  return (
    <TouchableOpacity onPress={toggle} style={styles.audioBtn}>
      <Ionicons name={playing ? "pause" : "play"} size={18} color={COLORS.text} />
      <Text style={styles.audioTxt}>{playing ? "Pausar" : "Reproducir"} audio</Text>
    </TouchableOpacity>
  );
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
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

  /* Envío */
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");

  /* Grabación de audio */
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);

  const [composerH, setComposerH] = useState(56);
  const [uploading, setUploading] = useState(false);

  const [selfUsername, setSelfUsername] = useState<string>("");

  /* Presencia */
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  /* Modal acciones por mensaje */
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [editText, setEditText] = useState("");
  const [working, setWorking] = useState(false);

  // Modal de información (i)
  const [infoOpen, setInfoOpen] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);

  const getToken = useCallback(async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  }, []);

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

  const fetchPage = useCallback(async (rid: number, tk: string, pageNum = 1) => {
    const url = endpoints.chatsMessages(rid, pageNum);
    const res = await fetch(url, { headers: { Authorization: `Token ${tk}` } });
    if (!res.ok) return [] as Msg[];
    const json = (await res.json()) as PageRes | Msg[];
    const arr: Msg[] = Array.isArray((json as any).results) ? (json as any).results : (json as any);
    return [...arr].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, []);

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

  /* Polling de presencia */
  const pollPresenceOnce = useCallback(async () => {
    if (!targetUsername) return;
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.chatsPresence([targetUsername]), {
        headers: { Authorization: `Token ${tk}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { username: string; is_online: boolean; last_seen: string | null }[];
      const row = data?.[0];
      if (row) {
        setIsOnline(!!row.is_online);
        setLastSeen(row.last_seen ?? null);
      }
    } catch {}
  }, [getToken, targetUsername]);

  useEffect(() => {
    let interval: any;
    (async () => {
      await pollPresenceOnce();
      interval = setInterval(pollPresenceOnce, PRESENCE_POLL_MS);
    })();
    return () => interval && clearInterval(interval);
  }, [pollPresenceOnce]);

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

  /* ─────────────────────── Envíos ─────────────────────── */
  const appendAndScroll = (msg: Msg) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 40);
  };

  const sendText = useCallback(async () => {
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
      appendAndScroll(j);
      try { await fetch(endpoints.chatsMarkRead(roomId), { method: "POST", headers: { Authorization: `Token ${tk}` } }); } catch {}
    } catch (e: any) {
      Alert.alert("Chat", e?.message || "No se pudo enviar.");
    } finally { setSending(false); }
  }, [roomId, text, sending, getToken]);

  const postFormData = async (fd: FormData) => {
    if (!roomId) throw new Error("Room inválido");
    const tk = await getToken();
    const res = await fetch(endpoints.chatsMessages(roomId), { method: "POST", headers: { Authorization: `Token ${tk}` }, body: fd });
    const j = await res.json();
    if (!res.ok || !j?.id) throw new Error(j?.detail || "No se pudo enviar archivo");
    appendAndScroll(j);
  };

  /* Imagen desde galería */
  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (res.canceled) return;
      const a = res.assets[0];
      const fd = new FormData();
      fd.append("image", { uri: a.uri, name: "image.jpg", type: "image/jpeg" } as any);
      if (text.trim()) fd.append("text", text.trim());
      setUploading(true);
      await postFormData(fd);
      setText("");
    } catch (e: any) {
      Alert.alert("Imagen", e?.message || "No se pudo adjuntar la imagen.");
    } finally { setUploading(false); }
  };

  /* Video desde galería */
  const pickVideo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
      if (res.canceled) return;
      const a = res.assets[0];
      const fd = new FormData();
      fd.append("video", { uri: a.uri, name: "video.mp4", type: "video/mp4" } as any);
      if (text.trim()) fd.append("text", text.trim());
      setUploading(true);
      await postFormData(fd);
      setText("");
    } catch (e: any) {
      Alert.alert("Video", e?.message || "No se pudo adjuntar el video.");
    } finally { setUploading(false); }
  };

  /* Cámara: foto */
  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Cámara", "Permiso denegado."); return; }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (res.canceled) return;
      const a = res.assets[0];
      const fd = new FormData();
      fd.append("image", { uri: a.uri, name: "photo.jpg", type: "image/jpeg" } as any);
      if (text.trim()) fd.append("text", text.trim());
      setUploading(true);
      await postFormData(fd);
      setText("");
    } catch (e: any) {
      Alert.alert("Cámara", e?.message || "No se pudo tomar/enviar la foto.");
    } finally { setUploading(false); }
  };

  /* Cámara: video */
  const takeVideo = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Cámara", "Permiso denegado."); return; }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
      if (res.canceled) return;
      const a = res.assets[0];
      const fd = new FormData();
      fd.append("video", { uri: a.uri, name: "capture.mp4", type: "video/mp4" } as any);
      if (text.trim()) fd.append("text", text.trim());
      setUploading(true);
      await postFormData(fd);
      setText("");
    } catch (e: any) {
      Alert.alert("Cámara", e?.message || "No se pudo grabar/enviar el video.");
    } finally { setUploading(false); }
  };

  /* Archivos: PDF, XML, DOCX, PPTX, etc. */
  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: "*/*" });
      if (res.canceled) return;
      const f = res.assets?.[0];
      if (!f?.uri) return;
      const name = f.name || "archivo";
      let mime = f.mimeType || "application/octet-stream";
      if (!mime && name.endsWith(".xml")) mime = "application/xml";
      if (!mime && name.endsWith(".pdf")) mime = "application/pdf";

      const fd = new FormData();
      fd.append("document", { uri: f.uri, name, type: mime } as any);
      fd.append("document_name", name);
      fd.append("document_mime", mime);
      if (text.trim()) fd.append("text", text.trim());
      setUploading(true);
      await postFormData(fd);
      setText("");
    } catch (e: any) {
      Alert.alert("Archivo", e?.message || "No se pudo adjuntar el archivo.");
    } finally { setUploading(false); }
  };

  /* Audio: grabar/stop y enviar */
  const toggleRecord = async () => {
    if (audioBusy) return;
    setAudioBusy(true);
    try {
      if (!recording) {
        const { status } = await Audio.requestPermissionsAsync();
        if (!status || (status as any).status !== "granted") {
          setAudioBusy(false);
          Alert.alert("Micrófono", "Permiso denegado.");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        setRecording(rec);
      } else {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (!uri) { setAudioBusy(false); return; }

        let duration = 0;
        try { await FileSystem.getInfoAsync(uri); } catch {}

        const fd = new FormData();
        fd.append("audio", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
        if (duration) fd.append("audio_duration", String(duration));
        setUploading(true);
        await postFormData(fd);
      }
    } catch (e: any) {
      Alert.alert("Audio", e?.message || "No se pudo grabar/enviar el audio.");
    } finally {
      setAudioBusy(false);
      setUploading(false);
    }
  };

  /* Acciones por mensaje */
  const openActions = (m: Msg) => {
    setSelected(m);
    setEditText(m.text || "");
    setActionsOpen(true);
  };
  const closeActions = () => setActionsOpen(false);

  const doEdit = async () => {
    if (!selected) return;
    const newText = editText.trim();
    if (!newText) { Alert.alert("Editar", "El texto no puede estar vacío."); return; }
    setWorking(true);
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.chatsMessageDetail(selected.id), {
        method: "PATCH",
        headers: { Authorization: `Token ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.detail || "No se pudo editar");
      setMessages((prev) => prev.map((x) => (x.id === selected.id ? { ...x, text: newText } : x)));
      closeActions();
    } catch (e: any) {
      Alert.alert("Editar", e?.message || "Error al editar el mensaje.");
    } finally { setWorking(false); }
  };

  const doDelete = async () => {
    if (!selected) return;
    setWorking(true);
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.chatsMessageDetail(selected.id), {
        method: "DELETE",
        headers: { Authorization: `Token ${tk}` },
      });
      if (!res.ok) {
        let j: any = {};
        try { j = await res.json(); } catch {}
        throw new Error(j?.detail || "No se pudo borrar");
      }
      setMessages((prev) => prev.filter((x) => x.id !== selected.id));
      closeActions();
    } catch (e: any) {
      Alert.alert("Borrar", e?.message || "Error al borrar el mensaje.");
    } finally { setWorking(false); }
  };

  const doVoid = async () => {
    if (!selected) return;
    setWorking(true);
    try {
      const tk = await getToken();
      const res = await fetch(endpoints.chatsMessageVoid(selected.id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.detail || "No se pudo anular");
      setMessages((prev) =>
        prev.map((x) =>
          x.id === selected.id
            ? {
                ...x,
                text: "(Mensaje anulado)",
                image: null,
                audio: null,
                video: null,
                document: null,
                voided_at: new Date().toISOString(),
              }
            : x
        )
      );
      closeActions();
    } catch (e: any) {
      Alert.alert("Anular", e?.message || "Error al anular el mensaje.");
    } finally { setWorking(false); }
  };

  /* UI listas */
  const headerTitle = useMemo(
    () => (displayName ? String(displayName) : targetUsername ? `@${targetUsername}` : "Chat"),
    [displayName, targetUsername]
  );

  /* Derivados de presencia para UI */
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
  const minutesSince = lastSeen ? Math.floor((Date.now() - lastSeenMs) / 60000) : Number.POSITIVE_INFINITY;
  const recentlyActive = !isOnline && lastSeen && minutesSince <= RECENT_MINUTES;

  const presenceSubtitle = isOnline
    ? "En línea"
    : recentlyActive
      ? `Activo ${timeAgo(lastSeen)}`
      : lastSeen
        ? `Activo ${timeAgo(lastSeen)}`
        : "Desconectado";

  const presenceDotColor = isOnline ? "#67E8A5" : recentlyActive ? "#FFC56B" : "#FF6B6B";

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

    /* bloques multimedia */
    const imageURL = normalizeURL(item.image || undefined);
    const videoURL = normalizeURL(item.video || undefined);
    const audioURL = normalizeURL(item.audio || undefined);
    const docURL = normalizeURL(item.document || undefined);

    const actionable = !!(item.can_edit || item.can_delete || item.can_void);

    return (
      <>
        {showDay && renderDayPill(ts)}
        <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
          {!mine && (
            <Image
              source={normalizeURL(avatar) ? { uri: normalizeURL(avatar)! } : avatarFallback}
              style={styles.avatar}
            />
          )}
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            {/* Hoja (planta) */}
            {actionable && (
              <TouchableOpacity
                onPress={() => openActions(item)}
                style={styles.leafBtn}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="leaf-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
            )}

            {!!item.text && <Text style={styles.msgText}>{item.text}</Text>}

            {!!imageURL && <Image source={{ uri: imageURL }} style={styles.msgImage} />}

            {!!videoURL && (
              <View style={{ width: 240, height: 320, borderRadius: 10, overflow: "hidden", marginTop: 6 }}>
                <Video
                  source={{ uri: videoURL }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls
                />
              </View>
            )}

            {!!audioURL && (
              <View style={{ marginTop: 6 }}>
                <AudioBubble uri={audioURL} />
              </View>
            )}

            {!!docURL && (
              <TouchableOpacity onPress={() => Linking.openURL(docURL!)} style={styles.docBtn}>
                <Ionicons name="document-text-outline" size={16} color={COLORS.text} />
                <Text style={styles.docTxt}>{item.document_name || "Archivo adjunto"}</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.meta, mine && { alignSelf: "flex-end" }]}>
              {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </>
    );
  };

  const keyExtractor = (m: Msg, i: number) => (m?.id ? `m-${m.id}` : `tmp-${m.created_at}-${i}`);

  const canSend = !!text.trim() && !sending;

  /* helper (no editar si hay imagen/video) */
  const canEditSelected = !!(
    selected &&
    selected.can_edit &&
    !selected.image &&
    !selected.video
  );

  return (
    <View style={styles.bg}>
      {/* Fondo con sutiles degradados */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.62)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.68)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bgTint}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.40)"]}
        locations={[0, 0.5, 1]}
        style={styles.bgVignette}
      />

      <SafeAreaView style={styles.safe}>
        {/* Header fijo */}
        <View style={[styles.header, { height: HEADER_H }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ position: "relative", marginRight: 10 }}>
            <Image
              source={normalizeURL(avatar) ? { uri: normalizeURL(avatar)! } : avatarFallback}
              style={styles.headerAvatar}
            />
            {/* dot de presencia */}
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: presenceDotColor,
                borderWidth: 2,
                borderColor: "#0a0a0a",
              }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerTitle}>{headerTitle}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.headerSubtitle,
                isOnline && { color: COLORS.success },
                !isOnline && recentlyActive && { color: COLORS.warn },
              ]}
            >
              {presenceSubtitle}
            </Text>
          </View>

          {/* Botón info (i) */}
          <TouchableOpacity
            style={styles.iconGhost}
            onPress={() => setInfoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Información del chat"
          >
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
            keyboardVerticalOffset={insets.top + HEADER_H}
          >
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={{ flex: 1 }}
              inverted
              contentContainerStyle={{
                paddingHorizontal: 10,
                paddingTop: 8,
                paddingBottom: 8,
              }}
              ListHeaderComponent={<View style={{ height: composerH + insets.bottom + 8 }} />}
              onEndReachedThreshold={0.12}
              onEndReached={loadMore}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} /> : <View />
              }
              removeClippedSubviews
              initialNumToRender={15}
              maxToRenderPerBatch={12}
              windowSize={9}
            />

            {/* Composer */}
            <View
              style={[
                styles.composerWrap,
                { paddingBottom: Math.max(10, 10 + insets.bottom) },
              ]}
              onLayout={(e) => setComposerH(Math.round(e.nativeEvent.layout.height))}
            >
              <View style={styles.composer}>
                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9}>
                  <Ionicons name="happy-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, { maxHeight: MAX_INPUT_H }]}
                  placeholder="Enviar mensaje…"
                  placeholderTextColor={COLORS.textDim}
                  value={text}
                  onChangeText={setText}
                  multiline
                />

                <TouchableOpacity
                  style={styles.composerIcon}
                  activeOpacity={0.9}
                  onPress={takePhoto}
                  onLongPress={takeVideo}
                >
                  <Ionicons name="camera-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickDocument}>
                  <Ionicons name="attach-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickImage}>
                  <Ionicons name="image-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickVideo}>
                  <Ionicons name="videocam-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.composerIcon, recording && { backgroundColor: "rgba(255,0,0,0.18)", borderRadius: 17 }]}
                  activeOpacity={0.9}
                  onPress={toggleRecord}
                >
                  <Ionicons name={recording ? "stop" : "mic-outline"} size={20} color={COLORS.text} />
                </TouchableOpacity>

                {canSend && (
                  <TouchableOpacity onPress={sendText} style={styles.sendFab} disabled={!canSend} activeOpacity={0.9}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>

              {uploading && (
                <View style={styles.uploadHint}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.uploadTxt}>Enviando adjunto…</Text>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      {/* Modal acciones – estilo social/IG */}
      <Modal visible={actionsOpen} animationType="fade" transparent onRequestClose={closeActions}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={closeActions} />
          <View style={styles.modalSheetWrap}>
            <LinearGradient
              colors={["#151518", "#111114", "#0E0E10"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalSheet}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Acciones</Text>

              {/* Editar (solo si NO hay imagen/video) */}
              {selected && selected.can_edit && !selected.image && !selected.video && (
                <>
                  <Text style={styles.modalLabel}>Editar texto</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Escribe el nuevo texto…"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={doEdit}
                    style={[styles.modalTile, styles.tilePrimary]}
                    disabled={working}
                    activeOpacity={0.9}
                  >
                    {working ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={styles.tileRow}>
                        <View style={[styles.tileIconWrap, styles.tileIconPrimary]}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                        <Text style={styles.tileTxt}>Guardar cambios</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Anular */}
              {selected?.can_void && (
                <TouchableOpacity
                  onPress={doVoid}
                  style={[styles.modalTile, styles.tileWarn]}
                  disabled={working}
                  activeOpacity={0.9}
                >
                  {working ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <View style={styles.tileRow}>
                      <View style={[styles.tileIconWrap, styles.tileIconWarn]}>
                        <Ionicons name="ban" size={16} color="#1a1a1a" />
                      </View>
                      <Text style={[styles.tileTxt, { color: "#1a1a1a" }]}>Anular mensaje</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Eliminar */}
              {selected?.can_delete && (
                <TouchableOpacity
                  onPress={doDelete}
                  style={[styles.modalTile, styles.tileDanger]}
                  disabled={working}
                  activeOpacity={0.9}
                >
                  {working ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.tileRow}>
                      <View style={[styles.tileIconWrap, styles.tileIconDanger]}>
                        <Ionicons name="trash" size={16} color="#fff" />
                      </View>
                      <Text style={styles.tileTxt}>Eliminar</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={closeActions}
                style={[styles.modalTile, styles.tileNeutral]}
                activeOpacity={0.9}
              >
                <View style={styles.tileRow}>
                  <View style={[styles.tileIconWrap, styles.tileIconNeutral]}>
                    <Ionicons name="close" size={16} color="#0f1012" />
                  </View>
                  <Text style={[styles.tileTxt, { color: "#0f1012" }]}>Cerrar</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Modal de información (i) */}
      <Modal
        visible={infoOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setInfoOpen(false)}
          />
          <View style={styles.modalSheetWrap}>
            <LinearGradient
              colors={["#151518", "#111114", "#0E0E10"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalSheet}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Información y seguridad del chat</Text>

              <Text style={styles.infoParagraph}>
                Las conversaciones de este chat están encriptadas de extremo a extremo.
              </Text>
              <Text style={styles.infoParagraph}>
                Sin embargo, la plataforma integra controles de seguridad y monitoreo de contenido. Esto quiere decir que el sistema automáticamente detecta contenido ilegal, el cual es enviado a un moderador y el moderador se encarga de pasarlo a legal si se requiere.
              </Text>
              <Text style={[styles.infoParagraph, styles.infoEmphasis]}>
                — Evite poner a usted y su familia en riesgo. No use este chat para cosas ilícitas. Gracias.
              </Text>

              <TouchableOpacity
                onPress={() => setInfoOpen(false)}
                style={[styles.modalTile, styles.tilePrimary]}
                activeOpacity={0.9}
              >
                <View style={styles.tileRow}>
                  <View style={[styles.tileIconWrap, styles.tileIconPrimary]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={styles.tileTxt}>Entendido</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  bgTint: { ...StyleSheet.absoluteFillObject },
  bgVignette: { ...StyleSheet.absoluteFillObject },
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.glassBorder,
    marginRight: 8,
  },
  iconGhost: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginLeft: 6,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#000" },
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
    position: "relative",
    paddingBottom: 26, // espacio para la hoja
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

  /* Botón hoja (planta) */
  leafBtn: {
    position: "absolute",
    right: -8,
    bottom: -12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  msgText: { color: COLORS.text, fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 11, marginTop: 6 },

  msgImage: { width: 240, height: 240, borderRadius: 10, marginTop: 6, backgroundColor: "#000" },

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
    paddingHorizontal: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairlineStrong,
    backgroundColor: "transparent",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.glassBorder,
  },
  composerIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 6,
    maxHeight: MAX_INPUT_H,
  },
  sendFab: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.primary, marginLeft: 6,
  },

  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.glassBorder,
  },
  audioTxt: { color: COLORS.text, fontWeight: "700" },

  docBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.glassBorder,
  },
  docTxt: { color: COLORS.text, fontWeight: "700" },

  uploadHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 10,
  },
  uploadTxt: { color: COLORS.textDim, fontSize: 12, fontWeight: "700" },

  /* ───────── Modal: estilo social/IG ───────── */
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalBackdropTouch: { ...StyleSheet.absoluteFillObject },
  modalSheetWrap: { width: "100%" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 8,
  },
  modalTitle: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  modalLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 6, marginTop: 6 },
  modalInput: {
    minHeight: 44,
    maxHeight: 140,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  /* Texto modal info */
  infoParagraph: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  infoEmphasis: {
    fontWeight: "800",
    color: "#FFE082",
    marginTop: 12,
  },

  /* Tiles (chips) del modal */
  modalTile: {
    marginTop: 10,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tileTxt: { color: COLORS.text, fontWeight: "800", fontSize: 14 },

  tileIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  tileIconPrimary: { backgroundColor: "rgba(92,142,242,0.9)" },
  tileIconWarn: { backgroundColor: COLORS.warn },
  tileIconDanger: { backgroundColor: "rgba(255,107,107,0.95)" },
  tileIconNeutral: { backgroundColor: "#E5E7EB" },

  /* Variantes de fondo del tile (ligeras, para no gritar) */
  tilePrimary: { backgroundColor: "rgba(92,142,242,0.12)", borderColor: "rgba(92,142,242,0.35)" },
  tileWarn: { backgroundColor: "rgba(255,197,107,0.16)", borderColor: "rgba(255,197,107,0.45)" },
  tileDanger: { backgroundColor: "rgba(255,107,107,0.16)", borderColor: "rgba(255,107,107,0.45)" },
  tileNeutral: { backgroundColor: "#E5E7EB", borderColor: "#E5E7EB" },
});
