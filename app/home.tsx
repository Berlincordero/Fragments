// app/home.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewToken,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { endpoints } from "../lib/api";

/* Modales */
import CommentsModal from "./components/CommentsModal";
import StarrersModal from "./components/StarrersModal";
import SaverModal from "./components/SaverModal";
import RepostersModal from "./components/RepostersModal";

/* ===== Ajustes visuales ===== */
const AV_SIZE = 52;
const SCALE = 1.02;
const CENTER_BIAS = -0.18;

/* ===== Caption: 4 líneas + scroll interno ===== */
const CAPTION_FONT_SIZE = 15;
const CAPTION_LINE_HEIGHT = 20;
const CAPTION_MAX_LINES = 4;
const CAPTION_MAX_HEIGHT = CAPTION_LINE_HEIGHT * CAPTION_MAX_LINES;

/* === Lifts (más grande = más arriba) === */
const CAPTION_LIFT = 74; // solo el caption (vertical)
const LIFT_BADGE = 0; // badge + íconos
const LIFT_PROGRESS = 0; // barra de progreso

/* ===== Assets ===== */
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");

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
type MiniUser = { username: string; display_name: string; avatar: string | null };
type FeedPost = {
  id: number;
  video: string | null;
  image?: string | null;
  content?: string | null;
  author?: { username: string; display_name: string; avatar: string | null } | null;
  stars_count?: number;
  has_starred?: boolean;
  comments_count?: number;
  reposts_count?: number;
  has_reposted?: boolean;
  saves_count?: number;
  has_saved?: boolean;
};

/* ===== Helpers ===== */
const getAvatarSource = (
  p?:
    | Pick<Profile, "avatar" | "gender">
    | { avatar?: string | null; gender?: string | null }
    | null
) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export const options = { headerShown: false };

/** Texto con contorno (stroke) para legibilidad */
function StrokeText({
  children,
  style,
  color = "#fff",
  strokeColor = "#000",
  strokeWidth = 2,
}: {
  children: React.ReactNode;
  style?: any;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
}) {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  return (
    <View style={{ position: "relative" }}>
      {dirs.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[
            style,
            {
              position: "absolute",
              left: dx * strokeWidth,
              top: dy * strokeWidth,
              color: strokeColor,
            },
          ]}
        >
          {children}
        </Text>
      ))}
      <Text style={[style, { color }]}>{children}</Text>
    </View>
  );
}

