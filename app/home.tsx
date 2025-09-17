// app/home.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  Alert,
} from "react-native";
import {
  Video,
  ResizeMode,
  Audio,
  AVPlaybackStatus,
  AVPlaybackStatusSuccess,
} from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { endpoints } from "../lib/api";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

/* Modales */
import CommentsModal from "./components/CommentsModal";
import StarrersModal from "./components/StarrersModal";
import SaverModal from "./components/SaverModal";
import RepostersModal from "./components/RepostersModal";

/* ===== Ajustes rápidos visuales ===== */
const AV_SIZE = 52;
const SCALE = 1.02;
const CENTER_BIAS = -0.18;

/* ===== Assets ===== */
const DEFAULT_VIDEO = require("../assets/videos/default.mp4");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const DEMO_USER_AVATAR = require("../assets/images/demo_avatar.png");

/* ===== Demo-only ===== */
const IS_DEMO_VIDEO = true;
const DEMO_USER_NAME = "Bribri";

/* ===== Tabs ===== */
const TABS = ["FEELINGS", "PUBLICACIONES", "PODCAST", "TIENDA"] as const;

/* ===== Tipos ===== */
type Gender = "M" | "F" | "O";
type Profile = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender: Gender | string | null;
};

type FeedPost = {
  id: number;
  stars_count?: number;
  has_starred?: boolean;
  comments_count?: number;
  reposts_count?: number;
  has_reposted?: boolean;
  saves_count?: number;
  has_saved?: boolean;
};

type MiniUser = { username: string; display_name: string; avatar: string | null };

