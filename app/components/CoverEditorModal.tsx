// app/components/CoverEditorModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Image, ImageBackground, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Modal, ActivityIndicator, LayoutChangeEvent,
  Platform, TextStyle, Dimensions, FlatList,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImageManipulator from "expo-image-manipulator";
import { endpoints } from "../../lib/api";  // 👈 dos niveles hacia arriba
import DraggableBubble, { type BubblePos } from "./DraggableBubble";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/* safe areas */
const TAP_GUARD_TOP = 84;
const TAP_GUARD_BOTTOM = 110;

/* sizes */
const AVATAR_SIZE_DEFAULT = 110;
const ICON_SIZE_HEADER = 30;
const ICON_SIZE_TOPBTN = 24;
const ICON_SIZE_FAB = 24;
const ICON_SIZE_EMPTY = 44;
const BTN_AA_SIZE = 18;

/* bubble defaults */
const DEFAULT_BUBBLE_POS = { x: 0.06, y: 0.24 };
const DEFAULT_TEXT_SIZE = 20;
const MIN_TEXT_SIZE = 12;
const MAX_TEXT_SIZE = 42;

/* bottom bar height */
const INLINE_BAR_HEIGHT = 120;

/* extra guard for top buttons inside slides */
const UI_GUARD_TOP_EXTRA = 72;

/* palette helpers */
const hslToHex = (h: number, s: number, l: number) => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
const COLOR_PALETTE_60 = Array.from({ length: 60 }, (_, i) =>
  hslToHex((i * 137.508) % 360, 95, 55)
);
const VIVID_COLORS = ["#FFFFFF", "#000000", ...COLOR_PALETTE_60] as const;

/* fonts */
export type FontKey = string;
const fam = (ios?: string, android?: string) => Platform.select({ ios, android }) ?? undefined;
type FontDef = { key: FontKey; style: TextStyle };

const make = (
  baseKey: string, familyIOS: string | undefined, familyAndroid: string | undefined,
  weights: Array<"300"|"400"|"500"|"700"|"900">, italics: boolean[], extras?: Array<TextStyle>
): FontDef[] => {
  const arr: FontDef[] = [];
  weights.forEach((w)=>
    italics.forEach((it)=>
      arr.push({ key:`${baseKey}-${w}${it?"i":""}`, style:{ fontFamily:fam(familyIOS, familyAndroid), fontWeight:w as any, fontStyle: it?"italic":"normal" } })
    )
  );
  (extras||[]).forEach((st, idx)=>arr.push({ key:`${baseKey}-x${idx+1}`, style:{ fontFamily:fam(familyIOS, familyAndroid), ...st } }));
  return arr;
};

const PACK: FontDef[] = [
  ...make("sans","Helvetica","sans-serif",["300","400","500","700","900"],[false,true],[{letterSpacing:1},{letterSpacing:2},{letterSpacing:-0.5}]),
  ...make("serif","Times New Roman","serif",["300","400","500","700","900"],[false,true]),
  ...make("mono","Menlo","monospace",["400","700"],[false,true],[{letterSpacing:1},{letterSpacing:-0.5}]),
  ...make("condensed","HelveticaNeue","sans-serif-condensed",["400","700"],[false,true],[{letterSpacing:-1}]),
  ...make("casual","Marker Felt","casual",["400","700"],[false]),
  ...make("cursive","Snell Roundhand","cursive",["400","700"],[false]),
];
export const FONT_STYLE_MAP: Record<FontKey, TextStyle> =
  Object.fromEntries(PACK.map((f)=>[f.key, f.style]));
export const FONT_KEYS: FontKey[] = Object.keys(FONT_STYLE_MAP);

/* backend types */
export type ProfileDTO = {
  id: number; username: string; email: string | null;
  display_name: string; bio: string;
  date_of_birth: string | null; gender: string | null;
  avatar: string | null; cover: string | null;
};
export type CoverSlideDTO = {
  id: number; index: number; image: string | null; caption?: string; bibliography?: string; updated_at?: string;
};
export type EffectKey = "none" | "warm" | "cool" | "sepia" | "contrast" | "vintage" | "soft";

export type SlideDraft = {
  uri: string | null;
  file?: { uri: string; name?: string; type?: string } | null;
  text?: string | null;
  color?: string | null;
  font?: FontKey;
  pos?: BubblePos | null;
  textSize?: number | null;
  cleared?: boolean;
  effect?: EffectKey;
  quality?: QualityPreset;
};

