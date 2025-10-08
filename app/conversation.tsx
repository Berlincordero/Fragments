// app/conversation.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Alert
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
};
type PageRes = { results: Msg[]; next: string | null; previous: string | null };

const avatarFallback = require("../assets/images/avatar.png");

const COLORS = {
  bg: "#0b0b0b",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  text: "#fff",
  textDim: "#A8A8A8",
  bubbleMine: "#1f6feb",
  bubbleOther: "#262626",
  pillBg: "rgba(255,255,255,0.08)",
};

const HEADER_H = 60;
const MAX_INPUT_H = 140;

/* Util: normaliza URL relativa → absoluta (como en otras pantallas) */
const normalizeURL = (u?: string | null) => {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = api("");
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
};

/* ---- Reproductor de audio (sencillo) para cada mensaje ---- */
function AudioBubble({ uri }: { uri: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, [sound]);

  const toggle = async () => {
    try {
      if (!sound) {
        const { sound: s } = await Audio.Sound.createAsync({ uri });
        setSound(s);
        await s.playAsync();
        setPlaying(true);
        s.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish || st.isLoaded && !st.isPlaying) {
            setPlaying(false);
          }
        });
      } else {
        const st = await sound.getStatusAsync();
        if ((st as any).isPlaying) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          await sound.playAsync();
          setPlaying(true);
        }
      }
    } catch (e: any) {
      Alert.alert("Audio", e?.message || "No se pudo reproducir el audio.");
    }
  };

  return (
    <TouchableOpacity onPress={toggle} style={styles.audioBtn}>
      <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
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
    } finally {
      setSending(false);
    }
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
      // type puede variar; usamos mp4 por compatibilidad
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
      // Detectamos mime básico
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
        // start
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
        await rec.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        await rec.startAsync();
        setRecording(rec);
      } else {
        // stop & send
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (!uri) { setAudioBusy(false); return; }

        // duración (best effort)
        let duration = 0;
        try {
          const info = await FileSystem.getInfoAsync(uri);
          // sin metadata de duración, dejamos 0 (opcional)
        } catch {}

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

  /* UI listas */
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

    /* bloques multimedia */
    const imageURL = normalizeURL(item.image || undefined);
    const videoURL = normalizeURL(item.video || undefined);
    const audioURL = normalizeURL(item.audio || undefined);
    const docURL = normalizeURL(item.document || undefined);

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
            {!!item.text && <Text style={styles.msgText}>{item.text}</Text>}

            {!!imageURL && (
              <Image source={{ uri: imageURL }} style={styles.msgImage} />
            )}

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
              <TouchableOpacity
                onPress={() => Linking.openURL(docURL)}
                style={styles.docBtn}
              >
                <Ionicons name="document-text-outline" size={16} color="#fff" />
                <Text style={styles.docTxt}>
                  {item.document_name || "Archivo adjunto"}
                </Text>
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

  const keyExtractor = (m: Msg, i: number) =>
    m?.id ? `m-${m.id}` : `tmp-${m.created_at}-${i}`;

  const canSend = !!text.trim() && !sending;

  return (
    <View style={styles.bg}>
      {/* Degradados como en finca.tsx */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.70)"]}
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

          <Image
            source={normalizeURL(avatar) ? { uri: normalizeURL(avatar)! } : avatarFallback}
            style={styles.headerAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerTitle}>{headerTitle}</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>Activo(a) recientemente</Text>
          </View>

          {/* Solo info (quitados call/video) */}
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
                {/* Emojis (placeholder) */}
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

                {/* 📷 Cámara (tap = foto; long-press = video) */}
                <TouchableOpacity
                  style={styles.composerIcon}
                  activeOpacity={0.9}
                  onPress={takePhoto}
                  onLongPress={takeVideo}
                >
                  <Ionicons name="camera-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                {/* 📎 Clip → archivos */}
                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickDocument}>
                  <Ionicons name="attach-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                {/* 🖼️ Imágenes */}
                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickImage}>
                  <Ionicons name="image-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                {/* 🎬 Videos */}
                <TouchableOpacity style={styles.composerIcon} activeOpacity={0.9} onPress={pickVideo}>
                  <Ionicons name="videocam-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>

                {/* 🎤 Mic: grabar/stop y enviar */}
                <TouchableOpacity
                  style={[styles.composerIcon, recording && { backgroundColor: "rgba(255,0,0,0.25)", borderRadius: 17 }]}
                  activeOpacity={0.9}
                  onPress={toggleRecord}
                >
                  <Ionicons name={recording ? "stop" : "mic-outline"} size={20} color={COLORS.text} />
                </TouchableOpacity>

                {/* Enviar */}
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
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 8,
  },
  iconGhost: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginLeft: 6,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: "#000" },
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
  meta: { color: COLORS.textDim, fontSize: 11, marginTop: 6 },

  msgImage: {
    width: 240, height: 240, borderRadius: 10, marginTop: 6, backgroundColor: "#000"
  },

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
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
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
    backgroundColor: COLORS.bubbleMine, marginLeft: 6,
  },

  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  audioTxt: { color: "#fff", fontWeight: "700" },

  docBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  docTxt: { color: "#fff", fontWeight: "700" },

  uploadHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 10,
  },
  uploadTxt: { color: COLORS.textDim, fontSize: 12, fontWeight: "700" },
});
