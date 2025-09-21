// app/compose.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { endpoints } from "../lib/api";

/* === Assets === */
const coverDefault = require("../assets/images/portada.jpg");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const uploadingAnim = require("../assets/lottie/upload.json");

/* === Helpers === */
const getAvatarSource = (
  p?: { avatar?: string | null; gender?: string | null } | null
) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String(p?.gender || "").toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m") || g.startsWith("h")) return avatarMale;
  return avatarNeutral;
};

type Profile = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender: string | null;
};

export default function ComposeScreen() {
  const router = useRouter();

  /* ===== Estado ===== */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaDim, setMediaDim] = useState<{ w: number; h: number } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Player
  const videoRef = useRef<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [previewFull, setPreviewFull] = useState(false);

  // Igual que Home (vertical): fill → full → tall
  const [portraitFit, setPortraitFit] = useState<"fill" | "full" | "tall">("fill");
  const DESZOOM_TALL = 0.92;

  // Progreso
  const progressWidth = useRef(1);

  /* ===== Perfil ===== */
  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        const res = await fetch(endpoints.finca(), {
          headers: { Authorization: `Token ${tk}` },
        });
        const data = await res.json();
        setProfile({
          username: data?.username || "",
          display_name: data?.display_name || data?.username || "",
          avatar: data?.avatar || null,
          gender: data?.gender || null,
        });
      } catch {}
    })();
  }, []);

  /* ===== Media picker ===== */
  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    const t = (a as any).type === "video" ? "video" : "image";
    setMediaUri(a.uri);
    setMediaType(t);
    setMediaDim({ w: (a as any).width ?? 1, h: (a as any).height ?? 1 });
    setIsPlaying(t === "video");
  };

  /* ===== Player status ===== */
  const onStatus = (s: AVPlaybackStatus) => {
    if (!("isLoaded" in s) || !s.isLoaded) return;
    setDuration(s.durationMillis ?? 0);
    setPosition(s.positionMillis ?? 0);
    setIsPlaying(!!s.isPlaying);
  };

  const togglePlay = async () => {
    if (mediaType !== "video") return;
    try {
      if (isPlaying) await videoRef.current?.pauseAsync();
      else await videoRef.current?.playAsync();
      setIsPlaying(!isPlaying);
    } catch {}
  };

  const seekToRatio = async (r: number) => {
    if (!duration) return;
    const target = Math.max(0, Math.min(duration, Math.floor(duration * r)));
    try {
      await videoRef.current?.setPositionAsync(target);
      setPosition(target);
    } catch {}
  };

  /* ===== Publicar ===== */
  const publish = async () => {
    if (!text.trim() && !mediaUri) {
      Alert.alert("Atención", "Escribe algo o selecciona una foto/video.");
      return;
    }
    try {
      setPublishing(true);
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) throw new Error("No token");

      const form = new FormData();
      form.append("content", text.trim());
      if (mediaUri) {
        const name = mediaType === "video" ? "video.mp4" : "image.jpg";
        const type = mediaType === "video" ? "video/mp4" : "image/jpeg";
        form.append(mediaType!, { uri: mediaUri, name, type } as any);
      }

      const res = await fetch(endpoints.fincaPosts(), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
        body: form,
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Error al publicar");
      }
      const data = await res.json();
      const postId  = Number(data?.id || 0);
      const newVideo = data?.video || "";
      const newImage = data?.image || ""; // ⬅️ importante

      router.replace({
        pathname: "/home",
        params: {
          newPostId: String(postId),
          newVideo,
          newImage,                 // ⬅️ enviamos la URL de imagen también
          newText: text.trim(),
        },
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo publicar");
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = (!!text.trim() || !!mediaUri) && !publishing;
  const progressRatio = duration > 0 ? position / Math.max(1, duration) : 0;

  /* ===== Render media con lógica igual a Home (vertical) ===== */
  const isLandscapeMedia = mediaDim ? mediaDim.w >= mediaDim.h : true;

  const computedMode =
    portraitFit === "fill"
      ? ResizeMode.COVER
      : portraitFit === "full"
      ? ResizeMode.CONTAIN
      : ResizeMode.COVER; // "tall" = cover con des-zoom

  const imageResizeMode: "cover" | "contain" =
    computedMode === ResizeMode.COVER ? "cover" : "contain";

  const mediaExtra =
    portraitFit === "tall" && isLandscapeMedia
      ? { transform: [{ scale: DESZOOM_TALL }] }
      : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={previewFull} />

      {/* === FONDO === */}
      {mediaUri && mediaType === "image" ? (
        <ImageBackground
          source={{ uri: mediaUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={20}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.65)"]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.35)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : !mediaUri ? (
        <ImageBackground
          source={coverDefault}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={18}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.70)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.40)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : null}

      {/* MEDIA principal */}
      {mediaUri ? (
        <View style={styles.videoWrap}>
          {mediaType === "video" ? (
            <Video
              ref={(r) => (videoRef.current = r)}
              source={{ uri: mediaUri }}
              style={[styles.video, mediaExtra]}
              resizeMode={computedMode}
              shouldPlay={true}
              isLooping={true}
              isMuted={isMuted}
              useNativeControls={false}
              onPlaybackStatusUpdate={onStatus}
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={[styles.image, mediaExtra]}
              resizeMode={imageResizeMode}
            />
          )}
        </View>
      ) : null}

      {/* Header + inputs (ocultos en preview full) */}
      {!previewFull && (
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => !publishing && router.back()}
              style={styles.headerLeft}
              disabled={publishing}
            >
              <Ionicons name="close" size={26} color="#fff" />
              <Text style={[styles.headerTitle, styles.txtShadowStrong]}>Crear publicación</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.publishBtn, !canPublish && { opacity: 0.35 }]}
              disabled={!canPublish}
              onPress={publish}
            >
              <Text style={[styles.publishText, styles.txtShadowStrong]}>PUBLICAR</Text>
            </TouchableOpacity>
          </View>

          {/* User */}
          <View style={styles.userRow}>
            <Image source={getAvatarSource(profile)} style={styles.userAvatar} />
            <Text style={[styles.userName, styles.txtShadowStrong]}>
              {profile?.display_name || profile?.username || "Tú"}
            </Text>
          </View>

          {/* Texto */}
          <TextInput
            style={[styles.textArea, styles.txtShadowDark, { minHeight: 120 }]}
            multiline
            placeholder="¿Qué estás pensando?"
            placeholderTextColor="#ddd"
            value={text}
            onChangeText={setText}
            editable={!publishing}
          />

          {/* Zona media */}
          <View style={{ flex: 1, justifyContent: "center", opacity: publishing ? 0.6 : 1 }}>
            {!mediaUri ? (
              <View style={styles.addWrap}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={pickMedia}
                  activeOpacity={0.88}
                  disabled={publishing}
                >
                  <Text style={[styles.addPlus, styles.txtShadowStrong]}>＋</Text>
                  <Text style={[styles.addLabel, styles.txtShadowStrong]}>
                    Agregar foto / video
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.controlsRow}>
                {mediaType === "video" && (
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => setIsMuted((m) => !m)}
                    disabled={publishing}
                  >
                    <Ionicons
                      name={isMuted ? "volume-mute" : "volume-high"}
                      size={18}
                      color="#e0e0e0"
                    />
                    <Text style={[styles.ctrlLabel, styles.txtShadowStrong, styles.pillText]}>
                      {isMuted ? "Silencio" : "Sonido"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.ctrlBtn} onPress={pickMedia} disabled={publishing}>
                  <Ionicons name="swap-horizontal" size={18} color="#e0e0e0" />
                  <Text style={[styles.ctrlLabel, styles.txtShadowStrong, styles.pillText]}>
                    Reemplazar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() => {
                    setMediaUri(null);
                    setMediaType(null);
                    setMediaDim(null);
                  }}
                  disabled={publishing}
                >
                  <Ionicons name="trash-outline" size={18} color="#e0e0e0" />
                  <Text style={[styles.ctrlLabel, styles.txtShadowStrong, styles.pillText]}>
                    Quitar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() => setPreviewFull(true)}
                  disabled={publishing}
                >
                  <MaterialCommunityIcons name="arrow-expand" size={18} color="#e0e0e0" />
                  <Text style={[styles.ctrlLabel, styles.txtShadowStrong, styles.pillText]}>
                    Pantalla completa
                  </Text>
                </TouchableOpacity>

                {/* Botón como Home: LLENAR → 4:16 → ALTO */}
                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() =>
                    setPortraitFit((m) => (m === "fill" ? "full" : m === "full" ? "tall" : "fill"))
                  }
                  disabled={publishing}
                >
                  <MaterialCommunityIcons name="image-size-select-large" size={18} color="#e0e0e0" />
                  <Text style={[styles.ctrlLabel, styles.txtShadowStrong, styles.pillText]}>
                    {portraitFit === "fill" ? "LLENAR" : portraitFit === "full" ? "4:16" : "ALTO"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Barra de progreso (solo video) */}
          {mediaUri && mediaType === "video" && (
            <View style={[styles.progressRoot, { bottom: 16 }]} pointerEvents="box-none">
              <View
                style={styles.progressHit}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  const w = progressWidth.current || 1;
                  const x = e.nativeEvent.locationX ?? 0;
                  seekToRatio(x / w);
                }}
                onResponderMove={(e) => {
                  const w = progressWidth.current || 1;
                  const x = e.nativeEvent.locationX ?? 0;
                  seekToRatio(x / w);
                }}
                onLayout={(e) => {
                  progressWidth.current = e.nativeEvent.layout.width || 1;
                }}
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: Math.max(2, (progressRatio || 0) * (progressWidth.current || 0)) },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      )}

      {/* PREVIEW full-screen */}
      {previewFull && (
        <>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setPreviewFull(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {!!text.trim() && (
            <View style={styles.captionWrap} pointerEvents="none">
              <Text style={[styles.captionText, styles.txtShadowDark]}>{text.trim()}</Text>
            </View>
          )}
        </>
      )}

      {/* ===== Overlay PUBLICANDO ===== */}
      {publishing && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <LottieView source={uploadingAnim} autoPlay loop style={styles.overlayLottie} />
            <Text style={[styles.overlayText, styles.txtShadowStrong]}>
              Publicando, por favor…
            </Text>
            <Text style={[styles.overlaySub, styles.txtShadowStrong]}>No cierres la app</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ===== estilos ===== */
const LIGHT_GREEN = "#a5d6a7";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  videoWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  video: { ...StyleSheet.absoluteFillObject },
  image: { ...StyleSheet.absoluteFillObject },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },

  publishBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  publishText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  userRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)",
  },
  userName: { color: "#fff", fontWeight: "700", marginLeft: 10, fontSize: 15 },

  textArea: { color: "#fff", fontSize: 18, paddingHorizontal: 16, paddingVertical: 6, textAlignVertical: "top" },

  addWrap: { alignItems: "center", justifyContent: "center", paddingTop: 16 },
  addBtn: {
    width: 220, height: 130, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  addPlus: { color: "#fff", fontSize: 36, marginBottom: 6 },
  addLabel: { color: "#e0e0e0", fontSize: 14 },

  controlsRow: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 12, marginTop: 12, gap: 8,
  },
  ctrlBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)", flexShrink: 1,
  },
  ctrlLabel: { color: "#e0e0e0", fontSize: 12, fontWeight: "700" },

  progressRoot: { position: "absolute", left: 14, right: 14 },
  progressHit: { paddingVertical: 8 },
  progressTrack: { height: 4, width: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: LIGHT_GREEN },

  captionWrap: {
    position: "absolute", left: 18, right: 18, bottom: 18, backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 12, padding: 10,
  },
  captionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  fullscreenClose: {
    position: "absolute", right: 14, top: 14, width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", zIndex: 10,
  },

  txtShadowStrong: {
    textShadowColor: "rgba(0,0,0,1)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  txtShadowDark: {
    textShadowColor: "rgba(0,0,0,1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },

  pillText: { backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },

  /* ===== Overlay de publicación ===== */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  overlayCard: {
    width: 240,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  overlayLottie: { width: 140, height: 140 },
  overlayText: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 6 },
  overlaySub: { color: "rgba(255,255,255,0.95)", fontSize: 12, marginTop: 2 },
});