/* effects overlay */
const EffectOverlay = ({ effect }: { effect: EffectKey }) => {
  switch (effect) {
    case "warm":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(255,170,0,0.28)", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        </View>
      );
    case "cool":
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["rgba(0,140,255,0.28)", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          />
        </View>
      );
    case "sepia":
      return <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(112,66,20,0.22)" }]} />;
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
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(240,220,180,0.12)" }]} />
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
      return <BlurView pointerEvents="none" intensity={16} tint="dark" style={StyleSheet.absoluteFillObject} />;
    default:
      return null;
  }
};

/* quality presets */
type QualityPreset = "original" | "1080p" | "2K" | "4K" | "8K";
const QUALITY_LABELS: QualityPreset[] = ["original", "1080p", "2K", "4K", "8K"];
const QUALITY_WIDTH: Record<QualityPreset, number> = {
  original: 0,
  "1080p": 1920,
  "2K": 2048,
  "4K": 3840,
  "8K": 7680,
};

type Props = {
  visible: boolean;
  onClose: () => void;
  profile: ProfileDTO | null;
  initial: [SlideDraft, SlideDraft, SlideDraft];
  onSaved: (payload: {
    slides: (string | null)[];
    texts: (string | null)[];
    colors: (string | null)[];
    fonts: FontKey[];
    positions: (BubblePos | null)[];
    sizes: (number | null)[];
    effects: (EffectKey | null)[];
    caption?: string;
    bibliography?: string;
  }) => void;
  avatarSize?: number;
};

