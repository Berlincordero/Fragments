// app/finca.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import LottieView from "lottie-react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";

import { endpoints } from "../lib/api";
import CoverEditorModal, { FONT_STYLE_MAP, type FontKey, type EffectKey } from "./components/CoverEditorModal";
import { BubblePos } from "./components/DraggableBubble";
import ProfileOptionsModal from "./components/ProfileOptionsModal";

/* ───────────────── sizes / const ───────────────── */
const AVATAR_SIZE = 150;
const COVER_HEIGHT = 355;
const LENS_SIZE = 46;
const CAROUSEL_INTERVAL_MS = 5000;
const BG_BLUR = Platform.OS === "android" ? 18 : 60;

const FIX_COVER_TEXT = true;
const FIXED_COVER_TEXT_POS = { x: 0.06, y: 0.07 };
const BUBBLE_MAX_RATIO = 0.72;
const BUBBLE_MAX_ABS = 320;
const SAFE_LEFT_PX = 10;
const SAFE_RIGHT_PX = 10;
const SAFE_TOP_PX = 8;
const SAFE_BOTTOM_PX = 8;

/* ───────────────── assets ───────────────── */
const coverDefault = require("../assets/images/portada.jpg");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const cameraAnim = require("../assets/lottie/camera.json");

/* ───────────────── tipos ───────────────── */
type Gender = "M" | "F" | "O";
type ProfileDTO = {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  bio: string;
  date_of_birth: string | null;
  gender: Gender | string | null;
  avatar: string | null;
  cover: string | null;
};
type PostDTO = {
  id: number;
  content?: string | null;
  image: string | null;
  video: string | null;
  created_at: string;
  /** 👁️ viene del backend (views_count) */
  views_count?: number;
};

type CoverSlideDTO = {
  id: number;
  index: number;
  image: string | null;
  caption?: string | null;
  text_color?: string | null;
  text_font?: FontKey | null;
  text_x?: number | null;
  text_y?: number | null;
  text_size?: number | null;
  effect?: EffectKey | null;
};

