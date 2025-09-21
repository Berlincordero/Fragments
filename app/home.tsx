// app/home.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
  Share,
  Pressable,
  AppState,
  ImageBackground,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { endpoints } from "../lib/api";

/* Modales */
import CommentsModal from "./components/CommentsModal";
import StarrersModal from "./components/StarrersModal";
import SaverModal from "./components/SaverModal";
import RepostersModal from "./components/RepostersModal";
import PostActionsModal from "./components/PostActionsModal";

/* ===== Ajustes visuales ===== */
const AV_SIZE = 52;

/* ===== Caption ===== */
const CAPTION_FONT_SIZE = 15;
const CAPTION_LINE_HEIGHT = 20;
const CAPTION_MAX_LINES = 4;
const CAPTION_MAX_HEIGHT = CAPTION_LINE_HEIGHT * CAPTION_MAX_LINES;

/* ===== Tabs ===== */
const TABS = ["FEELINGS", "PUBLICACIONES", "PODCASTS", "TIENDA"] as const;

/* ===== Tipos ===== */
type Gender = "M" | "F" | "O";
type Profile = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender: Gender | string | null;
};
export type FeedPost = {
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

/* ===== Avatares ===== */
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const coverDefault = require("../assets/images/portada.jpg");

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

/** Texto con contorno */
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

/** Contenedor de caption con scroll interno */
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

/* ========================================================================== */
/*                              PostCard (memo)                               */
/* ========================================================================== */
type PostCardProps = {
  item: FeedPost;
  index: number;
  width: number;
  height: number;
  isLand: boolean;
  tabIndex: number;
  portraitFit: "fill" | "full" | "tall";
  fitMode: "auto" | "contain" | "cover";
  hudVisible: boolean;
  active: boolean;
  onStatus: (s: AVPlaybackStatus, boundPostId?: number) => void;
  videoRefMap: React.MutableRefObject<Map<number, Video>>;
  onTapToggle: () => void;
  showHUD: (ms?: number) => void;
};

const PostCard = memo(function PostCard({
  item,
  width,
  height,
  isLand,
  tabIndex,
  portraitFit,
  fitMode,
  hudVisible,
  active,
  onStatus,
  videoRefMap,
  onTapToggle,
  showHUD,
}: PostCardProps) {
  const id = item.id;
  const videoUri = item.video || undefined;
  const imageUri = !videoUri && item.image ? item.image : undefined;

  // Cálculo de modo (usado para video e imagen)
  let computedMode: ResizeMode = ResizeMode.CONTAIN;
  if (isLand) {
    if (fitMode === "contain") computedMode = ResizeMode.CONTAIN;
    else if (fitMode === "cover") computedMode = ResizeMode.COVER;
    else computedMode = ResizeMode.CONTAIN; // AUTO horizontal
  } else {
    computedMode =
      portraitFit === "fill"
        ? ResizeMode.COVER
        : portraitFit === "full"
        ? ResizeMode.CONTAIN
        : ResizeMode.COVER; // "tall" usa cover + des-zoom suave
  }
  const imgResizeMode = computedMode === ResizeMode.COVER ? ("cover" as const) : ("contain" as const);
  const DESZOOM_TALL = 0.92;

  return (
    <View style={[styles.page, { width, height }]}>
      <View style={styles.videoWrap}>
        {videoUri ? (
          <>
            <Video
              ref={(ref) => {
                if (ref) videoRefMap.current.set(id, ref);
                else videoRefMap.current.delete(id);
              }}
              source={{ uri: videoUri }}
              style={[
                styles.video,
                // “ALTO” aplica des-zoom solo vertical
                !isLand && portraitFit === "tall" ? { transform: [{ scale: DESZOOM_TALL }] } : null,
              ]}
              resizeMode={computedMode}
              shouldPlay={active && tabIndex === 1}
              isLooping
              volume={1.0}
              useNativeControls={false}
              onPlaybackStatusUpdate={active ? (s) => onStatus(s, id) : undefined}
              onFullscreenUpdate={() => {
                try {
                  videoRefMap.current.get(id)?.dismissFullscreenPlayer?.();
                } catch {}
              }}
            />

            {/* Capa que captura TAP: HUD + toggle play/pause */}
            <Pressable
              style={styles.tapHit}
              onPress={() => {
                showHUD(1200);
                onTapToggle();
              }}
              android_disableSound
            />
          </>
        ) : imageUri ? (
          // ==== IMAGEN side-to-side (ancho completo) con fondo difuminado ====
          <View style={{ flex: 1 }}>
            {/* Fondo difuminado para “rellenar” bordes */}
            <ImageBackground
              source={{ uri: imageUri }}
              blurRadius={20}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.45)"]}
                style={StyleSheet.absoluteFill}
              />
            </ImageBackground>

            {/* Imagen principal: ocupa todo el ancho y respeta el control LLENAR/4:16/ALTO */}
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.video,
                !isLand && portraitFit === "tall" ? { transform: [{ scale: DESZOOM_TALL }] } : null,
              ]}
              resizeMode={imgResizeMode}
            />
          </View>
        ) : (
          <View style={[styles.placeholderWrap, { backgroundColor: "#000" }]}>
            <Text style={[styles.placeholderText, styles.txtShadow]}>Publicación sin media</Text>
          </View>
        )}
      </View>

      {/* HUD: botón central (solo si hay video) */}
      {hudVisible && active && videoUri && (
        <View pointerEvents="none" style={styles.centerBtn}>
          <Text style={[styles.centerIcon, styles.txtShadow]}>●</Text>
        </View>
      )}
    </View>
  );
});

