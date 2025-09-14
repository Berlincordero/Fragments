// app/finca.tsx
import React, { useEffect, useRef, useState } from "react";
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
import { endpoints } from "./api";

import CoverEditorModal, { FONT_STYLE_MAP, FontKey } from "./components/CoverEditorModal";
import { BubblePos } from "./components/DraggableBubble";
import JigsawOutline from "./components/JigsawOutline";
import JigsawMosaic, { MosaicMedia } from "./components/JigsawMosaic";

/* sizes */
const AVATAR_SIZE = 150;
const COVER_HEIGHT = 355;
const LOTTIE_AVATAR_SIZE = 84;
const LOTTIE_COVER_SIZE = 84;
const COVER_LENS_SIZE = 46;
const COVER_LENS_OPACITY = 0.6;
const CAROUSEL_INTERVAL_MS = 5000;
const BG_BLUR = Platform.OS === "android" ? 18 : 60;

/* assets */
const coverDefault = require("../assets/images/portada.jpg");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const cameraAnim = require("../assets/lottie/camera.json");

/* api types */
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
  caption?: string;
  bibliography?: string;
  text_color?: string;
  text_font?: FontKey;
  text_x?: number;
  text_y?: number;
};

/* helpers */
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

function Tab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: React.ReactElement; // permite cualquier set de íconos
  active?: boolean;
  onPress?: () => void;
}) {
  const iconColor = active ? "#C5E1A5" : "#e0e0e0";
  const iconEl = icon ? React.cloneElement(icon as any, { color: iconColor, size: 14 }) : null;

  return (
    <TouchableOpacity onPress={onPress} style={[pStyles.tab, active && pStyles.tabActive]}>
      <View style={pStyles.tabInner}>
        {iconEl}
        <Text style={[pStyles.tabLabel, active && pStyles.tabLabelActive]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function FincaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [activeTab, setActiveTab] =
    useState<"posts" | "videos" | "images" | "shop" | "pieces">("posts");

  const [coverSlides, setCoverSlides] = useState<(string | null)[]>([null, null, null]);
  const [coverSlideTexts, setCoverSlideTexts] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const [coverSlideColors, setCoverSlideColors] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const [coverSlideFonts, setCoverSlideFonts] = useState<FontKey[]>([
    "default",
    "default",
    "default",
  ]);
  const [coverSlidePositions, setCoverSlidePositions] = useState<(BubblePos | null)[]>(
    [null, null, null]
  );
  const [slidesModal, setSlidesModal] = useState(false);

  // medios locales para “maquetar”
  const [localMedia, setLocalMedia] = useState<MosaicMedia[]>([]);

  const winW = Dimensions.get("window").width;
  const scrollRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);

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
      const results: CoverSlideDTO[] = Array.isArray(slidesJson?.results)
        ? slidesJson.results
        : [];

      const arrImgs: (string | null)[] = [null, null, null];
      const arrTexts: (string | null)[] = [null, null, null];
      const arrColors: (string | null)[] = [null, null, null];
      const arrFonts: FontKey[] = ["default", "default", "default"];
      const arrPos: (BubblePos | null)[] = [null, null, null];

      results.forEach((r) => {
        if (typeof r.index === "number" && r.index >= 0 && r.index < 3) {
          arrImgs[r.index] = r.image || null;
          arrTexts[r.index] = r.caption ?? null;
        }
      });

      setCoverSlides(arrImgs);
      setCoverSlideTexts(arrTexts);
      setCoverSlideColors(arrColors);
      setCoverSlideFonts(arrFonts);
      setCoverSlidePositions(arrPos);

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

  const slidesData = coverSlides
    .map((uri, i) => ({
      index: i,
      uri,
      text: coverSlideTexts[i],
      color: coverSlideColors[i] ?? "#ffffff",
      font: coverSlideFonts[i] ?? "default",
    }))
    .filter((s) => !!s.uri) as {
    index: number;
    uri: string;
    text: string | null;
    color: string;
    font: FontKey;
  }[];

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
    return true; // posts, shop (no usa filtered) y pieces
  });

  // helpers para mosaico
  const postsToMedia = (arr: PostDTO[]): MosaicMedia[] =>
    (arr || [])
      .map((p) =>
        p.video
          ? { uri: p.video, type: "video" as const }
          : p.image
          ? { uri: p.image, type: "image" as const }
          : null
      )
      .filter(Boolean) as MosaicMedia[];

  const mosaicMedia: MosaicMedia[] =
    localMedia.length ? localMedia : postsToMedia(filtered);

  const addLocalMedia = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsMultipleSelection: true, // cuando la plataforma lo permita
        selectionLimit: 24,
      });
      if (res.canceled) return;

      const picked: MosaicMedia[] = res.assets.map((a) => ({
        uri: a.uri,
        type: (a.type?.startsWith("video") ? "video" : "image") as MosaicMedia["type"],
      }));

      setLocalMedia((prev) => [...prev, ...picked]);
    } catch (e) {
      Alert.alert("Error", "No se pudo abrir la galería.");
    }
  };

  const clearLocalMedia = () => setLocalMedia([]);

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

  const bgUri =
    coverSlides[activeSlide] ||
    coverSlides.find((u) => !!u) ||
    profile.cover ||
    null;
  const bgSource = bgUri ? { uri: bgUri } : coverDefault;

  return (
    <ImageBackground source={bgSource} style={pStyles.bg} resizeMode="cover" blurRadius={BG_BLUR}>
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
                  {slidesData.map((s, idx) => (
                    <ImageBackground
                      key={`${s.uri}-${idx}`}
                      source={{ uri: s.uri as string }}
                      style={{ width: winW, height: COVER_HEIGHT, justifyContent: "flex-end" }}
                      resizeMode="cover"
                    >
                      <View style={pStyles.coverDim} />
                      {!!s.text && (
                        <View
                          style={[
                            pStyles.slideBubble,
                            {
                              left:
                                Math.max(0, Math.min(1, coverSlidePositions[s.index]?.x ?? 0.04)) *
                                winW,
                              top:
                                Math.max(0, Math.min(1, coverSlidePositions[s.index]?.y ?? 0.08)) *
                                COVER_HEIGHT,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              pStyles.slideBubbleText,
                              { color: s.color || "#fff" },
                              { fontSize: 16 },
                              FONT_STYLE_MAP[s.font] || {},
                            ]}
                          >
                            {s.text}
                          </Text>
                        </View>
                      )}
                    </ImageBackground>
                  ))}
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

            <Text style={pStyles.displayName}>
              {profile.display_name || profile.username}
            </Text>
            <Text style={pStyles.username}>@{profile.username}</Text>

            <View style={pStyles.infoRow}>
              <InfoChip icon="mail-outline" label={profile.email || "-"} />
              <InfoChip icon="male-female-outline" label={String(profile.gender || "-")} />
              <InfoChip icon="calendar-outline" label={profile.date_of_birth || "-"} />
            </View>

            {!!(profile.bio || "").trim() && <Text style={pStyles.bio}>{profile.bio}</Text>}
          </View>

          {/* tabs */}
          <View style={pStyles.tabsRow}>
            <Tab
              key="posts"
              active={activeTab === "posts"}
              onPress={() => setActiveTab("posts")}
              label="Publicaciones"
            />
            <Tab
              key="videos"
              active={activeTab === "videos"}
              onPress={() => setActiveTab("videos")}
              label="Vídeos"
            />
            <Tab
              key="images"
              active={activeTab === "images"}
              onPress={() => setActiveTab("images")}
              label="Imágenes"
            />
            <Tab
              key="pieces"
              icon={<MaterialCommunityIcons name="puzzle-outline" />}
              active={activeTab === "pieces"}
              onPress={() => setActiveTab("pieces")}
              label="Pieces"
            />
            <Tab
              key="shop"
              active={activeTab === "shop"}
              onPress={() => router.replace("/marketplace")}
              label="Tienda"
            />
          </View>

          {/* acciones de maquetación */}
          <View style={pStyles.actionsRow}>
            <TouchableOpacity onPress={addLocalMedia} style={pStyles.actionBtn}>
              <Ionicons name="images-outline" size={16} color="#C5E1A5" />
              <Text style={pStyles.actionLabel}>Agregar medios</Text>
            </TouchableOpacity>
            {!!localMedia.length && (
              <TouchableOpacity onPress={clearLocalMedia} style={pStyles.actionBtnSecondary}>
                <Ionicons name="trash-outline" size={16} color="#FFCDD2" />
                <Text style={pStyles.actionLabelDanger}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* MOSAICO + CONTORNO (degradado suave) */}
          <View style={{ paddingHorizontal: 12, marginTop: 12 }}>
            <View style={{ position: "relative" }}>
              <JigsawMosaic
                rows={4}
                columns={4}
                aspectRatio={1}
                borderRadius={16}
                media={mosaicMedia}
              />

              {/* 🔻 SECCIÓN SEÑALADA: CONTORNO DEGRADADO */}
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <JigsawOutline
                  rows={4}
                  columns={4}
                  aspectRatio={1}
                  borderRadius={16}
                  strokeWidth={2.2}
                  useGradient
                  gradientColors={["#00f798ff", "#02fdd3ff", "#9B5DE5"]}
                  gradientAngle={35}
                  neon
                  glowSpread={3}
                  glowOpacityOuter={0.12}
                  glowOpacityInner={0.28}
                  knobRatio={0.20}
                  neckRatio={0.28}
                />
              </View>
              {/* ▲ FIN SECCIÓN */}
            </View>
          </View>

          {/* (Opcional) grid clásico */}
          <View style={pStyles.grid}>
            {filtered.length ? (
              filtered.map((p) => (
                <View key={p.id} style={[pStyles.tile, { width: (winW - 4) / 3 }]}>
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={pStyles.tileImg} />
                  ) : (
                    <View style={pStyles.tileVideo}>
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={pStyles.empty}>No hay contenido en esta pestaña</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

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
          },
          {
            uri: coverSlides[1],
            text: coverSlideTexts[1],
            color: coverSlideColors[1] ?? "#ffffff",
            font: coverSlideFonts[1] ?? "default",
            pos: coverSlidePositions[1] ?? { x: 0.04, y: 0.08 },
          },
          {
            uri: coverSlides[2],
            text: coverSlideTexts[2],
            color: coverSlideColors[2] ?? "#ffffff",
            font: coverSlideFonts[2] ?? "default",
            pos: coverSlidePositions[2] ?? { x: 0.04, y: 0.08 },
          },
        ]}
        onSaved={(payload) => {
          setCoverSlides(payload.slides);
          setCoverSlideTexts(payload.texts);
          setCoverSlideColors(payload.colors);
          setCoverSlideFonts(payload.fonts);
          setCoverSlidePositions(payload.positions);
          setSlidesModal(false);
          setActiveSlide(0);
          setTimeout(() => {
            scrollRef.current!.scrollTo({ x: 0, animated: false });
          }, 0);
        }}
      />
    </ImageBackground>
  );
}

/* styles */
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

  displayName: { color: "#fff", fontWeight: "800", fontSize: 20, marginTop: 6, marginLeft: 16 },
  username: { color: "#C5E1A5", fontSize: 13, marginLeft: 16, marginTop: 2 },

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

  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 16,
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

  // acciones
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(197,225,165,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#9ccc9c",
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  actionLabel: { color: "#C5E1A5", fontWeight: "700", fontSize: 12 },
  actionLabelDanger: { color: "#FFCDD2", fontWeight: "700", fontSize: 12 },

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
  slideBubbleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