/* ───────────────── helpers ───────────────── */
const getAvatarSource = (p?: { avatar?: string | null; gender?: string | null } | null) => {
  const uri = p?.avatar ? String(p?.avatar).trim() : "";
  if (uri) return { uri } as any;
  const g = String(p?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

function InfoChip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color="#9ccc9c" />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Tab con soporte para color forzado del ícono (tintColor) */
function Tab({
  label,
  icon,
  active,
  onPress,
  size = 14,
  tintColor,
}: {
  label: string;
  icon: React.ReactElement;
  active?: boolean;
  onPress?: () => void;
  size?: number;
  /** si se define, el ícono usa este color fijo */
  tintColor?: string;
}) {
  const iconColor = tintColor ?? (active ? "#C5E1A5" : "#e0e0e0");
  const iconEl = React.cloneElement(icon as any, { color: iconColor, size });
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <View style={styles.tabInner}>
        {iconEl}
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* efectos de portada */
const EffectOverlay = ({ effect }: { effect?: EffectKey | null }) => {
  if (!effect || effect === "none") return null;
  switch (effect) {
    case "warm":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(255,170,0,0.28)", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      );
    case "cool":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(0,140,255,0.28)", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </View>
      );
    case "contrast":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(0,0,0,0.30)", "transparent"]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: "36%" }}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.38)"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%" }}
          />
        </View>
      );
    default:
      return null;
  }
};

/* texto/burbuja helpers */
const bubbleWidthFor = (winW: number) => Math.min(Math.round(winW * BUBBLE_MAX_RATIO), BUBBLE_MAX_ABS);
const softWrap = (t: string, chunk = 10) => t.replace(new RegExp(`(\\S{${chunk}})(?=\\S)`, "g"), "$1\u200B");
const chunkFor = (fontPx: number, maxPx: number) => Math.max(1, Math.floor(maxPx / Math.max(1, fontPx) / 0.55));
const softWrapFit = (t: string, fontPx: number, maxPx: number) => softWrap(t, chunkFor(fontPx, maxPx));
const clampCoverPos = (pos: BubblePos | null | undefined, winW: number, coverH: number, bubbleW: number) => {
  const x = typeof pos?.x === "number" ? pos.x : 0.04;
  const y = typeof pos?.y === "number" ? pos.y : 0.08;
  const minXNorm = SAFE_LEFT_PX / Math.max(1, winW);
  const maxXNorm = (winW - SAFE_RIGHT_PX - bubbleW) / Math.max(1, winW);
  const minYNorm = SAFE_TOP_PX / Math.max(1, coverH);
  const maxYNorm = (coverH - SAFE_BOTTOM_PX - 28) / Math.max(1, coverH);
  const cx = Math.max(minXNorm, Math.min(maxXNorm, x));
  const cy = Math.max(minYNorm, Math.min(maxYNorm, y));
  return { left: Math.round(cx * winW), top: Math.round(cy * coverH) };
};

export default function FincaScreen() {
  const router = useRouter();
  const winW = Dimensions.get("window").width;

  /* ─────────────── state base ─────────────── */
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);

  const [activeTab, setActiveTab] =
    useState<"posts" | "podcast" | "feelings" | "shop" | "images" | "videos" | "settings">("posts");

  // portada
  const [coverSlides, setCoverSlides] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideTexts, setCoverSlideTexts] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideColors, setCoverSlideColors] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideFonts, setCoverSlideFonts] = useState<FontKey[]>(["default", "default", "default"]);
  const [coverSlidePositions, setCoverSlidePositions] = useState<(BubblePos | null)[]>([null, null, null]);
  const [coverSlideSizes, setCoverSlideSizes] = useState<(number | null)[]>([null, null, null]);
  const [coverSlideEffects, setCoverSlideEffects] = useState<(EffectKey | null)[]>([null, null, null]);

  const [slidesModal, setSlidesModal] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  /* ─────────────── hooks de la GRILLA (antes de cualquier return) ─────────────── */
  const gridVideoRefs = useRef<Map<number, Video>>(new Map());
  const [playingIds, setPlayingIds] = useState<Set<number>>(new Set());
  const applyPlayback = (ids: Set<number>) => {
    for (const [id, ref] of gridVideoRefs.current.entries()) {
      try {
        if (ids.has(id)) ref.playAsync();
        else ref.pauseAsync();
      } catch {}
    }
  };
  useEffect(() => {
    applyPlayback(playingIds);
  }, [playingIds]);
  // reproducir si cubre ≥ 60%
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const next = new Set<number>();
      viewableItems.forEach((vi) => {
        const it = vi.item as PostDTO;
        if (it?.video) next.add(it.id);
      });
      setPlayingIds(next);
    }
  ).current;

  /* ─────────────── data ─────────────── */
  const fetchAll = async () => {
    try {
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) {
        router.replace("/");
        return;
      }

      const [pRes, postsRes, slidesRes] = await Promise.all([
        fetch(endpoints.finca(), { headers: { Authorization: `Token ${tk}` } }),
        fetch(endpoints.fincaPosts(), { headers: { Authorization: `Token ${tk}` } }),
        fetch(endpoints.fincaCoverSlides(), { headers: { Authorization: `Token ${tk}` } }),
      ]);

      const p: ProfileDTO = await pRes.json();
      const myPosts: PostDTO[] = await postsRes.json();

      const slidesJson = await slidesRes.json();
      const results: CoverSlideDTO[] = Array.isArray(slidesJson?.results) ? slidesJson.results : [];

      const imgs: (string | null)[] = [null, null, null];
      const texts: (string | null)[] = [null, null, null];
      const colors: (string | null)[] = [null, null, null];
      const fonts: FontKey[] = ["default", "default", "default"];
      const poss: (BubblePos | null)[] = [null, null, null];
      const sizes: (number | null)[] = [null, null, null];
      const effects: (EffectKey | null)[] = [null, null, null];

      results.forEach((r) => {
        if (typeof r.index === "number" && r.index >= 0 && r.index < 3) {
          imgs[r.index] = r.image || null;
          texts[r.index] = r.caption ?? null;
          colors[r.index] = r.text_color ?? null;
          fonts[r.index] = (r.text_font as FontKey) ?? "default";
          if (typeof r.text_x === "number" && typeof r.text_y === "number") {
            poss[r.index] = { x: r.text_x, y: r.text_y };
          }
          sizes[r.index] = (typeof r.text_size === "number" ? r.text_size : null) as any;
          effects[r.index] = (r.effect as EffectKey) ?? null;
        }
      });

      setCoverSlides(imgs);
      setCoverSlideTexts(texts);
      setCoverSlideColors(colors);
      setCoverSlideFonts(fonts);
      setCoverSlidePositions(poss);
      setCoverSlideSizes(sizes);
      setCoverSlideEffects(effects);

      setProfile(p);
      setPosts(Array.isArray(myPosts) ? myPosts : []);
    } catch {
      Alert.alert("Error", "No se pudo cargar tus datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* 👁️ total de vistas (píldora superior) */
  const totalViews = useMemo(
    () => posts.reduce((acc, p) => acc + Number(p.views_count || 0), 0),
    [posts]
  );
  const totalViewsLabel =
    totalViews >= 100 ? "Más de 100 vistas" : `${totalViews} ${totalViews === 1 ? "vista" : "vistas"}`;

  /* slides memos/interval */
  const slidesData = useMemo(() => {
    return coverSlides
      .map((uri, i) => ({
        index: i,
        uri,
        text: coverSlideTexts[i],
        color: coverSlideColors[i] ?? "#ffffff",
        font: coverSlideFonts[i] ?? "default",
        size: coverSlideSizes[i] ?? 16,
        pos: coverSlidePositions[i] ?? { x: 0.04, y: 0.08 },
        effect: coverSlideEffects[i] ?? "none",
      }))
      .filter((s) => !!s.uri) as Array<{
      index: number;
      uri: string;
      text: string | null;
      color: string;
      font: FontKey;
      size: number;
      pos: BubblePos;
      effect: EffectKey | null;
    }>;
  }, [
    coverSlides,
    coverSlideTexts,
    coverSlideColors,
    coverSlideFonts,
    coverSlideSizes,
    coverSlidePositions,
    coverSlideEffects,
  ]);

  const slidesCount = slidesData.length;

  useEffect(() => {
    if (!slidesCount || slidesCount < 2) return;
    if (slidesModal) return;
    const id = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % slidesCount;
        scrollRef.current?.scrollTo({ x: winW * next, animated: true });
        return next;
      });
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [slidesCount, slidesModal, winW]);

  /* ─────────────── UI helpers ─────────────── */
  const TAB_ORDER: Array<"posts" | "podcast" | "feelings" | "shop" | "images" | "videos" | "settings"> = [
    "posts",
    "podcast",
    "feelings",
    "shop",
    "images",
    "videos",
    "settings",
  ];
  const tabToIndex = (t: typeof TAB_ORDER[number]) => TAB_ORDER.indexOf(t);
  const indexToTab = (i: number) => TAB_ORDER[Math.max(0, Math.min(TAB_ORDER.length - 1, i))];

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(1, winW));
    const max = Math.max(0, (slidesData.length || 1) - 1);
    setActiveSlide(Math.max(0, Math.min(idx, max)));
  };

  const onTabsPagerEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, winW));
    const tab = indexToTab(page);
    if (tab && activeTab !== tab) setActiveTab(tab);
  };

  const goToTab = (t: typeof TAB_ORDER[number]) => {
    if (t === "shop") {
      router.replace("/marketplace");
      return;
    }
    setActiveTab(t);
    const idx = tabToIndex(t as any);
    pagerRef.current?.scrollTo({ x: winW * idx, animated: true });
  };

  const bgUri = coverSlides[activeSlide] || coverSlides.find((u) => !!u) || profile?.cover || null;
  const bgSource = bgUri ? { uri: bgUri } : coverDefault;

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
    } finally {
      router.replace("/");
    }
  };

  /* ─────────────── pick avatar (fix deprecations) ─────────────── */
  const pickAndUpload = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as unknown as ImagePicker.MediaType[],
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) return;

      const form = new FormData();
      form.append("avatar", {
        uri: asset.uri,
        name: `avatar.jpg`,
        type: "image/jpeg",
      } as any);

      const up = await fetch(endpoints.finca(), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
        body: form,
      });
      const upd: ProfileDTO = await up.json();
      setProfile((prev) => ({ ...(prev as any), ...upd }));
    } catch {
      Alert.alert("Error", "No se pudo actualizar el avatar.");
    }
  };

  /* ─────────────── render tile ─────────────── */
  const renderGridItem = ({ item }: { item: PostDTO }) => {
    const isVideo = !!item.video;
    const hasImage = !!item.image && !isVideo;
    const tileW = (winW - 4 - 8) / 2;
    const views = Number(item.views_count || 0);

    return (
      <View style={[styles.tile, { width: tileW }]}>
        {/* Badge de vistas */}
        <View style={styles.viewBadge}>
          <Ionicons name="eye-outline" size={13} color="#fff" />
          <Text style={styles.viewBadgeText}>{views}</Text>
        </View>

        {isVideo ? (
          <>
            <ImageBackground
              source={item.image ? { uri: item.image } : undefined}
              style={StyleSheet.absoluteFill}
              blurRadius={item.image ? 18 : 0}
              resizeMode="cover"
            />
            <Video
              ref={(ref) => {
                if (ref) gridVideoRefs.current.set(item.id, ref);
                else gridVideoRefs.current.delete(item.id);
              }}
              source={{ uri: item.video as string }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playingIds.has(item.id)}
              isLooping
              isMuted
              volume={0}
              useNativeControls={false}
            />
          </>
        ) : hasImage ? (
          <Image source={{ uri: item.image! }} style={styles.tileImg} />
        ) : (
          <View style={styles.tileEmpty}>
            <Ionicons name="document-text-outline" size={18} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  /* ─────────────── UI ─────────────── */
  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover" blurRadius={BG_BLUR}>
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

      <SafeAreaView style={{ flex: 1 }}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} scrollEventThrottle={16}>
          {/* COVER + avatar */}
          <View style={styles.coverWrap}>
            <View style={{ height: COVER_HEIGHT, width: "100%" }}>
              {/* carousel */}
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumEnd}
              >
                {(slidesData.length ? slidesData : [{ uri: profile?.cover || null } as any]).map(
                  (s, idx) => {
                    const uri = s?.uri || profile?.cover || null;
                    const bubbleW = bubbleWidthFor(winW);
                    const fontPx = (s?.size ?? 16) as number;
                    const normalized = (s?.text || "")
                      .replace(/\u200B/g, "")
                      .replace(/[\r\t]+/g, " ");
                    const displayText = softWrapFit(normalized, fontPx, bubbleW);
                    const safePos = FIX_COVER_TEXT
                      ? clampCoverPos(FIXED_COVER_TEXT_POS, winW, COVER_HEIGHT, bubbleW)
                      : clampCoverPos(s?.pos, winW, COVER_HEIGHT, bubbleW);

                    return (
                      <ImageBackground
                        key={`${uri || "default"}-${idx}`}
                        source={uri ? { uri } : coverDefault}
                        style={{ width: winW, height: COVER_HEIGHT, justifyContent: "flex-end" }}
                        resizeMode="cover"
                      >
                        <View style={styles.coverDim} />
                        <EffectOverlay effect={s?.effect} />

                        {!!displayText && (
                          <View
                            style={[
                              styles.slideBubble,
                              { left: safePos.left, top: safePos.top, width: bubbleWidthFor(winW) },
                            ]}
                          >
                            <Text
                              style={[
                                styles.slideBubbleText,
                                { color: s?.color || "#fff", fontSize: fontPx, lineHeight: Math.round(fontPx * 1.2) },
                                FONT_STYLE_MAP[(s?.font as FontKey) || "default"] || {},
                              ]}
                            >
                              {displayText}
                            </Text>
                          </View>
                        )}
                      </ImageBackground>
                    );
                  }
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.coverLottieBtn}
                onPress={() => setSlidesModal(true)}
                activeOpacity={0.9}
              >
                <View style={[styles.coverLens, { width: LENS_SIZE, height: LENS_SIZE, borderRadius: LENS_SIZE / 2 }]}>
                  <LottieView source={cameraAnim} autoPlay loop style={{ width: 84, height: 84 }} />
                </View>
              </TouchableOpacity>
            </View>

            {/* avatar */}
            <View style={styles.avatarBlock}>
              <Image source={getAvatarSource(profile)} style={styles.bigAvatar} />
              <TouchableOpacity onPress={pickAndUpload} activeOpacity={0.9} style={styles.avatarEditBtn}>
                <LottieView source={cameraAnim} autoPlay loop style={{ width: 84, height: 84 }} />
              </TouchableOpacity>
            </View>

            {/* nombre + acciones */}
            <View style={styles.nameRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.displayName}>
                  {profile?.display_name || profile?.username || "—"}
                </Text>
                {!!profile && <Text style={styles.username}>@{profile.username}</Text>}
              </View>
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickBtn} activeOpacity={0.9}>
                  <Ionicons name="paper-plane-outline" size={24} color="#80CBC4" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  activeOpacity={0.9}
                  onPress={() => setOptionsVisible(true)}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color="#E0E0E0" />
                </TouchableOpacity>
              </View>
            </View>

            {/* chips */}
            <View style={styles.infoRow}>
              <InfoChip icon="mail-outline" label={profile?.email || "-"} />
              <InfoChip icon="male-female-outline" label={String(profile?.gender || "-")} />
              <InfoChip icon="calendar-outline" label={profile?.date_of_birth || "-"} />
            </View>

            {!!(profile?.bio || "").trim() && <Text style={styles.bio}>{profile?.bio}</Text>}
          </View>

          {/* ── Resumen de vistas (encima del carrusel de tabs) ── */}
          <View style={styles.viewsSummaryWrap}>
            <View style={styles.viewsSummaryPill}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewsSummaryText}>{totalViewsLabel}</Text>
            </View>
          </View>

          {/* TAB BAR */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
            <View style={styles.tabsRow}>
              <Tab label="Publicaciones" active={activeTab === "posts"} onPress={() => goToTab("posts")} icon={<Ionicons name="reader-outline" />} />
              <Tab label="Podcast" active={activeTab === "podcast"} onPress={() => goToTab("podcast")} icon={<MaterialCommunityIcons name="microphone" />} />
              {/* Feelings con corazón rojo relleno */}
              <Tab
                label="Feelings"
                active={activeTab === "feelings"}
                onPress={() => goToTab("feelings")}
                icon={<Ionicons name="heart" />} // ícono relleno
                tintColor="#FF1744"
              />
              <Tab label="Tienda" active={activeTab === "shop"} onPress={() => goToTab("shop")} icon={<Ionicons name="cart-outline" />} />
              <Tab label="Imágenes" active={activeTab === "images"} onPress={() => goToTab("images")} icon={<Ionicons name="image-outline" />} />
              <Tab label="Vídeos" active={activeTab === "videos"} onPress={() => goToTab("videos")} icon={<Ionicons name="play-circle-outline" />} />
              <Tab label="Configuraciones" active={activeTab === "settings"} onPress={() => goToTab("settings")} icon={<Ionicons name="settings-outline" />} />
            </View>
          </ScrollView>

          {/* PAGER */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onTabsPagerEnd}
          >
            {/* POSTS */}
            <View style={{ width: winW }}>
              <FlatList
                data={posts}
                keyExtractor={(it) => String((it as PostDTO).id)}
                renderItem={renderGridItem}
                numColumns={2}
                columnWrapperStyle={{ paddingHorizontal: 4 }}
                contentContainerStyle={{ paddingBottom: 12, paddingTop: 6 }}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                removeClippedSubviews
                windowSize={7}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
              />
            </View>

            {/* PODCAST placeholder */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <MaterialCommunityIcons name="microphone" size={48} color="#FF00A8" />
                <Text style={styles.heroTitle}>Tus podcasts</Text>
                <Text style={styles.heroSubtitle}>Próximamente.</Text>
              </View>
            </View>

            {/* FEELINGS placeholder */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <Ionicons name="heart" size={48} color="#FF1744" />
                <Text style={styles.heroTitle}>Tus Feelings</Text>
                <Text style={styles.heroSubtitle}>Próximamente.</Text>
              </View>
            </View>

            {/* SHOP */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <Ionicons name="cart-outline" size={44} color="#D8A657" />
                <Text style={styles.heroTitle}>Tu tienda</Text>
                <Text style={styles.heroSubtitle}>Próximamente.</Text>
              </View>
            </View>

            {/* IMÁGENES */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <Ionicons name="image-outline" size={44} color="#FFCC80" />
                <Text style={styles.heroTitle}>Tus imágenes</Text>
              </View>
            </View>

            {/* VÍDEOS */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <Ionicons name="play-circle-outline" size={44} color="#90CAF9" />
                <Text style={styles.heroTitle}>Tus vídeos</Text>
              </View>
            </View>

            {/* SETTINGS */}
            <View style={{ width: winW }}>
              <View style={styles.hero}>
                <Ionicons name="settings-outline" size={44} color="#B39DDB" />
                <Text style={styles.heroTitle}>Configuraciones</Text>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      {/* Modales */}
      <ProfileOptionsModal
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onLogout={handleLogout}
        bgSource={bgSource}
        blurRadius={BG_BLUR}
      />

      <CoverEditorModal
        visible={slidesModal}
        onClose={() => setSlidesModal(false)}
        profile={profile as any}
        initial={[
          {
            uri: coverSlides[0],
            text: coverSlideTexts[0],
            color: coverSlideColors[0] ?? "#ffffff",
            font: coverSlideFonts[0] ?? "default",
            pos: coverSlidePositions[0] ?? { x: 0.04, y: 0.08 },
            textSize: coverSlideSizes[0] ?? 16,
            effect: (coverSlideEffects[0] ?? "none") as EffectKey,
          },
          {
            uri: coverSlides[1],
            text: coverSlideTexts[1],
            color: coverSlideColors[1] ?? "#ffffff",
            font: coverSlideFonts[1] ?? "default",
            pos: coverSlidePositions[1] ?? { x: 0.04, y: 0.08 },
            textSize: coverSlideSizes[1] ?? 16,
            effect: (coverSlideEffects[1] ?? "none") as EffectKey,
          },
          {
            uri: coverSlides[2],
            text: coverSlideTexts[2],
            color: coverSlideColors[2] ?? "#ffffff",
            font: coverSlideFonts[2] ?? "default",
            pos: coverSlidePositions[2] ?? { x: 0.04, y: 0.08 },
            textSize: coverSlideSizes[2] ?? 16,
            effect: (coverSlideEffects[2] ?? "none") as EffectKey,
          },
        ]}
        onSaved={(payload) => {
          setCoverSlides(payload.slides);
          setCoverSlideTexts(payload.texts);
          setCoverSlideColors(payload.colors);
          setCoverSlideFonts(payload.fonts);
          setCoverSlidePositions(payload.positions);
          setCoverSlideSizes(payload.sizes);
          setCoverSlideEffects(payload.effects);
          setSlidesModal(false);
          setActiveSlide(0);
          setTimeout(() => {
            scrollRef.current?.scrollTo({ x: 0, animated: false });
          }, 0);
        }}
      />
    </ImageBackground>
  );
}

/* ───────────────── styles ───────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0b0b0b" },
  bgTint: { ...StyleSheet.absoluteFillObject },
  bgVignette: { ...StyleSheet.absoluteFillObject },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  coverWrap: { paddingBottom: 12 },
  coverDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

  coverLottieBtn: { position: "absolute", right: 14, bottom: 14 },
  coverLens: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },

  avatarBlock: {
    marginTop: -Math.round(AVATAR_SIZE * 0.36),
    marginLeft: 16,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: "relative",
  },
  bigAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#000",
  },
  avatarEditBtn: { position: "absolute", right: -12, bottom: -2 },

  nameRow: { flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 16 },
  displayName: { color: "#fff", fontWeight: "800", fontSize: 20 },
  username: { color: "#C5E1A5", fontSize: 13, marginTop: 2 },

  quickActions: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: "auto" },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },

  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, paddingHorizontal: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  chipText: { color: "#e0e0e0", fontSize: 12, maxWidth: 160 },
  bio: { color: "#e0e0e0", marginTop: 10, marginHorizontal: 16, fontSize: 14 },

  /* 👁️ Píldora resumen (arriba de tabs) */
  viewsSummaryWrap: { paddingHorizontal: 16, marginTop: 10, alignItems: "flex-start" },
  viewsSummaryPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  viewsSummaryText: { color: "#fff", fontSize: 12, fontWeight: "800", marginLeft: 6 },

  tabsScrollContent: { paddingHorizontal: 12 },
  tabsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabActive: { backgroundColor: "rgba(197,225,165,0.18)", borderColor: "#9ccc9c" },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabLabel: { color: "#e0e0e0", fontSize: 12, fontWeight: "700" },
  tabLabelActive: { color: "#C5E1A5" },

  hero: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: 16 },
  heroTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginTop: 8 },
  heroSubtitle: { color: "#FFFFFFCC", fontSize: 13, textAlign: "center", marginTop: 6 },

  tile: {
    aspectRatio: 0.75,
    margin: 4,
    backgroundColor: "#000",
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  /* 👁️ badge por publicación */
  viewBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  viewBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", marginLeft: 5 },

  tileImg: { width: "100%", height: "100%" },
  tileEmpty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },

  slideBubble: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.77)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  slideBubbleText: { color: "#fff", fontWeight: "700" },
});