/* ===== Helper avatar ===== */
const getAvatarSource = (p?: Pick<Profile, "avatar" | "gender"> | { avatar?: string | null; gender?: string | null } | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export const options = { headerShown: false };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLand = width > height; // landscape = fullscreen
  const immersive = isLand;

  // Player / overlay
  const videoRef = useRef<Video>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hudVisible, setHudVisible] = useState(false);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressWidth = useRef(1);

  // Perfil (avatar superior)
  const [profile, setProfile] = useState<Profile | null>(null);

  // Carrusel
  const [tabIndex, setTabIndex] = useState(1); // default: PUBLICACIONES
  const scrollRef = useRef<ScrollView>(null);

  // Altura real del bloque de controles (badge + reacciones)
  const [controlsH, setControlsH] = useState(0);

  // Backend post-id + contadores
  const [postId, setPostId] = useState<number | null>(null);
  const [starred, setStarred] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);

  const [starCount, setStarCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);

  // Preview “X te dio una estrella”
  const [lastStarrer, setLastStarrer] = useState<MiniUser | null>(null);

  // Modales
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [starrersVisible, setStarrersVisible] = useState(false);
  const [saverVisible, setSaverVisible] = useState(false);
  const [repostersVisible, setRepostersVisible] = useState(false);

  // HUD
  const showHUD = (ms = 1200) => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), ms);
  };
  useEffect(() => () => { if (hudTimer.current) clearTimeout(hudTimer.current); }, []);

  // Inicial: llevar a PUBLICACIONES
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: width * 1, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [width]);

  // Audio
  useEffect(() => {
    (async () => {
      try {
        const IOS_DNM = (Audio as any).INTERRUPTION_MODE_IOS_DO_NOT_MIX ?? 1;
        const AND_DNM = (Audio as any).INTERRUPTION_MODE_ANDROID_DO_NOT_MIX ?? 1;
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: IOS_DNM,
          interruptionModeAndroid: AND_DNM,
          shouldDuckAndroid: true,
        });
      } catch {}
    })();
  }, []);

  // Perfil
  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        const res = await fetch(endpoints.finca(), { headers: { Authorization: `Token ${tk}` } });
        const data = (await res.json()) as Profile;
        setProfile(data);
      } catch {}
    })();
  }, []);

  // Feed → set ids/contadores
  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;

        const res = await fetch(endpoints.feedAll(), { headers: { Authorization: `Token ${tk}` } });
        const json = await res.json();

        const first: FeedPost | undefined = Array.isArray(json?.results)
          ? json.results?.[0]
          : json?.[0];

        if (!first) return;

        setPostId(first.id);
        setStarCount(Number(first.stars_count || 0));
        setCommentCount(Number(first.comments_count || 0));
        setRepostCount(Number(first.reposts_count || 0));
        setSaveCount(Number(first.saves_count || 0));
        setStarred(!!first.has_starred);
        setHasReposted(!!first.has_reposted);
        setSaved(!!first.has_saved);

        // Cargar preview del último que dio estrella
        fetchStarPreview(first.id).catch(()=>{});
      } catch {
        // silencioso
      }
    })();
  }, []);

  // Helpers
  const ensureToken = async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  };

  const fetchStarPreview = async (pid: number) => {
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostStarrers(pid), {
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      const u = Array.isArray(data?.results) ? data.results[0] as MiniUser | undefined : undefined;
      setLastStarrer(u || null);
    } catch {}
  };

  // Status del video
  const onStatus = (s: AVPlaybackStatus) => {
    if (!("isLoaded" in s) || !s.isLoaded) return;
    const ss = s as AVPlaybackStatusSuccess;
    setDuration(ss.durationMillis ?? 0);
    setPosition(ss.positionMillis ?? 0);
    setIsPlaying(!!ss.isPlaying);
  };

  // Scrub
  const seekToRatio = async (r: number) => {
    if (!duration) return;
    const clamped = Math.max(0, Math.min(1, r));
    const target = Math.floor(duration * clamped);
    try { await videoRef.current?.setPositionAsync(target); setPosition(target); } catch {}
  };
  const handleProgressTouch = (evt: any) => {
    const x = evt.nativeEvent.locationX ?? 0;
    const w = progressWidth.current || 1;
    seekToRatio(x / w);
    showHUD(1600);
  };
  const handleProgressMove = (evt: any) => {
    const x = evt.nativeEvent.locationX ?? 0;
    const w = progressWidth.current || 1;
    seekToRatio(x / w);
  };

  const togglePlay = async () => {
    try {
      if (isPlaying) await videoRef.current?.pauseAsync();
      else await videoRef.current?.playAsync();
      setIsPlaying(!isPlaying);
      showHUD();
    } catch {}
  };

  /* ─────────── REACCIONES ─────────── */

  // ⭐ Estrella (optimista + backend)
  const handleToggleStar = async () => {
    if (!postId) return;
    // optimista
    setStarred(prev => !prev);
    setStarCount(prev => (starred ? Math.max(0, prev - 1) : prev + 1));
    if (!starred && profile) {
      // al dar estrella, muestra tu propio nombre mientras llega el backend
      setLastStarrer({ username: profile.username, display_name: profile.display_name || profile.username, avatar: profile.avatar });
    }
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostStar(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      setStarred(!!data.has_starred);
      setStarCount(Number(data.stars_count || 0));
      // refrescar preview real
      fetchStarPreview(postId).catch(()=>{});
    } catch {
      // revertir si falla
      setStarred(prev => !prev);
      setStarCount(prev => (starred ? prev + 1 : Math.max(0, prev - 1)));
      Alert.alert("Error", "No se pudo actualizar la estrella.");
    }
  };

  // 🔖 Guardar
  const handleToggleSave = async () => {
    if (!postId) return;
    // optimista
    setSaved(prev => !prev);
    setSaveCount(prev => (saved ? Math.max(0, prev - 1) : prev + 1));
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostSave(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      setSaved(!!data.has_saved);
      setSaveCount(Number(data.saves_count || 0));
    } catch {
      setSaved(prev => !prev);
      setSaveCount(prev => (saved ? prev + 1 : Math.max(0, prev - 1)));
      Alert.alert("Error", "No se pudo actualizar el guardado.");
    }
  };

  // 🔁 Repost (compartir dentro de la app)
  const handleRepost = async () => {
    if (!postId) return;
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostRepost(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
        body: JSON.stringify({}), // caption opcional
      });
      const data = await res.json();
      setHasReposted(true);
      setRepostCount(Number(data?.reposts_count || 0));
      showHUD();
    } catch {
      Alert.alert("Error", "No se pudo compartir (repost).");
    }
  };

  /* Carrusel control */
  const onCarouselEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / width);
    setTabIndex(idx);
    (async () => {
      try {
        if (idx === 1) { await videoRef.current?.playAsync(); setIsPlaying(true); }
        else { await videoRef.current?.pauseAsync(); setIsPlaying(false); }
      } catch {}
    })();
  };
  const gotoTab = (idx: number) => {
    scrollRef.current?.scrollTo({ x: width * idx, y: 0, animated: true });
    setTabIndex(idx);
    (async () => {
      try {
        if (idx === 1) { await videoRef.current?.playAsync(); setIsPlaying(true); }
        else { await videoRef.current?.pauseAsync(); setIsPlaying(false); }
      } catch {}
    })();
  };

  /* Pausar / Reanudar según foco */
  useFocusEffect(
    useCallback(() => {
      (async () => { try { if (tabIndex === 1) { await videoRef.current?.playAsync(); setIsPlaying(true); } } catch {} })();
      return () => { (async () => { try { await videoRef.current?.pauseAsync(); setIsPlaying(false); } catch {} })(); };
    }, [tabIndex])
  );

  // Posición/zoom del video
  const OVERFILL = height * (SCALE - 1);
  const MAX_SHIFT = OVERFILL / (2 * SCALE);
  const DESIRED = (CENTER_BIAS * OVERFILL) / SCALE;
  const TRANSLATE_Y = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, DESIRED));

  // Offsets
  const BADGE_BOTTOM_PORTRAIT = 16;
  const BADGE_BOTTOM_LANDSCAPE = 10;
  const badgeBottom =
    (insets.bottom || 0) + (isLand ? BADGE_BOTTOM_LANDSCAPE : BADGE_BOTTOM_PORTRAIT);

  const progressBottom =
    Math.max((insets.bottom || 0) + 10, badgeBottom + (controlsH || 60) + 12);

  return (
    <View style={styles.root}>
      <StatusBar hidden={immersive} animated />

      {/* ===== CARRUSEL ===== */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onCarouselEnd}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {/* FEELINGS */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>FEELINGS</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>Contenido próximamente…</Text>
          </View>
        </View>

        {/* PUBLICACIONES */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.videoWrap} onStartShouldSetResponder={() => { setHudVisible(true); return false; }}>
            <Video
              ref={videoRef}
              source={DEFAULT_VIDEO}
              style={[styles.video, { transform: [{ translateY: TRANSLATE_Y }, { scale: SCALE }] }]}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              volume={1.0}
              useNativeControls={false}
              onPlaybackStatusUpdate={onStatus}
              onFullscreenUpdate={() => { try { videoRef.current?.dismissFullscreenPlayer?.(); } catch {} }}
            />
          </View>

          {(hudVisible || !isPlaying) && (
            <TouchableOpacity style={styles.centerBtn} activeOpacity={0.9} onPress={togglePlay}>
              <Text style={[styles.centerIcon, styles.txtShadow]}>{isPlaying ? "❚❚" : "▶︎"}</Text>
            </TouchableOpacity>
          )}

          {IS_DEMO_VIDEO && (
            <View pointerEvents="box-none" style={[styles.demoBadgeWrap, { left: 14, bottom: badgeBottom }]}>
              <View
                style={styles.demoRow}
                onLayout={(e) => setControlsH(e.nativeEvent.layout.height)}
              >
                <TouchableOpacity activeOpacity={0.9} style={styles.demoBadge}>
                  <Image source={DEMO_USER_AVATAR} style={styles.demoBadgeAvatar} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.demoBadgeName, styles.txtShadow]}>{DEMO_USER_NAME}</Text>
                    <Text style={[styles.demoBadgeMeta, styles.txtShadow]}>Video de demostración</Text>
                  </View>
                </TouchableOpacity>

                {/* Reacciones + contadores */}
                <View style={styles.reactionsRow}>
                  {/* ⭐ */}
                  <View style={styles.reactItem}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleToggleStar}
                      onLongPress={() => setStarrersVisible(true)}
                      style={[styles.reactBtn, starred && styles.reactBtnOn]}
                    >
                      <MaterialCommunityIcons
                        name={starred ? "star" : "star-outline"}
                        size={22}
                        color={starred ? "#FFD54F" : "#fff"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setStarrersVisible(true)}>
                      <Text style={styles.reactCount}>{starCount}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 💬 */}
                  <View style={styles.reactItem}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setCommentsVisible(true)}
                      style={styles.reactBtn}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.reactCount}>{commentCount}</Text>
                  </View>

                  {/* 🔖 */}
                  <View style={styles.reactItem}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleToggleSave}
                      onLongPress={() => setSaverVisible(true)}
                      style={[styles.reactBtn, saved && styles.reactBtnOn]}
                    >
                      <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSaverVisible(true)}>
                      <Text style={styles.reactCount}>{saveCount}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 🔁 Repost */}
                  <View style={styles.reactItem}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleRepost}
                      onLongPress={() => setRepostersVisible(true)}
                      style={[styles.reactBtn, hasReposted && styles.reactBtnOn]}
                    >
                      <MaterialCommunityIcons name="repeat-variant" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setRepostersVisible(true)}>
                      <Text style={styles.reactCount}>{repostCount}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Preview: “X te dio una estrella” */}
                {starCount > 0 && lastStarrer ? (
                  <View style={styles.previewRow}>
                    <MaterialCommunityIcons name="star" size={16} color="#FFD54F" />
                    <Image source={lastStarrer.avatar ? { uri: lastStarrer.avatar } : getAvatarSource(null)} style={styles.previewAvatar} />
                    <Text style={styles.previewText}>
                      <Text style={{ fontWeight: "700" }}>{lastStarrer.display_name}</Text> te dio una estrella
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {hudVisible && (
            <View
              style={[styles.progressRoot, { bottom: progressBottom }]}
              pointerEvents="box-none"
            >
              <View
                style={styles.progressHit}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e)=>{ const x=e.nativeEvent.locationX??0; const w=progressWidth.current||1; seekToRatio(x/w); }}
                onResponderMove={(e)=>{ const x=e.nativeEvent.locationX??0; const w=progressWidth.current||1; seekToRatio(x/w); }}
                onResponderRelease={(e)=>{ const x=e.nativeEvent.locationX??0; const w=progressWidth.current||1; seekToRatio(x/w); }}
                onLayout={(e) => (progressWidth.current = e.nativeEvent.layout.width)}
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          duration > 0
                            ? Math.max(2, (position / Math.max(1, duration)) * (progressWidth.current || 0))
                            : 2,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* PODCAST */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>PODCAST</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>Episodios próximamente…</Text>
          </View>
        </View>

        {/* TIENDA */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>TIENDA</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>Productos y colecciones próximamente…</Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== Overlays: top bar & tabs ===== */}
      <View style={[styles.topRow, { top: insets.top + 14, left: 14, right: 14 }]}>
        <TouchableOpacity
          onPress={async () => {
            try { await videoRef.current?.pauseAsync(); setIsPlaying(false); } catch {}
            router.push("/finca");
          }}
          activeOpacity={0.85}
          style={styles.avatarBtn}
        >
          <Image source={getAvatarSource(profile)} style={styles.avatarImg} />
        </TouchableOpacity>

        {!immersive && (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.composeBar, { flexShrink: 1, flexGrow: 1, marginRight: 10 }]}>
              <Text style={[styles.composeText, styles.txtShadow]}>¿Qué estás pensando?</Text>
              <Text style={[styles.plus, styles.txtShadow]}>＋</Text>
            </View>

            <TouchableOpacity activeOpacity={0.9} style={styles.topIconBtn}>
              <Ionicons name="leaf-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.tabsRow, { top: insets.top + (isLand ? 14 : 72) }]}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            activeOpacity={0.9}
            onPress={() => gotoTab(i)}
            style={[styles.tabBtn, i > 0 ? { marginLeft: 18 } : null]}
          >
            <Text style={[styles.tabWord, styles.txtShadow, i === tabIndex && styles.tabWordActive]}>
              {t}
            </Text>
            {i === tabIndex && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== Modales ===== */}
      <CommentsModal
        visible={commentsVisible}
        postId={postId}
        onClose={() => setCommentsVisible(false)}
        onCountChange={(n) => setCommentCount(Number(n || 0))}
      />

      <StarrersModal
        visible={starrersVisible}
        postId={postId}
        onClose={() => setStarrersVisible(false)}
      />

      <SaverModal
        visible={saverVisible}
        postId={postId}
        onClose={() => setSaverVisible(false)}
      />

      <RepostersModal
        visible={repostersVisible}
        postId={postId}
        onClose={() => setRepostersVisible(false)}
      />
    </View>
  );
}