/** Contenedor del caption (reporta altura efectiva renderizada) */
function CaptionScroller({
  children,
  onHeight,
}: {
  children: React.ReactNode;
  onHeight?: (h: number) => void;
}) {
  const [contentH, setContentH] = React.useState(0);
  const renderedH = Math.min(contentH, CAPTION_MAX_HEIGHT);
  const canScroll = contentH > CAPTION_MAX_HEIGHT;

  useEffect(() => {
    onHeight?.(renderedH || 0);
  }, [renderedH]); // eslint-disable-line

  return (
    <View style={[styles.captionBubble, { maxHeight: CAPTION_MAX_HEIGHT }]}>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: CAPTION_MAX_HEIGHT }}
        contentContainerStyle={{ paddingVertical: 2 }}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentH(h || 0)}
        scrollEnabled={canScroll}
        onStartShouldSetResponderCapture={() => canScroll}
        onMoveShouldSetResponderCapture={() => canScroll}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ newPostId?: string; newVideo?: string }>();
  const { width, height } = useWindowDimensions();
  const isLand = width > height; // horizontal (fullscreen)
  const immersive = isLand; // ocultar barra en horizontal

  // Tabs
  const [tabIndex, setTabIndex] = useState(1);
  const tabsRef = useRef<ScrollView>(null);

  // Perfil
  const [profile, setProfile] = useState<Profile | null>(null);

  // Feed
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activePost: FeedPost | null = feed.length
    ? feed[Math.max(0, Math.min(activeIndex, feed.length - 1))]
    : null;
  const postId = activePost?.id ?? null;

  // Reacciones
  const [starred, setStarred] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);

  // Player
  const videoRefs = useRef<Map<number, Video>>(new Map());
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressWidth = useRef(1);
  const [controlsH, setControlsH] = useState(0);

  // (se mantiene, pero ya no controla la visibilidad del botón)
  const [isTouchingVideo, setIsTouchingVideo] = useState(false);

  // Preview starrer
  const [lastStarrer, setLastStarrer] = useState<MiniUser | null>(null);

  // Altura efectiva del caption (vertical)
  const [captionH, setCaptionH] = useState(0);

  // ======= Ajuste de video (AUTO / CONTAIN / COVER) =======
  const [fitMode, setFitMode] = useState<"auto" | "contain" | "cover">("auto");
  const [vidSize, setVidSize] = useState<{ w: number; h: number } | null>(null);

  // Modales
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [starrersVisible, setStarrersVisible] = useState(false);
  const [saverVisible, setSaverVisible] = useState(false);
  const [repostersVisible, setRepostersVisible] = useState(false);

  // HUD helpers
  const showHUD = (ms = 1200) => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), ms);
  };
  useEffect(() => {
    return () => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
    };
  }, []);

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
        const res = await fetch(endpoints.finca(), {
          headers: { Authorization: `Token ${tk}` },
        });
        const data = (await res.json()) as Profile;
        setProfile(data);
      } catch {}
    })();
  }, []);

  // Feed
  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        const res = await fetch(endpoints.feedAll(), {
          headers: { Authorization: `Token ${tk}` },
        });
        const json = await res.json();
        const items: FeedPost[] = Array.isArray(json?.results) ? json.results : json || [];
        setFeed(items && items.length ? items : []);
      } catch {}
    })();
  }, []);

  // Si venimos de /compose
  useEffect(() => {
    const id = params?.newPostId ? Number(params.newPostId) : null;
    const newV =
      typeof params?.newVideo !== "undefined" ? String(params.newVideo || "") : null;
    if (id || newV) {
      const pseudo: FeedPost = {
        id: id ?? -1,
        video: newV || null,
        content: "",
        author: profile
          ? {
              username: profile.username,
              display_name: profile.display_name || profile.username,
              avatar: profile.avatar,
            }
          : null,
        stars_count: 0,
        comments_count: 0,
        reposts_count: 0,
        saves_count: 0,
        has_starred: false,
        has_reposted: false,
        has_saved: false,
      };
      setFeed((prev) => [pseudo, ...prev]);
      setActiveIndex(0);
      setTimeout(() => playActive(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.newPostId, params?.newVideo]);

  // Sincroniza contadores/flags del activo
  useEffect(() => {
    if (!activePost) {
      setStarred(false);
      setSaved(false);
      setHasReposted(false);
      setStarCount(0);
      setCommentCount(0);
      setRepostCount(0);
      setSaveCount(0);
      return;
    }
    setStarred(!!activePost.has_starred);
    setSaved(!!activePost.has_saved);
    setHasReposted(!!activePost.has_reposted);
    setStarCount(Number(activePost.stars_count || 0));
    setCommentCount(Number(activePost.comments_count || 0));
    setRepostCount(Number(activePost.reposts_count || 0));
    setSaveCount(Number(activePost.saves_count || 0));
    if (postId) fetchStarPreview(postId).catch(() => {});
  }, [activeIndex, activePost?.id]); // eslint-disable-line

  // Focus play/pause
  useFocusEffect(
    useCallback(() => {
      if (tabIndex === 1) playActive();
      return () => pauseActive();
    }, [tabIndex, activeIndex])
  );

  const getActiveRef = () => {
    const id = activePost?.id ?? -9999;
    return videoRefs.current.get(id);
  };

  const onStatus = (s: AVPlaybackStatus) => {
    if (!("isLoaded" in s) || !s.isLoaded) return;
    const ss = s as AVPlaybackStatusSuccess;
    setDuration(ss.durationMillis ?? 0);
    setPosition(ss.positionMillis ?? 0);
    setIsPlaying(!!ss.isPlaying);
    // tamaño natural del video para relación de aspecto
    const ns: any = (ss as any).naturalSize;
    if (ns && typeof ns.width === "number" && typeof ns.height === "number" && ns.width > 0 && ns.height > 0) {
      setVidSize({ w: ns.width, h: ns.height });
    }
  };

  const playActive = async () => {
    try {
      await getActiveRef()?.playAsync();
      setIsPlaying(true);
    } catch {}
  };

  const pauseActive = async () => {
    try {
      await getActiveRef()?.pauseAsync();
      setIsPlaying(false);
    } catch {}
  };

  const togglePlay = async () => {
    try {
      isPlaying ? await pauseActive() : await playActive();
      showHUD();
    } catch {}
  };

  const seekToRatio = async (r: number) => {
    if (!duration) return;
    const clamped = Math.max(0, Math.min(1, r));
    const target = Math.floor(duration * clamped);
    try {
      await getActiveRef()?.setPositionAsync(target);
      setPosition(target);
    } catch {}
  };

  /* ========= Auth helper (token) ========= */
  const ensureToken = async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  };

  /* ========= Update helper para reflejar cambios en el feed ========= */
  const updateActiveInFeed = (patch: Partial<FeedPost>) => {
    setFeed((prev) => {
      const i = activeIndex;
      if (!prev[i]) return prev;
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  /* ========= Handlers de reacciones ========= */
  // ⭐ Toggle
  const handleToggleStar = async () => {
    if (postId == null) return;
    const next = !starred;
    setStarred(next);
    setStarCount((c) => Math.max(0, c + (next ? 1 : -1)));
    updateActiveInFeed({
      has_starred: next,
      stars_count: Math.max(0, (activePost?.stars_count ?? 0) + (next ? 1 : -1)),
    });
    try {
      const tk = await ensureToken();
      await fetch(endpoints.fincaPostStar(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
    } catch {
      const revert = !next;
      setStarred(revert);
      setStarCount((c) => Math.max(0, c + (revert ? 1 : -1)));
      updateActiveInFeed({
        has_starred: revert,
        stars_count: Math.max(0, (activePost?.stars_count ?? 0) + (revert ? 1 : -1)),
      });
    }
  };

  // 🔖 Toggle
  const handleToggleSave = async () => {
    if (postId == null) return;
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => Math.max(0, c + (next ? 1 : -1)));
    updateActiveInFeed({
      has_saved: next,
      saves_count: Math.max(0, (activePost?.saves_count ?? 0) + (next ? 1 : -1)),
    });
    try {
      const tk = await ensureToken();
      await fetch(endpoints.fincaPostSave(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
    } catch {
      const revert = !next;
      setSaved(revert);
      setSaveCount((c) => Math.max(0, c + (revert ? 1 : -1)));
      updateActiveInFeed({
        has_saved: revert,
        saves_count: Math.max(0, (activePost?.saves_count ?? 0) + (revert ? 1 : -1)),
      });
    }
  };

  // 🔁 Repost (idempotente)
  const handleRepost = async () => {
    if (postId == null) return;
    if (hasReposted) {
      setRepostersVisible(true);
      return;
    }
    setHasReposted(true);
    setRepostCount((c) => c + 1);
    updateActiveInFeed({
      has_reposted: true,
      reposts_count: (activePost?.reposts_count ?? 0) + 1,
    });
    try {
      const tk = await ensureToken();
      await fetch(endpoints.fincaPostRepost(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
    } catch {
      setHasReposted(false);
      setRepostCount((c) => Math.max(0, c - 1));
      updateActiveInFeed({
        has_reposted: false,
        reposts_count: Math.max(0, (activePost?.reposts_count ?? 0) - 1),
      });
    }
  };

  /* ========= Preview de starrers ========= */
  const fetchStarPreview = async (pid: number) => {
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostStarrers(pid), {
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      const u = Array.isArray(data?.results)
        ? (data.results[0] as MiniUser | undefined)
        : undefined;
      setLastStarrer(u || null);
    } catch {}
  };

  // Tabs carrusel
  useEffect(() => {
    const id = setTimeout(() => {
      tabsRef.current?.scrollTo({ x: width * 1, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [width]);

  const onTabsEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x || 0;
    const raw = Math.round(x / Math.max(1, width));
    const idx = Math.max(0, Math.min(TABS.length - 1, raw));
    setTabIndex(idx);
    if (idx === 1) playActive();
    else pauseActive();
  };

  const gotoTab = (idx: number) => {
    tabsRef.current?.scrollTo({ x: width * idx, y: 0, animated: true });
    setTabIndex(idx);
    if (idx === 1) playActive();
    else pauseActive();
  };

  // PUBLICACIONES
  const OVERFILL = height * (SCALE - 1);
  const MAX_SHIFT = OVERFILL / (2 * SCALE);
  const DESIRED = (CENTER_BIAS * OVERFILL) / SCALE;
  const TRANSLATE_Y = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, DESIRED));

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 90 }), []);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const v = viewableItems.find((vt) => vt.isViewable);
      if (v && typeof v.index === "number") setActiveIndex(v.index);
    }
  ).current;

  // Reserva de ancho íconos / clamp badge
  const ICONS_COUNT = 4;
  const ICON_SLOT = 48;
  const ICON_GAP = 8;
  const ICONS_BLOCK_W = ICON_SLOT * ICONS_COUNT + ICON_GAP * (ICONS_COUNT - 1); // 216
  const HZ_SAFE = 28;
  const BADGE_MAX_W = Math.max(140, width - ICONS_BLOCK_W - HZ_SAFE);

  const renderPostItem = ({ item, index }: { item: FeedPost; index: number }) => {
    const id = item.id;
    const uri = item.video || undefined;
    const playing = index === activeIndex && tabIndex === 1;

    // Relación de aspecto (para horizontal)
    const deviceAR = width / height;
    const videoAR = vidSize ? vidSize.w / vidSize.h : null;

    // Estilo y modo
    const videoStyle = [
      styles.video,
      !isLand ? { transform: [{ translateY: TRANSLATE_Y }, { scale: SCALE }] } : null,
    ];

    let computedMode: ResizeMode = ResizeMode.CONTAIN;
    if (isLand) {
      if (fitMode === "contain") computedMode = ResizeMode.CONTAIN;
      else if (fitMode === "cover") computedMode = ResizeMode.COVER;
      else {
        // AUTO: si la barra lateral sería >15%, usar COVER (llenar)
        if (videoAR) {
          const pillarboxRatio = Math.max(0, 1 - videoAR / deviceAR); // 0..1
          computedMode = pillarboxRatio > 0.15 ? ResizeMode.COVER : ResizeMode.CONTAIN;
        } else {
          computedMode = ResizeMode.CONTAIN;
        }
      }
    } else {
      computedMode = ResizeMode.COVER;
    }

    return (
      <View style={[styles.page, { width, height }]}>
        <View
          style={styles.videoWrap}
          // ⬇️ Ajuste: el contenedor solo captura el primer toque para mostrar HUD,
          // y cuando el HUD está visible, deja pasar toques al botón central
          onStartShouldSetResponder={() => !hudVisible}
          onResponderGrant={() => {
            showHUD(1800);
            setIsTouchingVideo(true);
          }}
          onResponderMove={() => {}}
          onResponderRelease={() => setIsTouchingVideo(false)}
          onResponderTerminate={() => setIsTouchingVideo(false)}
        >
          {uri ? (
            <Video
              ref={(ref) => {
                if (ref) videoRefs.current.set(id, ref);
                else videoRefs.current.delete(id);
              }}
              source={{ uri }}
              style={videoStyle}
              resizeMode={computedMode}
              shouldPlay={playing}
              isLooping
              volume={1.0}
              useNativeControls={false}
              onPlaybackStatusUpdate={index === activeIndex ? onStatus : undefined}
              onFullscreenUpdate={() => {
                try {
                  videoRefs.current.get(id)?.dismissFullscreenPlayer?.();
                } catch {}
              }}
            />
          ) : (
            <View style={[styles.placeholderWrap, { backgroundColor: "#000" }]}>
              <Text style={[styles.placeholderText, styles.txtShadow]}>
                Publicación sin video
              </Text>
            </View>
          )}
        </View>

        {/* ⬇️ Ajuste: botón central visible con HUD (temporizado), no requiere mantener presionado */}
        {hudVisible && index === activeIndex && uri && (
          <TouchableOpacity style={styles.centerBtn} activeOpacity={0.9} onPress={togglePlay}>
            <Text style={[styles.centerIcon, styles.txtShadow]}>
              {isPlaying ? "❚❚" : "▶︎"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Posiciones con lifts
  const badgeBottom = (insets.bottom || 0) + (isLand ? 10 : 16) + LIFT_BADGE;
  const progressBottom =
    Math.max((insets.bottom || 0) + 10, badgeBottom + (controlsH || 60) + 12) +
    LIFT_PROGRESS;

  // Posición del caption flotante (solo vertical)
  const effectiveH = Math.min(Math.max(0, captionH), CAPTION_MAX_HEIGHT);
  const captionBottom = progressBottom + 6 + (CAPTION_MAX_HEIGHT - effectiveH) + CAPTION_LIFT;

  return (
    <View style={styles.root}>
      <StatusBar hidden={immersive} animated />

      {/* ===== CARRUSEL TABS ===== */}
      <ScrollView
        ref={tabsRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onTabsEnd}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {/* FEELINGS */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>FEELINGS</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>
              Contenido próximamente…
            </Text>
          </View>
        </View>

        {/* PUBLICACIONES */}
        <View style={[styles.page, { width, height }]}>
          {feed.length === 0 ? (
            <View style={[styles.placeholderWrap, { paddingHorizontal: 24 }]}>
              <Text style={[styles.placeholderTitle, styles.txtShadow]}>PUBLICACIONES</Text>
              <Text
                style={[
                  styles.placeholderText,
                  styles.txtShadow,
                  { textAlign: "center", marginTop: 8 },
                ]}
              >
                Todavía no hay contenido, por favor.
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={feed}
                keyExtractor={(it) => String((it as FeedPost).id)}
                renderItem={renderPostItem}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                snapToAlignment="start"
                getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
              />

              {/* Badge + reacciones del activo */}
              <View
                pointerEvents="box-none"
                style={[styles.demoBadgeWrap, { left: 14, bottom: badgeBottom }]}
              >
                <View
                  style={styles.demoRow}
                  onLayout={(e) => setControlsH(e.nativeEvent.layout.height)}
                >
                  {/* Badge autor */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.demoBadge, { maxWidth: BADGE_MAX_W, marginRight: 12 }]}
                  >
                    <Image
                      source={getAvatarSource(activePost?.author || profile)}
                      style={styles.demoBadgeAvatar}
                    />
                    <View style={{ marginLeft: 10, flexShrink: 1 }}>
                      <Text
                        style={[styles.demoBadgeName, styles.txtShadow]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {activePost?.author?.display_name || "Bribri"}
                      </Text>
                      <Text
                        style={[styles.demoBadgeMeta, styles.txtShadow]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        Publicación
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Íconos */}
                  <View style={[styles.reactionsRow, { flexShrink: 0, minWidth: 216 }]}>
                    {/* ⭐ */}
                    <View style={[styles.reactItem, { marginLeft: 0 }]}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleToggleStar}
                        onLongPress={() => {
                          if (postId != null) setStarrersVisible(true);
                        }}
                        style={[styles.reactBtn, starred && styles.reactBtnOn]}
                      >
                        <MaterialCommunityIcons
                          name={starred ? "star" : "star-outline"}
                          size={22}
                          color="#fff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (postId != null) setStarrersVisible(true);
                        }}
                      >
                        <Text style={styles.reactCount}>{starCount}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 💬 */}
                    <View style={[styles.reactItem, { marginLeft: 8 }]}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          if (postId != null) setCommentsVisible(true);
                        }}
                        style={styles.reactBtn}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.reactCount}>{commentCount}</Text>
                    </View>

                    {/* 🔖 */}
                    <View style={[styles.reactItem, { marginLeft: 8 }]}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleToggleSave}
                        onLongPress={() => {
                          if (postId != null) setSaverVisible(true);
                        }}
                        style={[styles.reactBtn, saved && styles.reactBtnOn]}
                      >
                        <Ionicons
                          name={saved ? "bookmark" : "bookmark-outline"}
                          size={22}
                          color="#fff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (postId != null) setSaverVisible(true);
                        }}
                      >
                        <Text style={styles.reactCount}>{saveCount}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 🔁 */}
                    <View style={[styles.reactItem, { marginLeft: 8 }]}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleRepost}
                        onLongPress={() => {
                          if (postId != null) setRepostersVisible(true);
                        }}
                        style={[styles.reactBtn, hasReposted && styles.reactBtnOn]}
                      >
                        <MaterialCommunityIcons name="repeat-variant" size={22} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (postId != null) setRepostersVisible(true);
                        }}
                      >
                        <Text style={styles.reactCount}>{repostCount}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Botón de modo de ajuste (solo horizontal) */}
                  {isLand && (
                    <TouchableOpacity
                      onPress={() =>
                        setFitMode((m) => (m === "auto" ? "cover" : m === "cover" ? "contain" : "auto"))
                      }
                      activeOpacity={0.85}
                      style={[styles.reactBtn, { marginLeft: 8 }]}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                        {fitMode === "auto" ? "AUTO" : fitMode === "cover" ? "LLENAR" : "AJUSTAR"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Caption en horizontal: a la derecha de los iconos */}
                  {isLand && !!activePost?.content?.trim() && (
                    <View style={[styles.landCaption, { maxWidth: Math.min(360, width * 0.36) }]}>
                      <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={[styles.landCaptionText, styles.txtShadow]}
                      >
                        {activePost.content!.trim()}
                      </Text>
                    </View>
                  )}

                  {/* Preview “X te dio una estrella” */}
                  {starCount > 0 && lastStarrer ? (
                    <View style={styles.previewRow}>
                      <MaterialCommunityIcons name="star" size={16} color="#FFD54F" />
                      <Image
                        source={lastStarrer.avatar ? { uri: lastStarrer.avatar } : getAvatarSource(null)}
                        style={styles.previewAvatar}
                      />
                      <Text style={styles.previewText}>
                        <Text style={{ fontWeight: "700" }}>{lastStarrer.display_name}</Text> te dio una
                        estrella
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Barra de progreso (ligada al HUD) */}
              {hudVisible && (
                <View style={[styles.progressRoot, { bottom: progressBottom }]} pointerEvents="box-none">
                  <View
                    style={styles.progressHit}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                      const x = e.nativeEvent.locationX ?? 0;
                      const w = progressWidth.current || 1;
                      seekToRatio(x / w);
                    }}
                    onResponderMove={(e) => {
                      const x = e.nativeEvent.locationX ?? 0;
                      const w = progressWidth.current || 1;
                      seekToRatio(x / w);
                    }}
                    onResponderRelease={(e) => {
                      const x = e.nativeEvent.locationX ?? 0;
                      const w = progressWidth.current || 1;
                      seekToRatio(x / w);
                    }}
                    onLayout={(e) => (progressWidth.current = e.nativeEvent.layout.width)}
                  >
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width:
                              duration > 0
                                ? Math.max(
                                    2,
                                    (position / Math.max(1, duration)) * (progressWidth.current || 0)
                                  )
                                : 2,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* PODCAST */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>PODCAST</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>
              Episodios próximamente…
            </Text>
          </View>
        </View>

        {/* TIENDA */}
        <View style={[styles.page, { width, height }]}>
          <View style={styles.placeholderWrap}>
            <Text style={[styles.placeholderTitle, styles.txtShadow]}>TIENDA</Text>
            <Text style={[styles.placeholderText, styles.txtShadow]}>
              Productos próximamente…
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== Overlays: top bar & tabs ===== */}
      <View style={[styles.topRow, { top: insets.top + 14, left: 14, right: 14 }]}>
        <TouchableOpacity
          onPress={async () => {
            try {
              await pauseActive();
            } catch {}
            router.push("/finca");
          }}
          activeOpacity={0.85}
          style={styles.avatarBtn}
        >
          <Image source={getAvatarSource(profile)} style={styles.avatarImg} />
        </TouchableOpacity>

        {!immersive && (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.push("/compose")}
              activeOpacity={0.9}
              style={[styles.composeBar, { flexShrink: 1, flexGrow: 1, marginRight: 10 }]}
            >
              <Text style={[styles.composeText, styles.txtShadow]}>¿Qué estás pensando?</Text>
              <Text style={[styles.plus, styles.txtShadow]}>＋</Text>
            </TouchableOpacity>
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

      {/* ===== Caption flotante SOLO en vertical ===== */}
      {tabIndex === 1 && !!activePost?.content?.trim() && !isLand && (
        <View pointerEvents="box-none" style={[styles.captionWrap, { left: 16, right: 16, bottom: captionBottom }]}>
          <CaptionScroller onHeight={setCaptionH}>
            <StrokeText style={styles.captionText} color="#fff" strokeColor="#000" strokeWidth={2}>
              {activePost?.content?.trim()}
            </StrokeText>
          </CaptionScroller>
        </View>
      )}

      {/* ===== Modales ===== */}
      {postId != null && (
        <CommentsModal
          visible={commentsVisible}
          postId={postId}
          onClose={() => setCommentsVisible(false)}
          onCountChange={(n) => setCommentCount(Number(n || 0))}
        />
      )}
      {postId != null && (
        <StarrersModal visible={starrersVisible} postId={postId} onClose={() => setStarrersVisible(false)} />
      )}
      {postId != null && (
        <SaverModal visible={saverVisible} postId={postId} onClose={() => setSaverVisible(false)} />
      )}
      {postId != null && (
        <RepostersModal visible={repostersVisible} postId={postId} onClose={() => setRepostersVisible(false)} />
      )}
    </View>
  );
}

/* ===== estilos ===== */
const LIGHT_GREEN = "#a5d6a7";
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { backgroundColor: "#000" },

  videoWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { ...StyleSheet.absoluteFillObject },

  centerBtn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerIcon: { color: "#fff", fontSize: 28, fontWeight: "800" },

  topRow: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 10 },
  avatarBtn: {
    width: AV_SIZE,
    height: AV_SIZE,
    borderRadius: AV_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.98)",
  },
  avatarImg: { width: "100%", height: "100%" },

  composeBar: {
    minHeight: 46,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  tabsRow: { position: "absolute", alignSelf: "center", flexDirection: "row" },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 4, alignItems: "center" },
  tabWord: { color: "rgba(255,255,255,0.9)", fontSize: 14, letterSpacing: 0.6 },
  tabWordActive: { color: "#fff", fontWeight: "800" },
  tabUnderline: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 2,
    width: "70%",
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },

  // Caption flotante (vertical)
  captionWrap: { position: "absolute" },
  captionBubble: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  captionText: {
    fontSize: CAPTION_FONT_SIZE,
    lineHeight: CAPTION_LINE_HEIGHT,
    fontWeight: "700",
  },

  // Caption en horizontal al lado de los íconos
  landCaption: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    flexShrink: 1,
  },
  landCaptionText: { color: "#fff", fontSize: 14, lineHeight: 18, fontWeight: "700" },

  txtShadow: {
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  demoBadgeWrap: { position: "absolute" },
  demoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  demoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  demoBadgeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.95)",
  },
  demoBadgeName: { color: "#fff", fontWeight: "800", fontSize: 16, lineHeight: 20 },
  demoBadgeMeta: { color: "rgba(255,255,255,0.9)", fontSize: 12 },

  reactionsRow: { flexDirection: "row", alignItems: "flex-end" },
  reactItem: { alignItems: "center", width: 48 },
  reactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  reactBtnOn: { backgroundColor: "rgba(165,214,167,0.30)", borderColor: LIGHT_GREEN },
  reactCount: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },

  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginLeft: 6 },
  previewAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#000",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
  },
  previewText: { color: "#fff", fontSize: 12 },

  progressRoot: { position: "absolute", left: 0, right: 0, paddingHorizontal: 14 },
  progressHit: { paddingVertical: 8 },
  progressTrack: {
    height: 4,
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: LIGHT_GREEN },

  placeholderWrap: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  placeholderTitle: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  placeholderText: { color: "rgba(255,255,255,0.95)", fontSize: 14 },
});
