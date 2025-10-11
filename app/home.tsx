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
  GestureResponderEvent,
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
import SubscribeBell from "./components/SubscribeBell";
import ChatQuickModal from "./components/ChatQuickModal";

/* Componentes extraídos */
import TopTabs from "./components/TopTabs";
import TopComposeBar from "./components/TopComposeBar";

/* ===== Ajustes visuales ===== */
const AV_SIZE = 48;

/* ===== Caption ===== */
const CAPTION_FONT_SIZE = 15;
const CAPTION_LINE_HEIGHT = 20;
const CAPTION_MAX_LINES = 4;
const CAPTION_MAX_HEIGHT = CAPTION_LINE_HEIGHT * CAPTION_MAX_LINES;
/** Afinar posición del caption (solo portrait) */
const CAPTION_EXTRA_BASE = 40;
const CAPTION_NUDGE = -20;

/* ===== Tabs ===== */
const TABS = ["FEELINGS", "PUBLICACIONES", "PODCASTS", "TIENDA"] as const;

/* ===== Tipos ===== */
type Gender = "M" | "F" | "O";
type MiniAuthor = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender?: Gender | string | null;
};
type RepostOf = {
  id: number;
  author: MiniAuthor;
  content?: string | null;
  image?: string | null;
  video?: string | null;
  created_at?: string;
};
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
  author?: MiniAuthor | null;
  repost_of?: RepostOf | null;
  reposts_count?: number;
  has_reposted?: boolean;
  stars_count?: number;
  has_starred?: boolean;
  comments_count?: number;
  saves_count?: number;
  has_saved?: boolean;
  views_count?: number;
  subscribers_count?: number;
  has_subscribed?: boolean;
  author_subscribers_count?: number;
  has_subscribed_author?: boolean;
};

/* Avatares fallback */
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const getAvatarSource = (
  p?: Pick<Profile, "avatar" | "gender"> | MiniAuthor | null
) => {
  const uri = (p as any)?.avatar ? String((p as any).avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export const options = { headerShown: false };

/** Texto con contorno (para caption) */
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

/** Caption con scroll interno */
function CaptionScroller({
  children,
  onHeight,
}: {
  children: React.ReactNode;
  onHeight?: (h: number) => void;
}) {
  const [contentH, setContentH] = React.useState(0);
  const renderedH = Math.min(contentH, CAPTION_MAX_HEIGHT);
  useEffect(() => {
    onHeight?.(renderedH || 0);
  }, [renderedH, onHeight]);
  const canScroll = contentH > CAPTION_MAX_HEIGHT;
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

const getEffectiveVideo = (p?: FeedPost | null) =>
  (p?.video || p?.repost_of?.video) || null;
const getEffectiveImage = (p?: FeedPost | null) =>
  (p?.image || p?.repost_of?.image) || null;
const getEffectiveCaption = (p?: FeedPost | null) =>
  p?.content?.trim() || p?.repost_of?.content?.trim() || "";

/* ===================== PostCard ===================== */
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
  onUserInteract: () => void;
  fullBoost: 0 | 0.04 | 0.08;
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
  onUserInteract,
  fullBoost,
}: PostCardProps) {
  const id = item.id;
  const videoUri = getEffectiveVideo(item) || undefined;
  const imageUri = !videoUri ? getEffectiveImage(item) || undefined : undefined;

  let computedMode: ResizeMode = ResizeMode.CONTAIN;
  if (isLand)
    computedMode =
      fitMode === "contain"
        ? ResizeMode.CONTAIN
        : fitMode === "cover"
        ? ResizeMode.COVER
        : ResizeMode.CONTAIN;
  else
    computedMode =
      portraitFit === "fill"
        ? ResizeMode.COVER
        : portraitFit === "full"
        ? ResizeMode.CONTAIN
        : ResizeMode.COVER;

  const DESZOOM_TALL = 1.5;

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
                !isLand && portraitFit === "tall"
                  ? { transform: [{ scale: DESZOOM_TALL }] }
                  : null,
                !isLand && portraitFit === "full" && fullBoost
                  ? { transform: [{ scale: 1 + fullBoost }] }
                  : null,
              ]}
              resizeMode={computedMode}
              shouldPlay={active && tabIndex === 1}
              isLooping
              volume={1.0}
              useNativeControls={false}
              onPlaybackStatusUpdate={active ? (s) => onStatus(s, id) : undefined}
            />
            <Pressable
              style={styles.tapHit}
              onPress={() => {
                onUserInteract();
                showHUD(1200);
                onTapToggle();
              }}
              android_disableSound
            />
          </>
        ) : imageUri ? (
          <View style={{ flex: 1 }}>
            <ImageBackground
              source={{ uri: imageUri }}
              blurRadius={24}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            >
              <LinearGradient
                colors={[
                  "rgba(0,0,0,0.40)",
                  "rgba(0,0,0,0.20)",
                  "rgba(0,0,0,0.45)",
                ]}
                style={StyleSheet.absoluteFill}
              />
            </ImageBackground>
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.video,
                !isLand && portraitFit === "tall"
                  ? { transform: [{ scale: DESZOOM_TALL }] }
                  : null,
                !isLand && portraitFit === "full" && fullBoost
                  ? { transform: [{ scale: 1 + fullBoost }] }
                  : null,
              ]}
              resizeMode={computedMode}
            />
          </View>
        ) : (
          <View style={[styles.placeholderWrap, { backgroundColor: "#000" }]}>
            <Text style={[styles.placeholderText, styles.txtShadow]}>
              Publicación sin media
            </Text>
          </View>
        )}
      </View>

      {hudVisible && active && videoUri && (
        <View pointerEvents="none" style={styles.centerBtn}>
          <Text style={[styles.centerIcon, styles.txtShadow]}>●</Text>
        </View>
      )}
    </View>
  );
});