/* ========================================================================== */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ newPostId?: string; newVideo?: string }>();
  const { width, height } = useWindowDimensions();
  const isLand = width > height;
  const immersive = isLand;

  // Tabs
  const [tabIndex, setTabIndex] = useState(1);
  const tabsRef = useRef<ScrollView>(null);
  const flatRef = useRef<FlatList<FeedPost>>(null);

  // Bloqueo del scroll horizontal de tabs mientras se arrastra la lista vertical
  const [tabsScrollEnabled, setTabsScrollEnabled] = useState(true);

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

  // HUD timer
  type Timeout = ReturnType<typeof setTimeout>;
  const hudTimer = useRef<Timeout | null>(null);

  const progressWidth = useRef(1);
  const [controlsH, setControlsH] = useState(0);
  const [captionH, setCaptionH] = useState(0);

  // Landscape fit
  const [fitMode, setFitMode] = useState<"auto" | "contain" | "cover">("auto");
  // Portrait fit (fill = cover, full = contain, tall = alto 4:16)
  const [portraitFit, setPortraitFit] = useState<"fill" | "full" | "tall">("fill");

  // Tamaños por publicación
  const [vidSizes, setVidSizes] = useState<Record<number, { w: number; h: number }>>({});

  // Modales
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [starrersVisible, setStarrersVisible] = useState(false);
  const [saverVisible, setSaverVisible] = useState(false);
  const [repostersVisible, setRepostersVisible] = useState(false);
  const [postOptionsVisible, setPostOptionsVisible] = useState(false);

  // Reset portrait fit al volver a vertical
  useEffect(() => {
    if (!isLand) setPortraitFit("fill");
  }, [isLand]);

  // HUD helpers
  const showHUD = (ms = 1200) => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), ms);
  };
  useEffect(() => {
    return () => {
      if (hudTimer.current != null) {
        clearTimeout(hudTimer.current);
        hudTimer.current = null;
      }
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
    const newV = typeof params?.newVideo !== "undefined" ? String(params.newVideo || "") : null;
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
  }, [activeIndex, activePost?.id]); // eslint-disable-line

  // ======= Helpers de reproducción segura =======
  const getActiveId = () => activePost?.id ?? -9999;

  const pauseAllExcept = async (id: number) => {
    const entries = Array.from(videoRefs.current.entries());
    await Promise.all(
      entries.map(async ([k, v]) => {
        try {
          if (k === id) return;
          await v.pauseAsync();
        } catch {}
      })
    );
  };

  /** Solo el activo reproduce (en pestaña PUBLICACIONES) */
  const ensureOnlyActivePlaying = async () => {
    const id = getActiveId();
    await pauseAllExcept(id);
    if (tabIndex === 1) {
      try {
        await videoRefs.current.get(id)?.playAsync();
        setIsPlaying(true);
      } catch {}
    }
  };

  // Focus de pantalla: normaliza al entrar y pausa al salir
  useFocusEffect(
    useCallback(() => {
      if (tabIndex === 1) ensureOnlyActivePlaying();
      else {
        const arr = Array.from(videoRefs.current.values());
        arr.forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
      }
      return () => {
        const arr = Array.from(videoRefs.current.values());
        arr.forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
      };
    }, [tabIndex, activeIndex])
  );

  // AppState
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        const arr = Array.from(videoRefs.current.values());
        arr.forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
      } else {
        ensureOnlyActivePlaying();
      }
    });
    return () => sub.remove();
  }, [activeIndex, tabIndex]);

  const getActiveRef = () => {
    const id = activePost?.id ?? -9999;
    return videoRefs.current.get(id);
  };

  // Guarda tamaño natural (si lo necesitas en el futuro)
  const onStatus = (s: AVPlaybackStatus, boundPostId?: number) => {
    if (!("isLoaded" in s) || !s.isLoaded) return;
    const ss = s as AVPlaybackStatusSuccess;
    setDuration(ss.durationMillis ?? 0);
    setPosition(ss.positionMillis ?? 0);
    setIsPlaying(!!ss.isPlaying);

    const ns: any = (ss as any).naturalSize;
    if (
      boundPostId != null &&
      ns &&
      typeof ns.width === "number" &&
      typeof ns.height === "number" &&
      ns.width > 0 &&
      ns.height > 0
    ) {
      setVidSizes((prev) =>
        prev[boundPostId] &&
        prev[boundPostId].w === ns.width &&
        prev[boundPostId].h === ns.height
          ? prev
          : { ...prev, [boundPostId]: { w: ns.width, h: ns.height } }
      );
    }
  };

  const playActive = async () => {
    try {
      const id = getActiveId();
      await pauseAllExcept(id);
      await videoRefs.current.get(id)?.playAsync();
      setIsPlaying(true);
    } catch {}
  };

  const pauseActive = async () => {
    try {
      const id = getActiveId();
      await videoRefs.current.get(id)?.pauseAsync();
      setIsPlaying(false);
    } catch {}
  };

  // Tap lock (evita dobles toggles)
  const tapLocked = useRef(false);
  const togglePlay = async () => {
    if (tapLocked.current) return;
    tapLocked.current = true;
    try {
      isPlaying ? await pauseActive() : await playActive();
      showHUD();
    } catch {} finally {
      setTimeout(() => (tapLocked.current = false), 180);
    }
  };

  /* ========= Auth helper ========= */
  const ensureToken = async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  };

  /* ========= Update helper ========= */
  const updateActiveInFeed = (patch: Partial<FeedPost>) => {
    setFeed((prev) => {
      const i = activeIndex;
      if (!prev[i]) return prev;
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  /* ========= Handlers reacciones ========= */
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
      setRepostCount((c) => Math.max(0, Math.min(999999, c - 1)));
      updateActiveInFeed({
        has_reposted: false,
        reposts_count: Math.max(0, (activePost?.reposts_count ?? 0) - 1),
      });
    }
  };

  /* ========= EDITAR / ELIMINAR ========= */
  const handleEdit = async () => {
    if (postId == null) return;
    try {
      await pauseActive();
    } catch {}
    setPostOptionsVisible(false);
    // Navega a Compose con los datos del post para editar
    router.push({
      pathname: "/compose",
      params: {
        editPostId: String(postId),
        // opcionalmente podrías pasar flags extra
      },
    });
  };

  const handleDelete = async () => {
    if (postId == null) return;
    Alert.alert("Eliminar publicación", "¿Seguro que deseas eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const tk = await ensureToken();
            const res = await fetch(endpoints.fincaPostDetail(postId), {
              method: "DELETE",
              headers: { Authorization: `Token ${tk}` },
            });
            if (res.status !== 204) {
              const txt = await res.text();
              throw new Error(txt || "No se pudo eliminar");
            }
            setPostOptionsVisible(false);
            setFeed((prev) => prev.filter((p) => p.id !== postId));
            setActiveIndex((i) => Math.max(0, i - 1));
          } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  /* ========= Tabs carrusel ========= */
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
    else {
      const arr = Array.from(videoRefs.current.values());
      arr.forEach((v) => { try { v.pauseAsync(); } catch {} });
    }
  };

  const gotoTab = (idx: number) => {
    tabsRef.current?.scrollTo({ x: width * idx, y: 0, animated: true });
    setTabIndex(idx);
    if (idx === 1) playActive();
    else {
      const arr = Array.from(videoRefs.current.values());
      arr.forEach((v) => { try { v.pauseAsync(); } catch {} });
    }
  };

  /* ========= FlatList visibility ========= */
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 90 }), []);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const v = viewableItems.find((vt) => vt.isViewable);
      if (v && typeof v.index === "number") {
        setActiveIndex(v.index);
        requestAnimationFrame(() => { ensureOnlyActivePlaying(); });
      }
    }
  ).current;

  const isMyPost =
    !!activePost?.author?.username &&
    !!profile?.username &&
    activePost.author.username === profile.username;

  const openPostOptions = () => {
    if (postId == null) return;
    setPostOptionsVisible(true);
  };

  const handleShare = async () => {
    try {
      const url = activePost?.video || activePost?.image || undefined;
      const message =
        (activePost?.content?.trim() ? `${activePost.content.trim()}\n` : "") + (url ? url : "");
      await Share.share({ message: message || "Mira esta publicación" });
    } catch {}
  };

  /* ========= Estabilidad en vertical: snap & bloqueo tabs ========= */
  const snapToNearest = (offsetY: number) => {
    const itemH = height || 1;
    const idx = Math.max(0, Math.min(feed.length - 1, Math.round(offsetY / itemH)));
    requestAnimationFrame(() => {
      flatRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  };
  const onFLBeginDrag = () => {
    setTabsScrollEnabled(false);
    pauseActive();
  };
  const onFLEndDrag = (e?: NativeSyntheticEvent<NativeScrollEvent>) => {
    setTimeout(() => setTabsScrollEnabled(true), 80);
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    snapToNearest(y);
  };
  const onFLMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setTabsScrollEnabled(true);
    const y = e.nativeEvent.contentOffset?.y ?? 0;
    snapToNearest(y);
    ensureOnlyActivePlaying();
  };

  // Re-alinear al rotar
  useEffect(() => {
    if (!feed.length) return;
    const idx = Math.max(0, Math.min(activeIndex, feed.length - 1));
    requestAnimationFrame(() => {
      flatRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  }, [height, feed.length]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      videoRefs.current.forEach((v) => {
        try {
          // @ts-ignore
          v.setOnPlaybackStatusUpdate && v.setOnPlaybackStatusUpdate(null);
          v.unloadAsync && v.unloadAsync();
        } catch {}
      });
      videoRefs.current.clear();
    };
  }, []);

  /* ========= renderItem ========= */
  const renderPostItem = ({ item, index }: { item: FeedPost; index: number }) => {
    const isActive = index === activeIndex;
    return (
      <PostCard
        item={item}
        index={index}
        width={width}
        height={height}
        isLand={isLand}
        tabIndex={tabIndex}
        portraitFit={portraitFit}
        fitMode={fitMode}
        hudVisible={hudVisible}
        active={isActive}
        onStatus={onStatus}
        videoRefMap={videoRefs}
        onTapToggle={togglePlay}
        showHUD={showHUD}
      />
    );
  };

  const badgeBottom = (insets.bottom || 0) + (isLand ? 10 : 16);
  const progressBottom =
    Math.max((insets.bottom || 0) + 10, badgeBottom + (controlsH || 60) + 12);
  const effectiveH = Math.min(Math.max(0, captionH), CAPTION_MAX_HEIGHT);
  const captionBottom = progressBottom + 6 + (CAPTION_MAX_HEIGHT - effectiveH) + 74;

  return (
    <View style={styles.root}>
      <StatusBar hidden={immersive} animated />

      {/* ===== CARRUSEL TABS ===== */}
      <ScrollView
        ref={tabsRef}
        horizontal
        pagingEnabled
        scrollEnabled={tabsScrollEnabled}
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onTabsEnd}
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
                ref={flatRef}
                data={feed}
                keyExtractor={(it) => String((it as FeedPost).id)}
                renderItem={renderPostItem}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                snapToAlignment="start"
                disableIntervalMomentum
                nestedScrollEnabled
                getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                extraData={height}
                removeClippedSubviews
                windowSize={3}
                maxToRenderPerBatch={2}
                initialNumToRender={3}
                onScrollToIndexFailed={(info) => {
                  requestAnimationFrame(() => {
                    flatRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: false,
                    });
                  });
                }}
                onScrollBeginDrag={onFLBeginDrag}
                onScrollEndDrag={onFLEndDrag}
                onMomentumScrollEnd={onFLMomentumEnd}
              />

              {/* Badge + reacciones */}
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
                    style={[styles.demoBadge, { maxWidth: Math.min(140, width - 28), marginRight: 12 }]}
                    onPress={() => {}}
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

                  {/* Botón ajuste HORIZONTAL */}
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

                  {/* Botón ajuste VERTICAL (fill → 4:16 → ALTO) */}
                  {!isLand && (
                    <TouchableOpacity
                      onPress={() =>
                        setPortraitFit((m) => (m === "fill" ? "full" : m === "full" ? "tall" : "fill"))
                      }
                      activeOpacity={0.85}
                      style={[styles.reactBtn, { marginLeft: 8 }]}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                        {portraitFit === "fill" ? "LLENAR" : portraitFit === "full" ? "4:16" : "ALTO"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Caption horizontal */}
                  {isLand && !!activePost?.content?.trim() && (
                    <View style={[styles.landCaption, { maxWidth: Math.min(360, width * 0.36) }]}>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.landCaptionText, styles.txtShadow]}>
                        {activePost.content!.trim()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </>
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
            <Text style={[styles.placeholderText, styles.txtShadow]}>Productos próximamente…</Text>
          </View>
        </View>
      </ScrollView>

      {/* Overlays */}
      <View style={[styles.topRow, { top: insets.top + 14, left: 14, right: 14 }]}>
        <TouchableOpacity
          onPress={async () => {
            try { await pauseActive(); } catch {}
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
            <TouchableOpacity activeOpacity={0.9} style={styles.topIconBtn} onPress={() => setPostOptionsVisible(true)}>
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
            onPress={() => {
              setTabIndex(i);
              gotoTab(i);
            }}
            style={[styles.tabBtn, i > 0 ? { marginLeft: 18 } : null]}
          >
            <Text style={[styles.tabWord, styles.txtShadow, i === tabIndex && styles.tabWordActive]}>
              {t}
            </Text>
            {i === tabIndex && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Caption flotante SOLO vertical */}
      {tabIndex === 1 && !!activePost?.content?.trim() && !isLand && (
        <View pointerEvents="box-none" style={[styles.captionWrap, { left: 16, right: 16, bottom: captionBottom }]}>
          <CaptionScroller onHeight={setCaptionH}>
            <StrokeText style={styles.captionText} color="#fff" strokeColor="#000" strokeWidth={2}>
              {activePost?.content?.trim()}
            </StrokeText>
          </CaptionScroller>
        </View>
      )}

      {/* Modales */}
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

      {postId != null && (
        <PostActionsModal
          visible={postOptionsVisible}
          onClose={() => setPostOptionsVisible(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSharePress={handleShare}
          onReport={() => Alert.alert("Gracias", "Reporte enviado")}
          canEditDelete={isMyPost}
          post={activePost as any}
          onToggleSave={handleToggleSave}
        />
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

  // Capa que captura el TAP para HUD y play/pause
  tapHit: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },

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
    color: "#fff",
  },

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

  placeholderWrap: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  placeholderTitle: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  placeholderText: { color: "rgba(255,255,255,0.95)", fontSize: 14 },
});
