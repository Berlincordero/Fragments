// app/home.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import {
  Video,
  ResizeMode,
  Audio,
  AVPlaybackStatus,
  AVPlaybackStatusSuccess,
} from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { endpoints } from "../lib/api";

/* ===== Tamaño pantalla ===== */
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

/* ===== Ajustes rápidos (puedes tocarlos) ===== */
const AV_SIZE = 52;          // tamaño del avatar
const SCALE = 1.02;          // menos zoom para aparentar más centrado
const CENTER_BIAS = -0.18;   // ligero sesgo hacia arriba

// Cálculo de desplazamiento seguro: nunca muestra bordes
const OVERFILL = SCREEN_H * (SCALE - 1);
const MAX_SHIFT = OVERFILL / (2 * SCALE);
const DESIRED = (CENTER_BIAS * OVERFILL) / SCALE;
const TRANSLATE_Y = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, DESIRED));

/* ===== Assets ===== */
const DEFAULT_VIDEO = require("../assets/videos/default.mp4");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");

/* ===== Tipos mínimos ===== */
type Gender = "M" | "F" | "O";
type Profile = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender: Gender | string | null;
};

/* ===== Helper avatar ===== */
const getAvatarSource = (p?: Pick<Profile, "avatar" | "gender"> | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri };
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export const options = { headerShown: false };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Player / overlay
  const videoRef = useRef<Video>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hudVisible, setHudVisible] = useState(false);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressWidth = useRef(1);

  const showHUD = (ms = 1500) => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), ms);
  };

  useEffect(() => {
    return () => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
    };
  }, []);

  // Audio iOS/Android (permitir sonido en modo silencio) — con fallback por versiones
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

  // Cargar perfil (avatar)
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

  // Status del video
  const onStatus = (s: AVPlaybackStatus) => {
    if (!("isLoaded" in s) || !s.isLoaded) return;
    const ss = s as AVPlaybackStatusSuccess;
    setDuration(ss.durationMillis ?? 0);
    setPosition(ss.positionMillis ?? 0);
    setIsPlaying(!!ss.isPlaying);
  };

  // Scrub a posición relativa [0..1]
  const seekToRatio = async (r: number) => {
    if (!duration) return;
    const clamped = Math.max(0, Math.min(1, r));
    const target = Math.floor(duration * clamped);
    try {
      await videoRef.current?.setPositionAsync(target);
      setPosition(target);
    } catch {}
  };

  const handleProgressTouch = (evt: any) => {
    const x = evt.nativeEvent.locationX ?? 0;
    const w = progressWidth.current || 1;
    seekToRatio(x / w);
    showHUD(1800);
  };
  const handleProgressMove = (evt: any) => {
    const x = evt.nativeEvent.locationX ?? 0;
    const w = progressWidth.current || 1;
    seekToRatio(x / w);
  };

  const togglePlay = async () => {
    try {
      if (isPlaying) {
        await videoRef.current?.pauseAsync();
      } else {
        await videoRef.current?.playAsync();
      }
      setIsPlaying(!isPlaying);
      showHUD();
    } catch {}
  };

  /* ============ Auto-fullscreen al girar (modo periscopio) ============ */
  useEffect(() => {
    let sub: ScreenOrientation.Subscription | null = null;

    const goFSIfLandscape = async () => {
      try {
        const current = await ScreenOrientation.getOrientationAsync();
        const isLand =
          current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        if (isLand) {
          await videoRef.current?.presentFullscreenPlayer();
        } else {
          await videoRef.current?.dismissFullscreenPlayer();
        }
      } catch {}
    };

    goFSIfLandscape();

    sub = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      const o = orientationInfo.orientation;
      const isLand =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      (async () => {
        try {
          if (isLand) {
            await videoRef.current?.presentFullscreenPlayer();
          } else {
            await videoRef.current?.dismissFullscreenPlayer();
          }
        } catch {}
      })();
    });

    return () => {
      if (sub) ScreenOrientation.removeOrientationChangeListener(sub);
    };
  }, []);

  return (
    <View style={styles.root}>
      {/* Video fullscreen, con menos zoom y desplazamiento acotado para centrado visual */}
      <View
        style={styles.videoWrap}
        onStartShouldSetResponder={() => {
          showHUD();
          return false;
        }}
      >
        <Video
          ref={videoRef}
          source={DEFAULT_VIDEO}
          style={[
            styles.video,
            { transform: [{ translateY: TRANSLATE_Y }, { scale: SCALE }] },
          ]}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          volume={1.0}
          onPlaybackStatusUpdate={onStatus}
          useNativeControls={false}
        />
      </View>

      {/* Botón central de pausa / play */}
      {(hudVisible || !isPlaying) && (
        <TouchableOpacity
          style={styles.centerBtn}
          activeOpacity={0.9}
          onPress={togglePlay}
        >
          <Text style={styles.centerIcon}>{isPlaying ? "❚❚" : "▶︎"}</Text>
        </TouchableOpacity>
      )}

      {/* Top: avatar (lleva a /finca) + barra transparente */}
      <View style={[styles.topRow, { top: insets.top + 14, left: 14, right: 14 }]}>
        <TouchableOpacity
          onPress={() => router.push("/finca")}
          activeOpacity={0.85}
          style={styles.avatarBtn}
        >
          <Image source={getAvatarSource(profile)} style={styles.avatarImg} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.composeBar}
          activeOpacity={0.9}
          onPress={() => {
            // abre tu compositor aquí
          }}
          onPressIn={() => showHUD()}
        >
          <Text style={styles.composeText}>¿Qué estás pensando?</Text>
          <Text style={styles.plus}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de avance (aparece al tocar) */}
      {hudVisible && (
        <View style={styles.progressRoot} pointerEvents="box-none">
          <View
            style={styles.progressHit}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleProgressTouch}
            onResponderMove={handleProgressMove}
            onResponderRelease={handleProgressTouch}
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
                            (position / Math.max(1, duration)) *
                              (progressWidth.current || 0)
                          )
                        : 2,
                  },
                ]}
              />
            </View>
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
    backgroundColor: "#000",
  },
  video: { width: SCREEN_W, height: SCREEN_H },

  // Botón central (círculo con borde blanco)
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
  centerIcon: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  topRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Avatar con borde blanco
  avatarBtn: {
    width: AV_SIZE,
    height: AV_SIZE,
    borderRadius: AV_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.98)",
  },
  avatarImg: { width: "100%", height: "100%" },

  // Barra transparente con borde blanco
  composeBar: {
    flex: 1,
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

  // Texto blanco con sombra negra
  composeText: {
    color: "#fff",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  plus: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  /* ---- Barra de progreso ---- */
  progressRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    paddingHorizontal: 14,
  },
  progressHit: {
    paddingVertical: 8,
  },
  progressTrack: {
    height: 4,
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: LIGHT_GREEN,
  },
});