/* ===== estilos ===== */
const LIGHT_GREEN = "#a5d6a7";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  page: { backgroundColor: "#000" },

  videoWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#000" },
  video: { ...StyleSheet.absoluteFillObject },

  centerBtn: {
    position: "absolute", left: "50%", top: "50%",
    width: 64, height: 64, marginLeft: -32, marginTop: -32,
    borderRadius: 32, backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  centerIcon: { color: "#fff", fontSize: 28, fontWeight: "800" },

  topRow: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 10 },
  avatarBtn: {
    width: AV_SIZE, height: AV_SIZE, borderRadius: AV_SIZE / 2,
    overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.98)",
  },
  avatarImg: { width: "100%", height: "100%" },

  composeBar: {
    minHeight: 46, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "transparent",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.98)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  composeText: { color: "#fff", fontSize: 16 },
  plus: { color: "#fff", fontSize: 22, fontWeight: "800" },

  topIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.2, borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center",
  },

  tabsRow: { position: "absolute", alignSelf: "center", flexDirection: "row" },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 4, alignItems: "center" },
  tabWord: { color: "rgba(255,255,255,0.9)", fontSize: 14, letterSpacing: 0.6 },
  tabWordActive: { color: "#fff", fontWeight: "800" },
  tabUnderline: {
    height: 2, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 2, width: "70%", marginTop: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 2, elevation: 2,
  },

  txtShadow: {
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  demoBadgeWrap: { position: "absolute" },
  demoRow: { flexDirection: "row", alignItems: "center" },

  demoBadge: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  demoBadgeAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)" },
  demoBadgeName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  demoBadgeMeta: { color: "rgba(255,255,255,0.9)", fontSize: 12 },

  reactionsRow: { flexDirection: "row", alignItems: "flex-end", marginLeft: 8, gap: 8 },

  reactItem: { alignItems: "center", width: 48 },

  reactBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  reactBtnOn: { backgroundColor: "rgba(165,214,167,0.30)", borderColor: LIGHT_GREEN },

  reactCount: {
    color: "#fff", fontSize: 12, marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2,
  },

  // Preview “X te dio una estrella”
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginLeft: 6,
  },
  previewAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#000", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.6)" },
  previewText: { color: "#fff", fontSize: 12 },

  progressRoot: { position: "absolute", left: 0, right: 0, paddingHorizontal: 14 },
  progressHit: { paddingVertical: 8 },
  progressTrack: { height: 4, width: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: LIGHT_GREEN },

  placeholderWrap: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  placeholderTitle: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  placeholderText: { color: "rgba(255,255,255,0.95)", fontSize: 14 },
});
