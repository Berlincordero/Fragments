// app/finca.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { endpoints } from "../lib/api";;

import CoverEditorModal, {
  FONT_STYLE_MAP,
  type FontKey,
  type EffectKey,
} from "./components/CoverEditorModal";
import { BubblePos } from "./components/DraggableBubble";
import ProfileOptionsModal from "./components/ProfileOptionsModal";

/* ───────────────── sizes ───────────────── */
const AVATAR_SIZE = 150;
const COVER_HEIGHT = 355;
const LOTTIE_AVATAR_SIZE = 84;
const LOTTIE_COVER_SIZE = 84;
const COVER_LENS_SIZE = 46;
const COVER_LENS_OPACITY = 0.6;
const CAROUSEL_INTERVAL_MS = 5000;
const BG_BLUR = Platform.OS === "android" ? 18 : 60;
const COMPOSER_TOP_GAP = 22;

/* Forzar posición fija del texto en la portada (opcional) */
const FIX_COVER_TEXT = true;
const FIXED_COVER_TEXT_POS = { x: 0.06, y: 0.07 };

/* Tamaño y márgenes seguros para la burbuja de texto en la portada */
const BUBBLE_MAX_RATIO = 0.72;         // 72% del ancho de pantalla
const BUBBLE_MAX_ABS = 320;            // tope duro en px
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

/* ───────────────── colores/íconos de tabs ───────────────── */
const TAB_ICON_SIZE = 14;
const TAB_ICON_SIZE_BIG = 18;

const TAB_COLORS = {
  publicaciones: "#A5D6A7",
  podcast: "#FF00A8",
  pieces: "#00D0C8",
  tienda: "#D8A657",
  imagenes: "#FFCC80",
  videos: "#90CAF9",
  settings: "#B39DDB",
};

/* ───────────────── tipos API ───────────────── */
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
  stars_count?: number;
  comments_count?: number;
  whatsapp_count?: number;
  reposts_count?: number;
  saves_count?: number;
};

type CoverSlideDTO = {
  id: number;
  index: number;
  image: string | null;
  caption?: string | null;
  bibliography?: string | null;
  text_color?: string | null;
  text_font?: FontKey | null;
  text_x?: number | null;
  text_y?: number | null;
  text_size?: number | null;
  effect?: EffectKey | null;
};

/* ─────────────── helpers ─────────────── */
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
    <View style={pStyles.chip}>
      <Ionicons name={icon} size={14} color="#9ccc9c" />
      <Text style={pStyles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* Tab de la barra */
function Tab({
  label,
  icon,
  active,
  tint,
  onPress,
  size,
}: {
  label: string;
  icon?: React.ReactElement;
  active?: boolean;
  tint?: string;
  size?: number;
  onPress?: () => void;
}) {
  const iconColor = active ? (tint || "#C5E1A5") : "#e0e0e0";
  const iconEl = icon
    ? React.cloneElement(icon as any, { color: iconColor, size: size || TAB_ICON_SIZE })
    : null;

  return (
    <TouchableOpacity onPress={onPress} style={[pStyles.tab, active && pStyles.tabActive]}>
      <View style={pStyles.tabInner}>
        {iconEl}
        <Text style={[pStyles.tabLabel, active && pStyles.tabLabelActive]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* Overlay de efectos para la portada */
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
    case "sepia":
      return (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(112,66,20,0.22)" }]}
        />
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
    case "vintage":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(240,220,180,0.12)" }]}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.25)", "transparent"]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: "38%" }}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.32)"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%" }}
          />
        </View>
      );
    case "soft":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(0,0,0,0.08)", "transparent", "rgba(0,0,0,0.08)"]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      );
    default:
      return null;
  }
};

/* Header/hero reutilizable */
function SectionHero({
  icon,
  color,
  title,
  subtitle,
  size = 44,
}: {
  icon: React.ReactElement;
  color: string;
  title: string;
  subtitle?: string;
  size?: number;
}) {
  const iconEl = React.cloneElement(icon, { size, color });
  return (
    <View style={pStyles.hero}>
      {iconEl}
      <Text style={pStyles.heroTitle}>{title}</Text>
      {!!subtitle && <Text style={pStyles.heroSubtitle}>{subtitle}</Text>}
    </View>
  );
}

/* ===== helpers para ancho/pos y soft-wrap del texto ===== */
const bubbleWidthFor = (winW: number) =>
  Math.min(Math.round(winW * BUBBLE_MAX_RATIO), BUBBLE_MAX_ABS);