/* ===== util: dedupe por id ===== */
const dedupById = (arr: FeedPost[]) => {
  const seen = new Set<number>();
  const out: FeedPost[] = [];
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    if (!it || typeof it.id !== "number") continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
};

/* ===================== Home ===================== */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    newPostId?: string;
    newVideo?: string;
    newImage?: string;
    newText?: string;
    focusPostId?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLand = width > height;
  const immersive = isLand;

  const LAND_BADGE_MAXW = Math.min(width * 0.6, 520);

  // Tamaños UI base (iconos y botones de reacción)
  const shortest = Math.min(width, height);
  const ICON_SIZE = Math.round(Math.max(16, Math.min(22, shortest * 0.048)));
  const BTN_SIZE = ICON_SIZE + 14;
  const COUNT_FS = Math.max(9, Math.min(12, shortest * 0.025));
  const btnDims = {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
  } as const;

  const [tabIndex, setTabIndex] = useState(1);
  const tabsRef = useRef<ScrollView>(null);

  const flatRef = useRef<FlatList<FeedPost>>(null);

  const [tabsScrollEnabled, setTabsScrollEnabled] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const activePost: FeedPost | null = feed.length
    ? feed[Math.max(0, Math.min(activeIndex, feed.length - 1))]
    : null;

  const postId = activePost?.id ?? null;

  const [starred, setStarred] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);

  const [starCount, setStarCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const viewedSetRef = useRef<Set<number>>(new Set());

  const [subscribed, setSubscribed] = useState(false);
  const [subsCount, setSubsCount] = useState(0);

  const videoRefs = useRef<Map<number, Video>>(new Map());
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);

  type Timeout = ReturnType<typeof setTimeout>;
  const hudTimer = useRef<Timeout | null>(null);

  const [controlsH, setControlsH] = useState(0);
  const [captionH, setCaptionH] = useState(0);
  const [progressW, setProgressW] = useState(0);
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const [fitMode, setFitMode] = useState<"auto" | "contain" | "cover">("auto");
  const [portraitFit, setPortraitFit] = useState<"fill" | "full" | "tall">(
    "fill"
  );
  const [fullBoost, setFullBoost] = useState<0 | 0.04 | 0.08>(0);
  const [vidSizes, setVidSizes] = useState<Record<number, { w: number; h: number }>>(
    {}
  );

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [starrersVisible, setStarrersVisible] = useState(false);
  const [saverVisible, setSaverVisible] = useState(false);
  const [repostersVisible, setRepostersVisible] = useState(false);
  const [postOptionsVisible, setPostOptionsVisible] = useState(false);

  /* Modal de chat */
  const [chatVisible, setChatVisible] = useState(false);

  const [progressVisible, setProgressVisible] = useState(false);
  const progressTimer = useRef<Timeout | null>(null);

  const showProgressTemporarily = (ms = 2000) => {
    if (!isLand) return;
    setProgressVisible(true);
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => setProgressVisible(false), ms);
  };

  useEffect(() => {
    if (isLand) setProgressVisible(false);
  }, [isLand]);

  useEffect(() => {
    return () => {
      if (hudTimer.current != null) clearTimeout(hudTimer.current);
      if (progressTimer.current != null) clearTimeout(progressTimer.current);
      if (subToastTimer.current != null) clearTimeout(subToastTimer.current);
    };
  }, []);

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

  useEffect(() => {
    (async () => {
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        const res = await fetch(endpoints.feedAll(), {
          headers: { Authorization: `Token ${tk}` },
        });
        const json = await res.json();
        const items: FeedPost[] = Array.isArray(json?.results)
          ? json.results
          : json || [];
        setFeed(dedupById(items)); // ← sin duplicados
      } catch {}
    })();
  }, []);

  /* ======= Post "fantasma" tras publicar ======= */
  useEffect(() => {
    const id = params?.newPostId ? Number(params.newPostId) : null;
    const newV =
      typeof params?.newVideo !== "undefined"
        ? String(params.newVideo || "")
        : null;
    const newI =
      typeof params?.newImage !== "undefined"
        ? String(params.newImage || "")
        : null;
    const newT =
      typeof params?.newText !== "undefined" ? String(params.newText || "") : "";
    if (id || newV || newI) {
      const pseudo: FeedPost = {
        id: id ?? -1,
        video: newV || null,
        image: !newV && newI ? newI : newI || null,
        content: newT,
        author: profile
          ? {
              username: profile.username,
              display_name: profile.display_name || profile.username,
              avatar: profile.avatar,
              gender: profile.gender,
            }
          : null,
        stars_count: 0,
        comments_count: 0,
        reposts_count: 0,
        saves_count: 0,
        has_starred: false,
        has_reposted: false,
        has_saved: false,
        views_count: 0,
        subscribers_count: 0,
        has_subscribed: false,
      };
      setFeed((prev) => dedupById([pseudo, ...prev.filter((p) => p.id !== pseudo.id)]));
      setActiveIndex(0);
      setTimeout(() => playActive(), 50);
    }
  }, [params?.newPostId, params?.newVideo, params?.newImage, params?.newText, profile]);

  /* ======= Focus externo ======= */
  useEffect(() => {
    const focusId = params?.focusPostId ? Number(params.focusPostId) : null;
    if (!focusId || !feed.length) return;
    const idx = feed.findIndex((p) => p.id === focusId);
    if (idx >= 0) {
      setActiveIndex(idx);
      requestAnimationFrame(() => {
        flatRef.current?.scrollToIndex({ index: idx, animated: false });
      });
    }
  }, [params?.focusPostId, feed.length]);

  useEffect(() => {
    if (!activePost) {
      setStarred(false);
      setSaved(false);
      setHasReposted(false);
      setStarCount(0);
      setCommentCount(0);
      setRepostCount(0);
      setSaveCount(0);
      setViewCount(0);
      setSubscribed(false);
      setSubsCount(0);
      return;
    }
    setStarred(!!activePost.has_starred);
    setSaved(!!activePost.has_saved);
    setHasReposted(!!activePost.has_reposted);

    setStarCount(Number(activePost.stars_count || 0));
    setCommentCount(Number(activePost.comments_count || 0));
    setRepostCount(Number(activePost.reposts_count || 0));
    setSaveCount(Number(activePost.saves_count || 0));
    setViewCount(Number(activePost.views_count || 0));

    const ap: any = activePost;
    setSubscribed(!!(ap.has_subscribed ?? ap.has_subscribed_author));
    setSubsCount(Number(ap.subscribers_count ?? ap.author_subscribers_count ?? 0));
  }, [activeIndex, activePost?.id]); // eslint-disable-line

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

  /* ===== Gate de reproducción ===== */
  const playToken = useRef(0);
  const playOnly = async (id: number) => {
    const myTok = ++playToken.current;
    await pauseAllExcept(id);
    if (myTok !== playToken.current) return;
    try {
      await videoRefs.current.get(id)?.playAsync();
      setIsPlaying(true);
    } catch {}
  };
  const ensureOnlyActivePlaying = async () => {
    const id = getActiveId();
    await pauseAllExcept(id);
    if (tabIndex === 1) await playOnly(id);
  };

  useFocusEffect(
    useCallback(() => {
      if (tabIndex === 1) ensureOnlyActivePlaying();
      else
        Array.from(videoRefs.current.values()).forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
      return () =>
        Array.from(videoRefs.current.values()).forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
    }, [tabIndex, activeIndex])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active")
        Array.from(videoRefs.current.values()).forEach((v) => {
          try {
            v.pauseAsync();
          } catch {}
        });
      else ensureOnlyActivePlaying();
    });
    return () => sub.remove();
  }, [activeIndex, tabIndex]);

  const getActiveRef = () => videoRefs.current.get(activePost?.id ?? -9999);

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
    await playOnly(getActiveId());
  };
  const pauseActive = async () => {
    try {
      const id = getActiveId();
      await videoRefs.current.get(id)?.pauseAsync();
      setIsPlaying(false);
    } catch {}
  };

  const seekToRatio = async (ratio: number) => {
    if (!duration) return;
    const ms = Math.max(0, Math.min(duration, Math.round(duration * ratio)));
    try {
      await getActiveRef()?.setPositionAsync?.(ms);
      setPosition(ms);
    } catch {}
  };

  const tapLocked = useRef(false);
  const togglePlay = async () => {
    if (tapLocked.current) return;
    tapLocked.current = true;
    try {
      isPlaying ? await pauseActive() : await playActive();
      setHudVisible(true);
      if (hudTimer.current) clearTimeout(hudTimer.current);
      hudTimer.current = setTimeout(() => setHudVisible(false), 1200);
    } finally {
      setTimeout(() => (tapLocked.current = false), 180);
    }
  };

  const ensureToken = async () => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) throw new Error("No token");
    return tk;
  };

  const updateActiveInFeed = (patch: Partial<FeedPost>) => {
    setFeed((prev) => {
      const i = activeIndex;
      if (!prev[i]) return prev;
      const next = [...prev];
      next[i] = { ...prev[i], ...patch };
      return next;
    });
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      if (postId == null) return;
      if (viewedSetRef.current.has(postId)) return;
      try {
        const tk = await AsyncStorage.getItem("userToken");
        if (!tk) return;
        await fetch(endpoints.fincaPostView(postId), {
          method: "POST",
          headers: { Authorization: `Token ${tk}` },
        });
        viewedSetRef.current.add(postId);
        setViewCount((n) => n + 1);
        updateActiveInFeed({
          views_count: Math.max(0, (activePost?.views_count || 0) + 1),
        });
      } catch {}
    };
    timer = setTimeout(run, 800);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [postId]); // eslint-disable-line

  const viewsLabel = (n?: number) => {
    const v = Number(n || 0);
    return v === 1 ? "Visto 1 vez" : `Visto ${v} veces`;
  };

  const handleToggleStar = async () => {
    if (postId == null) return;
    const next = !starred;
    setStarred(next);
    setStarCount((c) => Math.max(0, c + (next ? 1 : -1)));
    updateActiveInFeed({
      has_starred: next,
      stars_count: Math.max(
        0,
        (activePost?.stars_count ?? 0) + (next ? 1 : -1)
      ),
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
        stars_count: Math.max(
          0,
          (activePost?.stars_count ?? 0) + (revert ? 1 : -1)
        ),
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
      saves_count: Math.max(
        0,
        (activePost?.saves_count ?? 0) + (next ? 1 : -1)
      ),
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
      setSaveCount((c) => Math.max(0, c - 1));
      updateActiveInFeed({
        has_saved: revert,
        saves_count: Math.max(0, (activePost?.saves_count ?? 0) - 1),
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

  const handleEdit = async () => {
    if (postId == null) return;
    try {
      await pauseActive();
    } catch {}
    setPostOptionsVisible(false);
    router.push({ pathname: "/compose", params: { editPostId: String(postId) } });
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
    else
      Array.from(videoRefs.current.values()).forEach((v) => {
        try {
          v.pauseAsync();
        } catch {}
      });
  };

  const gotoTab = (idx: number) => {
    tabsRef.current?.scrollTo({ x: width * idx, y: 0, animated: true });
    setTabIndex(idx);
    if (idx === 1) playActive();
    else
      Array.from(videoRefs.current.values()).forEach((v) => {
        try {
          v.pauseAsync();
        } catch {}
      });
  };

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 90 }), []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const v = viewableItems.find((vt) => vt.isViewable);
      if (v && typeof v.index === "number") {
        setActiveIndex(v.index);
        requestAnimationFrame(() => {
          setTimeout(() => {
            ensureOnlyActivePlaying();
          }, 30);
        });
      }
    }
  ).current;

  const isMyPost =
    !!activePost?.author?.username &&
    !!profile?.username &&
    activePost.author!.username === profile.username;

  const handleShare = async () => {
    try {
      const url =
        getEffectiveVideo(activePost) || getEffectiveImage(activePost) || undefined;
      const message =
        (getEffectiveCaption(activePost) ? `${getEffectiveCaption(activePost)}\n` : "") +
        (url ? url : "");
      await Share.share({ message: message || "Mira esta publicación" });
    } catch {}
  };

  const fmt = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" + s : s}`;
  };

  const onProgressPress = (e: GestureResponderEvent) => {
    if (!duration) return;
    const x = e.nativeEvent.locationX;
    if (progressW <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / progressW));
    seekToRatio(ratio);
    showProgressTemporarily(2500);
  };

  const primaryAuthor = activePost?.repost_of?.author || activePost?.author || null;
  const reposter = activePost?.repost_of ? activePost?.author || null : null;

  const hasVideoActive = !!getEffectiveVideo(activePost);
  const shouldShowProgress =
    tabIndex === 1 && hasVideoActive && (!isLand || (isLand && progressVisible));

  const [subToast, setSubToast] = useState<string | null>(null);
  const subToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, ms = 1200) => {
    setSubToast(msg);
    if (subToastTimer.current) clearTimeout(subToastTimer.current);
    subToastTimer.current = setTimeout(() => setSubToast(null), ms);
  };

  const handleToggleSubscribe = async () => {
    if (postId == null) return;
    const next = !subscribed;
    const optimisticCount = Math.max(0, subsCount + (next ? 1 : -1));
    setSubscribed(next);
    setSubsCount(optimisticCount);
    showToast(`${next ? "Suscrito" : "Sin suscripción"} · ${optimisticCount}`);
    try {
      const tk = await ensureToken();
      const res = await fetch(endpoints.fincaPostSubscribe(postId), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error("Bad response");

      const serverHas = !!data.has_subscribed_author;
      const serverCount = Number(data.author_subscribers_count ?? optimisticCount);
      setSubscribed(serverHas);
      setSubsCount(serverCount);
      showToast(`${serverHas ? "Suscrito" : "Sin suscripción"} · ${serverCount}`);
      updateActiveInFeed({
        has_subscribed: serverHas,
        subscribers_count: serverCount,
      });
    } catch {
      const revertHas = !next;
      const revertCount = Math.max(0, subsCount + (revertHas ? 1 : -1));
      setSubscribed(revertHas);
      setSubsCount(revertCount);
      showToast("Error al actualizar la suscripción");
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden={immersive} animated />

      {/* ===== Carrusel de tabs (páginas) ===== */}
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
            <Text style={[styles.placeholderText, styles.txtShadow]}>
              Contenido próximamente…
            </Text>
          </View>
        </View>

        {/* PUBLICACIONES */}
        <View style={[styles.page, { width, height }]}>
          {feed.length === 0 ? (
            <View style={[styles.placeholderWrap, { paddingHorizontal: 24 }]}>
              <Text style={[styles.placeholderTitle, styles.txtShadow]}>
                PUBLICACIONES
              </Text>
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
                renderItem={({ item, index }) => {
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
                      showHUD={(ms) => {
                        setHudVisible(true);
                        if (hudTimer.current) clearTimeout(hudTimer.current);
                        hudTimer.current = setTimeout(
                          () => setHudVisible(false),
                          ms ?? 1200
                        );
                      }}
                      onUserInteract={() => showProgressTemporarily(2000)}
                      fullBoost={fullBoost}
                    />
                  );
                }}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                snapToAlignment="start"
                disableIntervalMomentum
                nestedScrollEnabled
                getItemLayout={(_, index) => ({
                  length: height,
                  offset: height * index,
                  index,
                })}
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
                onScrollBeginDrag={() => {
                  setTabsScrollEnabled(false);
                  pauseActive();
                }}
                onScrollEndDrag={(e) => {
                  setTimeout(() => setTabsScrollEnabled(true), 80);
                  const y = e?.nativeEvent?.contentOffset?.y ?? 0;
                  const itemH = height || 1;
                  const idx = Math.max(
                    0,
                    Math.min(feed.length - 1, Math.round(y / itemH))
                  );
                  requestAnimationFrame(() =>
                    flatRef.current?.scrollToIndex({ index: idx, animated: false })
                  );
                }}
                onMomentumScrollEnd={(e) => {
                  setTabsScrollEnabled(true);
                  const y = e.nativeEvent.contentOffset?.y ?? 0;
                  const itemH = height || 1;
                  const idx = Math.max(
                    0,
                    Math.min(feed.length - 1, Math.round(y / itemH))
                  );
                  requestAnimationFrame(() =>
                    flatRef.current?.scrollToIndex({ index: idx, animated: false })
                  );
                  ensureOnlyActivePlaying();
                }}
              />

              {/* ===== BLOQUE OVERLAY: portrait vs landscape ===== */}
              <View
                pointerEvents="box-none"
                style={[
                  styles.demoBadgeWrap,
                  {
                    left: 14,
                    right: 14,
                    bottom: (insets.bottom || 0) + (isLand ? 10 : 16),
                  },
                ]}
              >
                {/* --------- MODO LANDSCAPE --------- */}
                {isLand ? (
                  <View
                    style={styles.landRow}
                    onLayout={(e) => setControlsH(e.nativeEvent.layout.height)}
                  >
                    {/* Burbuja a la izquierda (angosta) */}
                    <View
                      style={[
                        styles.badgeBlock,
                        { marginRight: 12, maxWidth: LAND_BADGE_MAXW },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[
                          styles.demoBadge,
                          styles.demoBadgeCompact,
                          { alignSelf: "flex-start" },
                        ]}
                        onPress={() => {}}
                      >
                        <View style={styles.avatarWrap}>
                          {/* ⤷ AVATAR */}
                          <Image
                            source={getAvatarSource(primaryAuthor)}
                            style={styles.demoBadgeAvatar}
                          />
                          <TouchableOpacity
                            onPress={() => setChatVisible(true)}
                            activeOpacity={0.9}
                            style={styles.avatarChatBtn}
                          >
                            <Ionicons name="paper-plane" size={13} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ marginLeft: 8, flexShrink: 1, flexGrow: 1 }}>
                          <Text
                            style={[styles.demoBadgeName, styles.txtShadow]}
                            numberOfLines={1}
                          >
                            {primaryAuthor?.display_name || "Usuario"}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text
                              style={[styles.demoBadgeMeta, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              Publicación
                            </Text>
                            <Text style={[styles.dotSep, styles.txtShadow]}>·</Text>
                            <Text
                              style={[styles.viewSeenText, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              {viewsLabel(viewCount)}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <SubscribeBell
                              subscribed={subscribed}
                              onPress={handleToggleSubscribe}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {!!reposter && (
                        <View style={{ marginTop: 6 }}>
                          <View style={[styles.reposterBadge]}>
                            <Image
                              source={getAvatarSource(reposter)}
                              style={styles.reposterAvatar}
                            />
                            <Text
                              style={[styles.reposterText, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              Compartido por{" "}
                              {reposter.display_name || reposter.username}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* IZQ: botón / DER: iconos */}
                    <View style={styles.reactionsRowLand}>
                      <TouchableOpacity
                        onPress={() =>
                          setFitMode((m) =>
                            m === "auto" ? "cover" : m === "cover" ? "contain" : "auto"
                          )
                        }
                        activeOpacity={0.9}
                        style={[styles.fitPill, { height: 32 }]}
                      >
                        <Text style={styles.fitPillText}>
                          {fitMode === "auto"
                            ? "AUTO"
                            : fitMode === "cover"
                            ? "LLENAR"
                            : "AJUSTAR"}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.reactionsRight}>
                        {/* ⭐ */}
                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleToggleStar}
                            onLongPress={() => {
                              if (postId != null) setStarrersVisible(true);
                            }}
                            style={[
                              styles.reactBtn,
                              btnDims,
                              starred && styles.reactBtnOn,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={starred ? "star" : "star-outline"}
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setStarrersVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {starCount}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* 💬 */}
                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
                              if (postId != null) setCommentsVisible(true);
                            }}
                            style={[styles.reactBtn, btnDims]}
                          >
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <Text
                            style={[styles.reactCount, { fontSize: COUNT_FS }]}
                            numberOfLines={1}
                          >
                            {commentCount}
                          </Text>
                        </View>

                        {/* 🔖 */}
                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleToggleSave}
                            onLongPress={() => {
                              if (postId != null) setSaverVisible(true);
                            }}
                            style={[styles.reactBtn, btnDims, saved && styles.reactBtnOn]}
                          >
                            <Ionicons name="bookmark" size={ICON_SIZE} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setSaverVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {saveCount}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* 🔁 */}
                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleRepost}
                            onLongPress={() => {
                              if (postId != null) setRepostersVisible(true);
                            }}
                            style={[
                              styles.reactBtn,
                              btnDims,
                              hasReposted && styles.reactBtnOn,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="repeat-variant"
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setRepostersVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {repostCount}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  /* --------- MODO PORTRAIT --------- */
                  <View
                    style={styles.overlayCol}
                    onLayout={(e) => setControlsH(e.nativeEvent.layout.height)}
                  >
                    <View style={styles.reactionsBar}>
                      {/* IZQUIERDA: botón */}
                      <TouchableOpacity
                        onPress={() =>
                          setPortraitFit((m) =>
                            m === "fill" ? "full" : m === "full" ? "tall" : "fill"
                          )
                        }
                        onLongPress={() =>
                          setFullBoost((b) => (b === 0 ? 0.04 : b === 0.04 ? 0.08 : 0))
                        }
                        activeOpacity={0.9}
                        style={[styles.fitPill, { height: 32 }]}
                      >
                        <Text style={styles.fitPillText}>
                          {portraitFit === "fill"
                            ? "LLENAR"
                            : portraitFit === "full"
                            ? fullBoost
                              ? "4:16+"
                              : "4:16"
                            : "ALTO"}
                        </Text>
                      </TouchableOpacity>

                      {/* DERECHA: iconos */}
                      <View style={styles.reactionsRight}>
                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleToggleStar}
                            onLongPress={() => {
                              if (postId != null) setStarrersVisible(true);
                            }}
                            style={[
                              styles.reactBtn,
                              btnDims,
                              starred && styles.reactBtnOn,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="star"
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setStarrersVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {starCount}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
                              if (postId != null) setCommentsVisible(true);
                            }}
                            style={[styles.reactBtn, btnDims]}
                          >
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <Text
                            style={[styles.reactCount, { fontSize: COUNT_FS }]}
                            numberOfLines={1}
                          >
                            {commentCount}
                          </Text>
                        </View>

                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleToggleSave}
                            onLongPress={() => {
                              if (postId != null) setSaverVisible(true);
                            }}
                            style={[styles.reactBtn, btnDims, saved && styles.reactBtnOn]}
                          >
                            <Ionicons name="bookmark" size={ICON_SIZE} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setSaverVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {saveCount}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.reactItem}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleRepost}
                            onLongPress={() => {
                              if (postId != null) setRepostersVisible(true);
                            }}
                            style={[
                              styles.reactBtn,
                              btnDims,
                              hasReposted && styles.reactBtnOn,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="repeat-variant"
                              size={ICON_SIZE}
                              color="#fff"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              if (postId != null) setRepostersVisible(true);
                            }}
                          >
                            <Text
                              style={[styles.reactCount, { fontSize: COUNT_FS }]}
                              numberOfLines={1}
                            >
                              {repostCount}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.badgeBlock}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[
                          styles.demoBadge,
                          styles.demoBadgeWide,
                          styles.demoBadgeCompact,
                        ]}
                        onPress={() => {}}
                      >
                        <View style={styles.avatarWrap}>
                          {/* ⤷ AVATAR */}
                          <Image
                            source={getAvatarSource(primaryAuthor)}
                            style={styles.demoBadgeAvatar}
                          />
                          <TouchableOpacity
                            onPress={() => setChatVisible(true)}
                            activeOpacity={0.9}
                            style={styles.avatarChatBtn}
                          >
                            <Ionicons name="paper-plane" size={13} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ marginLeft: 8, flexShrink: 1, flexGrow: 1 }}>
                          <Text
                            style={[styles.demoBadgeName, styles.txtShadow]}
                            numberOfLines={1}
                          >
                            {primaryAuthor?.display_name || "Usuario"}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text
                              style={[styles.demoBadgeMeta, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              Publicación
                            </Text>
                            <Text style={[styles.dotSep, styles.txtShadow]}>·</Text>
                            <Text
                              style={[styles.viewSeenText, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              {viewsLabel(viewCount)}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <SubscribeBell
                              subscribed={subscribed}
                              onPress={handleToggleSubscribe}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {!!reposter && (
                        <View style={{ marginTop: 6 }}>
                          <View style={[styles.reposterBadge]}>
                            <Image
                              source={getAvatarSource(reposter)}
                              style={styles.reposterAvatar}
                            />
                            <Text
                              style={[styles.reposterText, styles.txtShadow]}
                              numberOfLines={1}
                            >
                              Compartido por{" "}
                              {reposter.display_name || reposter.username}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* progreso */}
              {shouldShowProgress && (
                <View
                  pointerEvents="box-none"
                  style={[
                    styles.progressWrap,
                    {
                      left: 16,
                      right: 16,
                      bottom: Math.max(
                        (insets.bottom || 0) + 10,
                        (insets.bottom || 0) + 10 + (controlsH || 60) + 12
                      ),
                    },
                  ]}
                >
                  <Pressable
                    onLayout={(e) => setProgressW(e.nativeEvent.layout.width)}
                    onPress={onProgressPress}
                    style={styles.progressBarBg}
                  >
                    <View
                      style={[
                        styles.progressBarFg,
                        { width: Math.max(3, (progressW || 1) * progress) },
                      ]}
                    />
                  </Pressable>
                  <View style={styles.progressTimeRow}>
                    <Text style={styles.progressTime}>{fmt(position)}</Text>
                    <Text style={styles.progressTime}>{fmt(duration)}</Text>
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

      {/* Barra superior (componente extraído) */}
      <TopComposeBar
        style={{ top: insets.top + 14, left: 14, right: 14 }}
        profile={profile}
        immersive={immersive}
        AV_SIZE={AV_SIZE}
        onPressAvatar={async () => {
          try {
            await pauseActive();
          } catch {}
          router.push("/finca");
        }}
        onPressCompose={() => router.push("/compose")}
        onPressLeaf={() => setPostOptionsVisible(true)}
      />

      {/* Tabs superiores scrollables (componente externo, compacto) */}
      <TopTabs
        tabs={TABS}
        value={tabIndex}
        onChange={(i) => gotoTab(i)}
        topOffset={insets.top + 14 + 46 + 2}
        visible={!immersive}
      />

      {/* Caption (solo portrait y con contenido) */}
      {tabIndex === 1 &&
        !!(activePost && getEffectiveCaption(activePost)) &&
        !isLand && (
          <View
            pointerEvents="box-none"
            style={[
              styles.captionWrap,
              {
                left: 16,
                right: 16,
                bottom: (() => {
                  const insetB = (insets.bottom || 0) + 10;
                  const safeOverControls = insetB + (controlsH || 60) + 12;
                  const base = Math.max(insetB, safeOverControls);
                  const renderedH = Math.min(
                    Math.max(0, captionH),
                    CAPTION_MAX_HEIGHT
                  );
                  const spare = CAPTION_MAX_HEIGHT - renderedH;
                  return base + 6 + spare + CAPTION_EXTRA_BASE + CAPTION_NUDGE;
                })(),
              },
            ]}
          >
            <CaptionScroller onHeight={setCaptionH}>
              <StrokeText
                style={styles.captionText}
                color="#fff"
                strokeColor="#000"
                strokeWidth={2}
              >
                {getEffectiveCaption(activePost)}
              </StrokeText>
            </CaptionScroller>
          </View>
        )}

      {subToast && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{subToast}</Text>
        </View>
      )}

      {/* Modales de listas */}
      {postId != null && (
        <CommentsModal
          visible={commentsVisible}
          postId={postId}
          onClose={() => setCommentsVisible(false)}
          onCountChange={(n) => setCommentCount(Number(n || 0))}
        />
      )}
      {postId != null && (
        <StarrersModal
          visible={starrersVisible}
          postId={postId}
          onClose={() => setStarrersVisible(false)}
        />
      )}
      {postId != null && (
        <SaverModal
          visible={saverVisible}
          postId={postId}
          onClose={() => setSaverVisible(false)}
        />
      )}
      {postId != null && (
        <RepostersModal
          visible={repostersVisible}
          postId={postId}
          onClose={() => setRepostersVisible(false)}
        />
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

      {/* Modal de chat rápido */}
      <ChatQuickModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        targetUsername={primaryAuthor?.username || ""}
        targetDisplayName={
          primaryAuthor?.display_name || primaryAuthor?.username || ""
        }
        targetAvatar={primaryAuthor?.avatar || null}
      />
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
  tapHit: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },

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

  txtShadow: {
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  /* Overlay */
  demoBadgeWrap: { position: "absolute" },

  /* LANDSCAPE: fila con burbuja + reacciones */
  landRow: { flexDirection: "row", alignItems: "flex-end" },

  // Landscape: botón IZQ + iconos DER separados
  reactionsRowLand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  /* PORTRAIT */
  overlayCol: { flexDirection: "column", alignItems: "stretch" },

  // Portrait: botón IZQ + iconos DER separados
  reactionsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  // Contenedor de iconos (lado derecho)
  reactionsRight: { flexDirection: "row", alignItems: "center", gap: 10 },

  reactItem: { alignItems: "center" },
  reactBtn: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  reactBtnOn: {
    backgroundColor: "rgba(165,214,167,0.30)",
    borderColor: LIGHT_GREEN,
  },
  reactCount: {
    color: "#fff",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },

  /* ===== Burbuja full width (AÚN MÁS COMPACTA) ===== */
  badgeBlock: { alignSelf: "stretch" },

  demoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  demoBadgeWide: { width: "100%", maxWidth: "100%", alignSelf: "stretch" },
  demoBadgeCompact: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    minHeight: 30,
  },

  // AVATAR dentro de la burbuja (tamaño y radio)
  avatarWrap: {
    width: 34,
    height: 34,
    position: "relative",
    marginRight: 8,
  },
  demoBadgeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  avatarChatBtn: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  // Tipos compactos
  demoBadgeName: { color: "#fff", fontWeight: "800", fontSize: 11.5, lineHeight: 13 },
  demoBadgeMeta: { color: "rgba(255,255,255,0.9)", fontSize: 8.5 },
  viewSeenText: { color: "rgba(255,255,255,0.9)", fontSize: 8, fontWeight: "700" },
  dotSep: { color: "rgba(255,255,255,0.9)", marginHorizontal: 4, fontSize: 8.5 },

  // Reposter compacto
  reposterBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  reposterAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  reposterText: { color: "#fff", fontSize: 10, fontWeight: "700", marginLeft: 6 },

  placeholderWrap: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  placeholderText: { color: "rgba(255,255,255,0.95)", fontSize: 14 },

  /* progreso */
  progressWrap: { position: "absolute" },
  progressBarBg: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  progressBarFg: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.95)" },
  progressTimeRow: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" },
  progressTime: { color: "#fff", fontSize: 12 },

  /* Botón LLENAR/AJUSTAR (lado IZQUIERDO) */
  fitPill: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  fitPillText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },

  /* toast */
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 100,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