export default function CoverEditorModal({
  visible, onClose, profile, initial, onSaved, avatarSize = AVATAR_SIZE_DEFAULT
}: Props) {
  const [viewportW, setViewportW] = useState(Dimensions.get("window").width);
  const screen = useMemo(()=>Dimensions.get("window"),[]);
  const [drafts, setDrafts] = useState<[SlideDraft, SlideDraft, SlideDraft]>(initial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slotSize, setSlotSize] = useState<{ w: number; h: number }>({ w: screen.width, h: screen.height });
  const [headerH, setHeaderH] = useState<number>(TAP_GUARD_TOP);

  /* PREVIEW */
  type PreviewMode = "profile" | "tall";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("profile");
  const [previewRotate, setPreviewRotate] = useState(false);

  const [openUI, setOpenUI] = useState<{ idx: number | null; kind: "colors" | "fonts" | "effects" | null }>({ idx: null, kind: null });

  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    if (visible) {
      setDrafts(initial); setSelectedIdx(0); setEditingIdx(null); setDragging(false);
      setOpenUI({ idx: null, kind: null });
      requestAnimationFrame(()=> listRef.current?.scrollToIndex({ index: 0, animated: false }));
    }
  }, [visible, initial]);

  const ensureDefaults = (i: number) => {
    setDrafts((prev) => {
      const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
      cp[i] = {
        ...cp[i],
        text: cp[i].text ?? "",
        color: cp[i].color ?? "#ffffff",
        font: (cp[i].font as FontKey) ?? "sans-400",
        pos: cp[i].pos ?? DEFAULT_BUBBLE_POS,
        textSize: cp[i].textSize ?? DEFAULT_TEXT_SIZE,
        effect: cp[i].effect ?? "none",
        quality: cp[i].quality ?? "original",
      };
      return cp;
    });
  };

  const pickSlide = async (i: number) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (res.canceled) return;
    const a = res.assets[0];
    setDrafts((prev) => {
      const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
      cp[i] = { ...cp[i], uri: a.uri, file: { uri: a.uri, name: `slide${i}.jpg`, type: "image/jpeg" }, cleared: false };
      return cp;
    });
  };

  const clearSlide = (i: number) => {
    setDrafts((prev) => {
      const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
      cp[i] = {
        uri: null, file: null, text: null,
        color: cp[i].color ?? "#ffffff", font: (cp[i].font as FontKey) ?? "sans-400",
        pos: cp[i].pos ?? DEFAULT_BUBBLE_POS, textSize: cp[i].textSize ?? DEFAULT_TEXT_SIZE,
        cleared: true, effect: "none", quality: "original"
      };
      return cp;
    });
    setEditingIdx((cur) => (cur === i ? null : cur));
    setOpenUI((cur)=> cur.idx === i ? { idx: null, kind: null } : cur);
  };

  const onSlideLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSlotSize({ w: width, h: height });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = Math.max(1, viewportW);
    const idx = Math.round(e.nativeEvent.contentOffset.x / w);
    const safe = Math.max(0, Math.min(2, idx));
    if (safe !== selectedIdx) {
      setSelectedIdx(safe);
      setEditingIdx(null);
      setOpenUI({ idx: null, kind: null });
    }
  };

  /* ---- WRAPS ---- */
  const softWrap = (t: string, chunk = 12) =>
    t.replace(new RegExp(`(\\S{${chunk}})(?=\\S)`, "g"), "$1\u200B");

  const chunkFor = (fontPx: number, maxPx: number) => {
    const avgChar = Math.max(1, fontPx) * 0.55;
    return Math.max(1, Math.floor(maxPx / avgChar));
  };
  const softWrapFit = (t: string, fontPx: number, maxPx: number) =>
    softWrap(t, chunkFor(fontPx, maxPx));

  /* upscale on export */
  type QualityPreset = "original" | "1080p" | "2K" | "4K" | "8K";
  const QUALITY_LABELS: QualityPreset[] = ["original", "1080p", "2K", "4K", "8K"];
  const QUALITY_WIDTH: Record<QualityPreset, number> = {
    original: 0,
    "1080p": 1920,
    "2K": 2048,
    "4K": 3840,
    "8K": 7680,
  };

  const upscaleIfNeeded = async (fileUri: string, name: string, preset: QualityPreset) => {
    try {
      const hardCap = Platform.OS === "android" ? 4096 : 6000;
      const targetW = QUALITY_WIDTH[preset];
      if (!targetW || targetW <= 0) return { uri: fileUri, name, type: "image/jpeg" as const };
      const clampedW = Math.min(targetW, hardCap);
      const result = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: clampedW } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { uri: result.uri, name, type: "image/jpeg" as const };
    } catch {
      return { uri: fileUri, name, type: "image/jpeg" as const };
    }
  };

  const saveSlides = async () => {
    try {
      setSaving(true);
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) return;
      const form = new FormData();
      for (let i = 0; i < 3; i++) {
        const d = drafts[i];
        const baseUri = d.file?.uri ?? d.uri ?? null;
        if (baseUri) {
          const preset = d.quality ?? "original";
          const up = await upscaleIfNeeded(baseUri, `slide${i}.jpg`, preset);
          form.append(`slide${i}`, up as any);
        } else if (d.cleared) {
          form.append(`slide${i}_clear`, "1");
        }
        form.append(`slide${i}_caption`, (d.text || "").replace(/\u200B/g, ""));
        if (d.pos) {
          form.append(`slide${i}_text_x`, String(d.pos.x));
          form.append(`slide${i}_text_y`, String(d.pos.y));
        }
        if (d.color) form.append(`slide${i}_color`, d.color);
        if (d.font)  form.append(`slide${i}_font`, d.font);
        if (d.textSize != null) form.append(`slide${i}_text_size`, String(d.textSize));
        if (d.effect) form.append(`slide${i}_effect`, d.effect);
      }

      const res = await fetch(endpoints.fincaCoverSlides(), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
        body: form,
      });
      const j = await res.json();

      const results: CoverSlideDTO[] = Array.isArray(j?.results) ? j.results : [];
      const arrImgs: (string | null)[] = [null, null, null];
      results.forEach((r) => {
        if (typeof r.index === "number" && r.index >= 0 && r.index < 3) {
          arrImgs[r.index] = r.image || null;
        }
      });

      onSaved({
        slides: arrImgs,
        texts: drafts.map((d) => (d.text ?? null)?.replace(/\u200B/g, "") || null),
        colors: drafts.map((d) => d.color ?? "#ffffff"),
        fonts: drafts.map((d) => (d.font as any) ?? "sans-400"),
        positions: drafts.map((d) => d.pos ?? DEFAULT_BUBBLE_POS),
        sizes: drafts.map((d) => d.textSize ?? DEFAULT_TEXT_SIZE),
        effects: drafts.map((d) => (d.effect ?? "none") as EffectKey),
        caption: String(j?.caption || ""),
        bibliography: String(j?.bibliography || ""),
      });
    } finally {
      setSaving(false);
    }
  };

  const data = useMemo(()=>[0,1,2],[]);
  const navEnabled = editingIdx === null && openUI.idx === null && !dragging;

  // ancho máximo visible de la burbuja (similar a la captura)
  const bubbleWidthFor = (containerW: number) => Math.min(Math.round(containerW * 0.72), 320);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={s.modalSafe}>
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <LinearGradient colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0.35)", "transparent"]} style={s.gradTop} />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.85)"]} style={s.gradBottom} />
          </View>

          {/* header + avatar */}
          <View style={s.topChrome}>
            <View style={s.headerRow} onLayout={(e)=> setHeaderH(e.nativeEvent.layout.height)}>
              <TouchableOpacity onPress={onClose} style={s.headerIcon}>
                <Ionicons name="close" size={ICON_SIZE_HEADER} color="#fff" />
              </TouchableOpacity>

              <Text style={s.headerTitle}>Editar portada</Text>

              <TouchableOpacity onPress={saveSlides} disabled={saving} style={[s.publishBtn, saving && s.publishBtnDisabled]}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.publishText}>GUARDAR</Text>}
              </TouchableOpacity>
            </View>

            {/* avatar fantasma */}
            <View
              pointerEvents="none"
              style={[
                s.headerAvatarOverlay,
                { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: "hidden" },
              ]}
            >
              <Image
                source={
                  profile?.avatar
                    ? { uri: profile.avatar }
                    : require("../../assets/images/avatar.png")
                }
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* viewport del carrusel */}
          <View style={{ flex: 1 }} onLayout={(e)=> setViewportW(e.nativeEvent.layout.width)}>
            <FlatList
              key={`vw-${viewportW}`}
              ref={listRef}
              data={data}
              keyExtractor={(i)=>String(i)}
              horizontal
              pagingEnabled
              snapToInterval={viewportW}
              decelerationRate="fast"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              scrollEnabled={navEnabled}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({ length: viewportW, offset: viewportW * index, index })}
              renderItem={({ item: i }) => {
                const d = drafts[i];
                const has = !!d.uri;
                const rawStored = d.text ?? "";
                const fontPxSlide = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, d.textSize ?? DEFAULT_TEXT_SIZE));

                // ancho real que usaremos para el clamp
                const BUBBLE_MAX_W = bubbleWidthFor(slotSize.w);
                const SAFE_M = 10; // margen visual derecha

                // rangos X seguros teniendo en cuenta avatar y ANCHO de la burbuja
                let minXNorm = (6 + AVATAR_SIZE_DEFAULT + 12) / Math.max(1, slotSize.w);
                let maxXNorm = (slotSize.w - SAFE_M - BUBBLE_MAX_W) / Math.max(1, slotSize.w);
                minXNorm = Math.max(0, Math.min(0.92, minXNorm));
                maxXNorm = Math.max(minXNorm, Math.min(0.98, maxXNorm)); // nunca menor que min

                // Y seguro por header + avatar
                const headerPx = Math.max(headerH, TAP_GUARD_TOP);
                const avatarPx = 6 + AVATAR_SIZE_DEFAULT;
                const minYNorm = Math.min(0.86, (Math.max(headerPx, avatarPx) + 12) / Math.max(1, slotSize.h));
                const maxYNorm = 0.96;

                // Texto que se muestra (con ZWSP para palabras largas)
                const displayText = (editingIdx === i)
                  ? rawStored
                  : softWrapFit(rawStored, fontPxSlide, BUBBLE_MAX_W);

                // Posición inicial: si está fuera, centramos
                const basePos = d.pos ?? DEFAULT_BUBBLE_POS;
                const centerX = (slotSize.w - BUBBLE_MAX_W) / 2 / Math.max(1, slotSize.w);
                const needsCenter = basePos.x < minXNorm || basePos.x > maxXNorm;
                const initialPos = {
                  x: needsCenter ? Math.max(minXNorm, Math.min(maxXNorm, centerX)) : Math.max(minXNorm, Math.min(maxXNorm, basePos.x)),
                  y: Math.max(minYNorm, Math.min(maxYNorm, basePos.y)),
                };

                return (
                  <View style={[s.storySlide, { width: viewportW }]} onLayout={onSlideLayout}>
                    {has ? (
                      <ImageBackground source={{ uri: d.uri! }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
                        <EffectOverlay effect={d.effect ?? "none"} />

                        {(editingIdx === i || !!rawStored?.length) && (
                          <DraggableBubble
                            text={displayText}
                            color={d.color ?? "#fff"}
                            textStyle={[
                              {
                                maxWidth: BUBBLE_MAX_W,           // <-- controla el ancho
                                fontSize: fontPxSlide,
                                lineHeight: Math.round(fontPxSlide * 1.2),
                                includeFontPadding: false,
                              },
                              (d.font && FONT_STYLE_MAP[d.font]) || {},
                            ]}
                            containerSize={slotSize}
                            initial={initialPos}
                            onChange={(pos) => setDrafts((prev) => {
                              // clamp usando los límites seguros
                              const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                              const clamped = {
                                x: Math.max(minXNorm, Math.min(maxXNorm, pos.x)),
                                y: Math.max(minYNorm, Math.min(maxYNorm, pos.y)),
                              };
                              cp[i] = { ...cp[i], pos: clamped }; return cp;
                            })}
                            editing={editingIdx === i}
                            onTextChange={(t) => setDrafts((prev) => {
                              // evita “enter fantasma” al pulsar tab/espacio en algunos teclados
                              const normalized = t.replace(/[\r\n\t]+/g, " ");
                              const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                              cp[i] = { ...cp[i], text: normalized }; return cp;
                            })}
                            onDragStateChange={(state)=>{ setDragging(state); if (state) setOpenUI({idx:null, kind:null}); }}
                          />
                        )}

                        {/* top buttons */}
                        <View style={s.slideTopButtons}>
                          <TouchableOpacity onPress={() => clearSlide(i)} style={s.roundBtn} hitSlop={hsl}>
                            <Ionicons name="trash" size={ICON_SIZE_TOPBTN} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedIdx(i);
                              ensureDefaults(i);
                              setOpenUI({ idx: null, kind: null });
                              setEditingIdx((cur) => (cur === i ? null : i));
                            }}
                            style={[s.roundBtn, editingIdx === i && { backgroundColor: "rgba(0,0,0,0.85)" }]}
                            hitSlop={hsl}
                          >
                            <Text style={s.btnAa}>Aa</Text>
                          </TouchableOpacity>

                          {/* PREVIEW (abre en modo Perfil) */}
                          <TouchableOpacity
                            onPress={() => { setSelectedIdx(i); setPreviewMode("profile"); setPreviewOpen(true); }}
                            style={s.roundBtn}
                            hitSlop={hsl}
                          >
                            <Ionicons name="crop" size={ICON_SIZE_TOPBTN} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        {/* toggles */}
                        <View style={[s.bottomToggles, (openUI.idx === i) && { bottom: INLINE_BAR_HEIGHT }]}>
                          <TouchableOpacity
                            style={[s.fabBtn, (openUI.idx === i && openUI.kind === "colors") && s.fabBtnActive]}
                            onPress={() => {
                              setSelectedIdx(i); ensureDefaults(i);
                              setEditingIdx(null);
                              setOpenUI(cur => (cur.idx === i && cur.kind === "colors") ? { idx: null, kind: null } : { idx: i, kind: "colors" });
                            }}
                            hitSlop={hsl}
                          >
                            <Ionicons name="color-palette" size={ICON_SIZE_FAB} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.fabBtn, (openUI.idx === i && openUI.kind === "fonts") && s.fabBtnActive]}
                            onPress={() => {
                              setSelectedIdx(i); ensureDefaults(i);
                              setEditingIdx(null);
                              setOpenUI(cur => (cur.idx === i && cur.kind === "fonts") ? { idx: null, kind: null } : { idx: i, kind: "fonts" });
                            }}
                            hitSlop={hsl}
                          >
                            <Text style={s.btnAa}>Aa</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.fabBtn, (openUI.idx === i && openUI.kind === "effects") && s.fabBtnActive]}
                            onPress={() => {
                              setSelectedIdx(i); ensureDefaults(i);
                              setEditingIdx(null);
                              setOpenUI(cur => (cur.idx === i && cur.kind === "effects") ? { idx: null, kind: null } : { idx: i, kind: "effects" });
                            }}
                            hitSlop={hsl}
                          >
                            <Ionicons name="color-wand" size={ICON_SIZE_FAB} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        {(openUI.idx === i) && (
                          <View style={s.inlineBar} pointerEvents="box-none">
                            {openUI.kind === "colors" && (
                              <View>
                                <Text style={s.inlineLabel}>Color del texto</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carouselRow} nestedScrollEnabled overScrollMode="never">
                                  {VIVID_COLORS.map((c) => {
                                    const sel = (drafts[i].color ?? "#ffffff") === c;
                                    return (
                                      <TouchableOpacity
                                        key={String(c)}
                                        style={[s.swatch, { backgroundColor: c as string }, sel && s.swatchSelected]}
                                        onPress={() => setDrafts((prev) => {
                                          const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                          cp[i] = { ...cp[i], color: c as any }; return cp;
                                        })}
                                      />
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            )}

                            {openUI.kind === "fonts" && (
                              <View>
                                <Text style={s.inlineLabel}>Tipografía</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carouselRow} nestedScrollEnabled overScrollMode="never">
                                  {FONT_KEYS.map((k) => {
                                    const sel = (drafts[i].font ?? "sans-400") === k;
                                    return (
                                      <TouchableOpacity
                                        key={k}
                                        style={[s.fontBtn, sel && s.fontBtnSelected]}
                                        onPress={() => setDrafts((prev) => {
                                          const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                          cp[i] = { ...cp[i], font: k }; return cp;
                                        })}
                                      >
                                        <Text style={[s.fontPreview, { fontSize: 16 }, FONT_STYLE_MAP[k]]}>Aa</Text>
                                        <Text style={s.fontLabel} numberOfLines={1}>{k}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </ScrollView>

                                {/* Tamaño de texto */}
                                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                                  <Text style={s.inlineLabel}>Tamaño</Text>
                                  <TouchableOpacity
                                    onPress={() =>
                                      setDrafts((prev) => {
                                        const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                        const cur = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, (cp[i].textSize ?? DEFAULT_TEXT_SIZE) - 2));
                                        cp[i] = { ...cp[i], textSize: cur };
                                        return cp;
                                      })
                                    }
                                    style={s.sizeBtn}
                                  >
                                    <Ionicons name="remove" size={16} color="#fff" />
                                  </TouchableOpacity>
                                  <Text style={s.sizeLabel}>{Math.round(drafts[i].textSize ?? DEFAULT_TEXT_SIZE)}</Text>
                                  <TouchableOpacity
                                    onPress={() =>
                                      setDrafts((prev) => {
                                        const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                        const cur = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, (cp[i].textSize ?? DEFAULT_TEXT_SIZE) + 2));
                                        cp[i] = { ...cp[i], textSize: cur };
                                        return cp;
                                      })
                                    }
                                    style={s.sizeBtn}
                                  >
                                    <Ionicons name="add" size={16} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}

                            {openUI.kind === "effects" && (
                              <View>
                                <Text style={s.inlineLabel}>Efectos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carouselRow} nestedScrollEnabled overScrollMode="never">
                                  {(["none","warm","cool","sepia","contrast","vintage","soft"] as EffectKey[]).map((key) => {
                                    const sel = (drafts[i].effect ?? "none") === key;
                                    return (
                                      <TouchableOpacity
                                        key={key}
                                        style={[s.effectBtn, sel && s.effectBtnSelected]}
                                        onPress={() => setDrafts((prev) => {
                                          const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                          cp[i] = { ...cp[i], effect: key }; return cp;
                                        })}
                                      >
                                        <Text style={s.effectLabel}>
                                          {key === "none" ? "Original"
                                            : key === "warm" ? "Cálido"
                                            : key === "cool" ? "Frío"
                                            : key === "sepia" ? "Sepia"
                                            : key === "contrast" ? "Contraste"
                                            : key === "vintage" ? "Vintage"
                                            : "Suave"}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </ScrollView>

                                <View style={{ marginTop: 10 }}>
                                  <Text style={s.inlineLabel}>Resolución</Text>
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carouselRow} nestedScrollEnabled overScrollMode="never">
                                    {QUALITY_LABELS.map((q) => {
                                      const sel = (drafts[i].quality ?? "original") === q;
                                      return (
                                        <TouchableOpacity
                                          key={q}
                                          style={[s.effectBtn, sel && s.effectBtnSelected]}
                                          onPress={() => setDrafts((prev) => {
                                            const cp = [...prev] as [SlideDraft, SlideDraft, SlideDraft];
                                            cp[i] = { ...cp[i], quality: q }; return cp;
                                          })}
                                        >
                                          <Text style={s.effectLabel}>{q}</Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </ImageBackground>
                    ) : (
                      <TouchableOpacity style={s.emptySlide} onPress={() => pickSlide(i)} activeOpacity={0.9}>
                        <Ionicons name="add" size={ICON_SIZE_EMPTY} color="#E0E0E0" />
                        <Text style={s.emptyText}>Añadir foto</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>

          {/* zonas de toque para navegar entre slides */}
          {navEnabled && (
            <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { zIndex: 1, elevation: 0 }]}>
              <TouchableOpacity
                style={[s.navZoneBase, { left: 0, top: headerH + UI_GUARD_TOP_EXTRA, bottom: TAP_GUARD_BOTTOM }]}
                activeOpacity={0.6}
                onPress={() => {
                  const next = Math.max(0, selectedIdx - 1);
                  setSelectedIdx(next);
                  listRef.current?.scrollToIndex({ index: next, animated: true });
                }}
              />
              <TouchableOpacity
                style={[s.navZoneBase, { right: 0, top: headerH + UI_GUARD_TOP_EXTRA, bottom: TAP_GUARD_BOTTOM }]}
                activeOpacity={0.6}
                onPress={() => {
                  const next = Math.min(2, selectedIdx + 1);
                  setSelectedIdx(next);
                  listRef.current?.scrollToIndex({ index: next, animated: true });
                }}
              />
            </View>
          )}

          {/* ===== PREVIEW MODAL ===== */}
          <Modal
            visible={previewOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setPreviewOpen(false)}
          >
            <SafeAreaView style={s.previewBackdrop}>
              <View style={s.previewChrome}>
                <TouchableOpacity onPress={() => setPreviewOpen(false)} style={s.roundBtn}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>

                {/* Modo Perfil */}
                <TouchableOpacity onPress={() => setPreviewMode("profile")} style={[s.roundBtn, previewMode==="profile" && { backgroundColor:"rgba(0,0,0,0.85)" }]}>
                  <Ionicons name="phone-portrait" size={20} color="#fff" />
                </TouchableOpacity>

                {/* Modo 4:16 + rotar */}
                <TouchableOpacity onPress={() => setPreviewMode("tall")} style={[s.roundBtn, previewMode==="tall" && { backgroundColor:"rgba(0,0,0,0.85)" }]}>
                  <Ionicons name="crop" size={20} color="#fff" />
                </TouchableOpacity>
                {previewMode === "tall" && (
                  <TouchableOpacity onPress={() => setPreviewRotate(v=>!v)} style={s.roundBtn}>
                    <Ionicons name="sync" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>

              {(() => {
                const d = drafts[selectedIdx];
                const raw = d?.text ?? "";
                const W = Dimensions.get("window").width;
                const H = Dimensions.get("window").height;

                let ratio: number; // width/height
                if (previewMode === "profile") {
                  const PROFILE_H = 355;
                  ratio = W / PROFILE_H;
                } else {
                  ratio = previewRotate ? 16/4 : 4/16;
                }

                const maxW = W * 0.92;
                const maxH = H * 0.9;

                let boxW = maxW;
                let boxH = boxW / ratio;
                if (boxH > maxH) { boxH = maxH; boxW = boxH * ratio; }

                const scale = Math.min(boxW / Math.max(1, slotSize.w), boxH / Math.max(1, slotSize.h));
                const fontPx = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, (d?.textSize ?? DEFAULT_TEXT_SIZE) * scale));

                const bubbleMaxW = bubbleWidthFor(boxW);
                const displayText = softWrapFit(raw, fontPx, bubbleMaxW);

                return (
                  <View style={{ width: boxW, height: boxH, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" }}>
                    {d?.uri ? (
                      <ImageBackground
                        source={{ uri: d.uri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      >
                        <EffectOverlay effect={d?.effect ?? "none"} />

                        <LinearGradient
                          colors={["rgba(0,0,0,0.65)","rgba(0,0,0,0.55)","rgba(0,0,0,0.70)"]}
                          start={{x:0,y:0}} end={{x:1,y:1}}
                          style={StyleSheet.absoluteFill}
                        />
                        <LinearGradient
                          colors={["transparent","rgba(0,0,0,0.20)","rgba(0,0,0,0.40)"]}
                          locations={[0,0.5,1]}
                          style={StyleSheet.absoluteFill}
                        />

                        {/* Burbuja arriba-izquierda (centrada horizontalmente respecto al cuadro) */}
                        <View
                          style={[
                            s.previewBubble,
                            { left: 12, top: 12, paddingVertical: 8, paddingHorizontal: 12 },
                          ]}
                        >
                          <Text
                            style={[
                              s.previewText,
                              { color: d?.color ?? "#fff", fontSize: fontPx, lineHeight: Math.round(fontPx * 1.2), maxWidth: bubbleMaxW },
                              (d?.font && FONT_STYLE_MAP[d?.font]) || {},
                            ]}
                          >
                            {displayText}
                          </Text>
                        </View>

                        {/* Avatar abajo-izquierda */}
                        <View style={{
                          position:"absolute", bottom: 12, left: 12,
                          width: 72, height: 72, borderRadius: 36,
                          borderWidth: 2, borderColor:"#fff", overflow:"hidden"
                        }}>
                          <Image
                            source={profile?.avatar ? { uri: profile.avatar } : require("../../assets/images/avatar.png")}
                            style={{width:"100%",height:"100%"}}
                          />
                        </View>
                      </ImageBackground>
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ color: "#fff" }}>Sin imagen</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const hsl = { top: 8, bottom: 8, left: 8, right: 8 };

const s = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: "#000" },

  topChrome: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 60, elevation: 60 },
  headerRow: {
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerIcon: { padding: 6 },
  headerTitle: {
    color: "#fff", fontWeight: "700", fontSize: 16,
    position: "absolute", left: 0, right: 0, textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  headerAvatarOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
    zIndex: 61, elevation: 61,
    overflow: "hidden",
  },

  publishBtn: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  publishBtnDisabled: { opacity: 0.85 },
  publishText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.4 },

  gradTop: { position: "absolute", left: 0, right: 0, top: 0, height: 140 },
  gradBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 200 },

  storySlide: { height: "100%", backgroundColor: "#000" },
  emptySlide: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  emptyText: { color: "#E0E0E0", fontWeight: "700", marginTop: 8 },

  slideTopButtons: {
    position: "absolute", right: 10, top: 56,
    flexDirection: "row", gap: 8,
    zIndex: 55, elevation: 55,
  },
  roundBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)",
  },
  btnAa: { color: "#fff", fontWeight: "800", fontSize: BTN_AA_SIZE, lineHeight: BTN_AA_SIZE + 2 },

  bottomToggles: {
    position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 10,
    zIndex: 55, elevation: 55,
  },
  fabBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)",
  },
  fabBtnActive: { backgroundColor: "rgba(0,0,0,0.85)" },

  inlineBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingTop: 10, paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.15)",
    zIndex: 50, elevation: 50,
  },
  inlineLabel: { color: "#BDBDBD", fontWeight: "700", marginBottom: 6 },

  carouselRow: { flexDirection: "row", gap: 10, paddingRight: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  swatchSelected: { borderWidth: 2, borderColor: "#2E7D32" },

  fontBtn: { minWidth: 64, alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  fontBtnSelected: { backgroundColor: "rgba(46,125,50,0.18)", borderColor: "#2E7D32" },
  fontPreview: { color: "#fff", fontWeight: "700" },
  fontLabel: { color: "#A5D6A7", fontSize: 10, marginTop: 4, maxWidth: 84 },

  sizeBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)",
  },
  sizeLabel: { color: "#fff", fontWeight: "800", minWidth: 28, textAlign: "center" },

  effectBtn: { minWidth: 92, alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  effectBtnSelected: { backgroundColor: "rgba(144,202,249,0.22)", borderColor: "#90CAF9" },
  effectLabel: { color: "#E3F2FD", fontSize: 12, fontWeight: "700" },

  navZoneBase: {
    position: "absolute",
    width: "33%",
    zIndex: 1,
    elevation: 0,
  },

  /* PREVIEW modal */
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewChrome: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 10,
    zIndex: 2,
  },
  previewBubble: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.77)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  previewText: {
    color: "#fff",
    fontWeight: "700",
  },
});