const softWrap = (t: string, chunk = 10) =>
  t.replace(new RegExp(`(\\S{${chunk}})(?=\\S)`, "g"), "$1\u200B");

const chunkFor = (fontPx: number, maxPx: number) => {
  const avgChar = Math.max(1, fontPx) * 0.55;        // heurística
  return Math.max(1, Math.floor(maxPx / avgChar));
};
const softWrapFit = (t: string, fontPx: number, maxPx: number) =>
  softWrap(t, chunkFor(fontPx, maxPx));

const clampCoverPos = (
  pos: BubblePos | undefined | null,
  winW: number,
  coverH: number,
  bubbleW: number
) => {
  const x = typeof pos?.x === "number" ? pos!.x : 0.04;
  const y = typeof pos?.y === "number" ? pos!.y : 0.08;

  const minXNorm = SAFE_LEFT_PX / Math.max(1, winW);
  const maxXNorm = (winW - SAFE_RIGHT_PX - bubbleW) / Math.max(1, winW);
  const minYNorm = SAFE_TOP_PX / Math.max(1, coverH);
  const maxYNorm = (coverH - SAFE_BOTTOM_PX - 28) / Math.max(1, coverH); // 28 ~ min alto visual

  const cx = Math.max(minXNorm, Math.min(maxXNorm, x));
  const cy = Math.max(minYNorm, Math.min(maxYNorm, y));

  return { left: Math.round(cx * winW), top: Math.round(cy * coverH) };
};

export default function FincaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [activeTab, setActiveTab] =
    useState<"posts" | "podcast" | "pieces" | "shop" | "images" | "videos" | "settings">("posts");

  // cover slides state
  const [coverSlides, setCoverSlides] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideTexts, setCoverSlideTexts] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideColors, setCoverSlideColors] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideFonts, setCoverSlideFonts] = useState<FontKey[]>(["default", "default", "default"]);
  const [coverSlidePositions, setCoverSlidePositions] = useState<(BubblePos | null)[]>([null, null, null]);
  const [coverSlideSizes, setCoverSlideSizes] = useState<(number | null)[]>([null, null, null]);
  const [coverSlideEffects, setCoverSlideEffects] = useState<(EffectKey | null)[]>([null, null, null]);

  const [slidesModal, setSlidesModal] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const winW = Dimensions.get("window").width;
  const scrollRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  /* Orden del carrusel */
  const TAB_ORDER: Array<"posts" | "podcast" | "pieces" | "shop" | "images" | "videos" | "settings"> = [
    "posts", "podcast", "pieces", "shop", "images", "videos", "settings",
  ];
  const tabToIndex = (t: typeof TAB_ORDER[number]) => TAB_ORDER.indexOf(t);
  const indexToTab = (i: number) => TAB_ORDER[Math.max(0, Math.min(TAB_ORDER.length - 1, i))];

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

      const arrImgs: (string | null)[] = [null, null, null];
      const arrTexts: (string | null)[] = [null, null, null];
      const arrColors: (string | null)[] = [null, null, null];
      const arrFonts: FontKey[] = ["default", "default", "default"];
      const arrPos: (BubblePos | null)[] = [null, null, null];
      const arrSizes: (number | null)[] = [null, null, null];
      const arrEffects: (EffectKey | null)[] = [null, null, null];

      results.forEach((r) => {
        if (typeof r.index === "number" && r.index >= 0 && r.index < 3) {
          arrImgs[r.index] = r.image || null;
          arrTexts[r.index] = r.caption ?? null;
          arrColors[r.index] = (r.text_color as string) ?? null;
          arrFonts[r.index] = (r.text_font as FontKey) ?? "default";
          if (typeof r.text_x === "number" && typeof r.text_y === "number") {
            arrPos[r.index] = { x: r.text_x, y: r.text_y };
          }
          arrSizes[r.index] = (typeof r.text_size === "number" ? r.text_size : null) as any;
          arrEffects[r.index] = (r.effect as EffectKey) ?? null;
        }
      });

      setCoverSlides(arrImgs);
      setCoverSlideTexts(arrTexts);
      setCoverSlideColors(arrColors);
      setCoverSlideFonts(arrFonts);
      setCoverSlidePositions(arrPos);
      setCoverSlideSizes(arrSizes);
      setCoverSlideEffects(arrEffects);

      setProfile(p);
      setPosts(Array.isArray(myPosts) ? myPosts : []);
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar tus datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

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

  const pickAndUpload = async (field: "avatar") => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) return;

      const form = new FormData();
      form.append(field, {
        uri: asset.uri,
        name: `${field}.jpg`,
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

  const openSlidesModal = () => setSlidesModal(true);

  const filtered = posts.filter((p) => {
    if (activeTab === "videos") return !!p.video;
    if (activeTab === "images") return !!p.image && !p.video;
    return true;
  });

  if (loading || !profile) {
    return (
      <View style={pStyles.loading}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

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

  const bgUri =
    coverSlides[activeSlide] || coverSlides.find((u) => !!u) || profile.cover || null;
  const bgSource = bgUri ? { uri: bgUri } : coverDefault;

  const onOpenComposer = () => {
    Alert.alert("Composer", "Aquí abrirías la pantalla para crear una publicación.");
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
    } finally {
      router.replace("/");
    }
  };

  return (
    <ImageBackground source={bgSource} style={pStyles.bg} resizeMode="cover" blurRadius={BG_BLUR}>
      {/* tintes y viñeta */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.70)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={pStyles.bgTint}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.40)"]}
        locations={[0, 0.5, 1]}
        style={pStyles.bgVignette}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} scrollEventThrottle={16}>
          {/* cover + avatar */}
          <View style={pStyles.coverWrap}>
            <View style={{ height: COVER_HEIGHT, width: "100%" }}>
              {slidesCount ? (
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMomentumEnd}
                >
                  {slidesData.map((s, idx) => {
                    // ------ ancho fijo y texto envuelto ------
                    const bubbleW = bubbleWidthFor(winW);
                    const fontPx = s.size ?? 16;
                    const normalized = (s.text || "")
                      .replace(/\u200B/g, "")
                      .replace(/[\r\t]+/g, " "); // limpia tabs/retornos raros
                    const displayText = softWrapFit(normalized, fontPx, bubbleW);

                    const safePos = FIX_COVER_TEXT
                      ? clampCoverPos(FIXED_COVER_TEXT_POS, winW, COVER_HEIGHT, bubbleW)
                      : clampCoverPos(s.pos, winW, COVER_HEIGHT, bubbleW);

                    return (
                      <ImageBackground
                        key={`${s.uri}-${idx}`}
                        source={{ uri: s.uri as string }}
                        style={{ width: winW, height: COVER_HEIGHT, justifyContent: "flex-end" }}
                        resizeMode="cover"
                      >
                        <View style={pStyles.coverDim} />
                        <EffectOverlay effect={s.effect} />

                        {!!displayText && (
                          <View
                            style={[
                              pStyles.slideBubble,
                              { left: safePos.left, top: safePos.top, width: bubbleW }, // ← ancho fijo
                            ]}
                          >
                            <Text
                              style={[
                                pStyles.slideBubbleText,
                                { color: s.color || "#fff" },
                                {
                                  fontSize: fontPx,
                                  lineHeight: Math.round(fontPx * 1.2),
                                  maxWidth: "100%",
                                  includeFontPadding: false,
                                  textAlignVertical: "center",
                                },
                                FONT_STYLE_MAP[s.font] || {},
                              ]}
                            >
                              {displayText}
                            </Text>
                          </View>
                        )}
                      </ImageBackground>
                    );
                  })}
                </ScrollView>
              ) : (
                <ImageBackground
                  source={profile.cover ? { uri: profile.cover } : coverDefault}
                  style={[pStyles.cover, { height: COVER_HEIGHT }]}
                  resizeMode="cover"
                >
                  <View style={pStyles.coverDim} />
                </ImageBackground>
              )}

              <TouchableOpacity
                style={pStyles.coverLottieBtn}
                onPress={openSlidesModal}
                activeOpacity={0.9}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View
                  style={[
                    pStyles.coverLens,
                    {
                      width: COVER_LENS_SIZE,
                      height: COVER_LENS_SIZE,
                      borderRadius: COVER_LENS_SIZE / 2,
                    },
                  ]}
                >
                  <LottieView
                    source={cameraAnim}
                    autoPlay
                    loop
                    style={{ width: LOTTIE_COVER_SIZE, height: LOTTIE_COVER_SIZE }}
                  />
                </View>
              </TouchableOpacity>
            </View>

            <View style={pStyles.avatarBlock}>
              <Image source={getAvatarSource(profile)} style={pStyles.bigAvatar} />
              <TouchableOpacity
                onPress={() => pickAndUpload("avatar")}
                activeOpacity={0.9}
                style={pStyles.avatarEditBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <LottieView
                  source={cameraAnim}
                  autoPlay
                  loop
                  style={{
                    width: LOTTIE_AVATAR_SIZE,
                    height: LOTTIE_AVATAR_SIZE,
                    backgroundColor: "transparent",
                  }}
                />
              </TouchableOpacity>
            </View>

            {/* Nombre + acciones rápidas a la derecha */}
            <View style={pStyles.nameRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={pStyles.displayName}>
                  {profile.display_name || profile.username}
                </Text>
                <Text style={pStyles.username}>@{profile.username}</Text>
              </View>
              <View style={pStyles.quickActions}>
                {/* Telegram-like */}
                <TouchableOpacity style={pStyles.quickBtn} activeOpacity={0.9}>
                  <Ionicons name="paper-plane-outline" size={24} color="#80CBC4" />
                </TouchableOpacity>
                {/* Tres puntos */}
                <TouchableOpacity
                  style={pStyles.quickBtn}
                  activeOpacity={0.9}
                  onPress={() => setOptionsVisible(true)}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color="#E0E0E0" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={pStyles.infoRow}>
              <InfoChip icon="mail-outline" label={profile.email || "-"} />
              <InfoChip icon="male-female-outline" label={String(profile.gender || "-")} />
              <InfoChip icon="calendar-outline" label={profile.date_of_birth || "-"} />
            </View>

            {!!(profile.bio || "").trim() && <Text style={pStyles.bio}>{profile.bio}</Text>}
          </View>

          {/* ───────────────── TAB BAR ───────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pStyles.tabsScrollContent}>
            <View style={pStyles.tabsRow}>
              <Tab
                key="posts"
                label="Publicaciones"
                active={activeTab === "posts"}
                tint={TAB_COLORS.publicaciones}
                size={TAB_ICON_SIZE}
                onPress={() => goToTab("posts")}
                icon={<Ionicons name="reader-outline" />}
              />
              <Tab
                key="podcast"
                label="Podcast"
                active={activeTab === "podcast"}
                tint={TAB_COLORS.podcast}
                size={TAB_ICON_SIZE_BIG}
                onPress={() => goToTab("podcast")}
                icon={<MaterialCommunityIcons name="microphone" />}
              />
              <Tab
                key="pieces"
                label="Pieces"
                active={activeTab === "pieces"}
                tint={TAB_COLORS.pieces}
                size={TAB_ICON_SIZE_BIG}
                onPress={() => goToTab("pieces")}
                icon={<MaterialCommunityIcons name="puzzle" />}
              />
              <Tab
                key="shop"
                label="Tienda"
                active={activeTab === "shop"}
                tint={TAB_COLORS.tienda}
                onPress={() => goToTab("shop")}
                icon={<Ionicons name="cart-outline" />}
              />
              <Tab
                key="images"
                label="Imágenes"
                active={activeTab === "images"}
                tint={TAB_COLORS.imagenes}
                onPress={() => goToTab("images")}
                icon={<Ionicons name="image-outline" />}
              />
              <Tab
                key="videos"
                label="Vídeos"
                active={activeTab === "videos"}
                tint={TAB_COLORS.videos}
                onPress={() => goToTab("videos")}
                icon={<Ionicons name="play-circle-outline" />}
              />
              <Tab
                key="settings"
                label="Configuraciones"
                active={activeTab === "settings"}
                tint={TAB_COLORS.settings}
                onPress={() => goToTab("settings")}
                icon={<Ionicons name="settings-outline" />}
              />
            </View>
          </ScrollView>

          {/* ───────────────── CARRUSEL DE CONTENIDO ───────────────── */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onTabsPagerEnd}
          >
            {/* 0) PUBLICACIONES */}
            <View style={{ width: winW }}>
              <View
                style={[
                  pStyles.composer,
                  {
                    marginTop: COMPOSER_TOP_GAP,
                    marginBottom: 14,
                    borderColor: TAB_COLORS.publicaciones,
                  },
                ]}
              >
                <TouchableOpacity onPress={onOpenComposer} style={pStyles.composerTouch}>
                  <Ionicons name="create-outline" size={18} color="#C5E1A5" />
                  <Text style={pStyles.composerPlaceholder}>¿Qué estás pensando?</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginLeft: "auto" }}>
                    <Ionicons name="image-outline" size={18} color={TAB_COLORS.imagenes} />
                    <Ionicons name="videocam-outline" size={18} color={TAB_COLORS.videos} />
                  </View>
                </TouchableOpacity>
              </View>

              <SectionHero
                icon={<Ionicons name="reader-outline" />}
                color={TAB_COLORS.publicaciones}
                title="Tus publicaciones"
                subtitle={
                  posts.length
                    ? `Tienes ${posts.length} publicación${posts.length === 1 ? "" : "es"}`
                    : "No hay publicaciones todavía. Próximamente podrás crear contenido aquí."
                }
              />
            </View>

            {/* 1) PODCAST */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<MaterialCommunityIcons name="microphone" />}
                color={TAB_COLORS.podcast}
                title="Tus podcasts"
                subtitle="No hay podcasts todavía. Próximamente podrás subir episodios aquí."
                size={48}
              />
            </View>

            {/* 2) PIECES */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<MaterialCommunityIcons name="puzzle" />}
                color={TAB_COLORS.pieces}
                title="Tus Pieces"
                subtitle="Crea y comparte composiciones pronto."
                size={48}
              />
            </View>

            {/* 3) TIENDA */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<Ionicons name="cart-outline" />}
                color={TAB_COLORS.tienda}
                title="Tu tienda"
                subtitle="Muy pronto podrás gestionar productos aquí."
              />
            </View>

            {/* 4) IMÁGENES */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<Ionicons name="image-outline" />}
                color={TAB_COLORS.imagenes}
                title="Tus imágenes"
                subtitle={
                  posts.filter((p) => !!p.image && !p.video).length
                    ? undefined
                    : "No hay imágenes todavía."
                }
              />
              <View style={pStyles.grid}>
                {posts.filter((p) => !!p.image && !p.video).length ? (
                  posts
                    .filter((p) => !!p.image && !p.video)
                    .map((p) => (
                      <View key={p.id} style={[pStyles.tile, { width: (winW - 4) / 3 }]}>
                        <Image source={{ uri: p.image! }} style={pStyles.tileImg} />
                      </View>
                    ))
                ) : null}
              </View>
            </View>

            {/* 5) VÍDEOS */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<Ionicons name="play-circle-outline" />}
                color={TAB_COLORS.videos}
                title="Tus vídeos"
                subtitle={
                  posts.filter((p) => !!p.video).length ? undefined : "No hay vídeos todavía."
                }
              />
              <View style={pStyles.grid}>
                {posts.filter((p) => !!p.video).length ? (
                  posts
                    .filter((p) => !!p.video)
                    .map((p) => (
                      <View key={p.id} style={[pStyles.tile, { width: (winW - 4) / 3 }]}>
                        <View style={pStyles.tileVideo}>
                          <Ionicons name="play" size={22} color="#fff" />
                        </View>
                      </View>
                    ))
                ) : null}
              </View>
            </View>

            {/* 6) CONFIGURACIONES */}
            <View style={{ width: winW }}>
              <SectionHero
                icon={<Ionicons name="settings-outline" />}
                color={TAB_COLORS.settings}
                title="Configuraciones"
                subtitle="Ajustes de cuenta y preferencias muy pronto."
              />
            </View>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      {/* Modal de opciones del perfil (separado) */}
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
        profile={profile}
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
const pStyles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0b0b0b" },
  bgTint: { ...StyleSheet.absoluteFillObject },
  bgVignette: { ...StyleSheet.absoluteFillObject },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  coverWrap: { paddingBottom: 12 },

  cover: { width: "100%", justifyContent: "flex-end" },
  coverDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

  coverLottieBtn: { position: "absolute", right: 14, bottom: 14 },
  coverLens: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `rgba(0,0,0,${COVER_LENS_OPACITY})`,
    borderWidth: Platform.OS === "ios" ? 0.2 : StyleSheet.hairlineWidth,
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

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 16,
  },

  displayName: { color: "#fff", fontWeight: "800", fontSize: 20 },
  username: { color: "#C5E1A5", fontSize: 13, marginTop: 2 },

  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: "auto",
  },
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

  tabsScrollContent: { paddingHorizontal: 12 },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
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

  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 8,
  },
  heroSubtitle: {
    color: "#FFFFFFCC",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: 2 },
  tile: { aspectRatio: 1, margin: 1, backgroundColor: "#000", overflow: "hidden", borderRadius: 6 },
  tileImg: { width: "100%", height: "100%" },
  tileVideo: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)" },

  empty: { color: "#FFFFFF99", fontSize: 14, textAlign: "center", width: "100%", marginTop: 14 },

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

  composer: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  composerTouch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composerPlaceholder: { color: "#E0E0E0", opacity: 0.9, fontSize: 14, flexShrink: 1 },
});
