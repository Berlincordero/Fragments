// app/index.tsx  ← SPLASH congruente con el LOGIN (PNG + reflejo + textos con degradado)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

/* =========================
   Ajustes (mismos tonos y elementos del login)
   ========================= */

// Textos
const BRAND = "Bribri";
const SUBTITLE = "Cuentanos tu historia";

// Tamaños
const BRAND_SIZE = 30;
const SUB_SIZE = 16;
const ICON_SIZE = 120;

// Velocidades (ms por carácter)
const TYPE_SPEED_MS = 220;
const TYPE_SPEED_SUB_MS = 200;

// Tiempos de escena
const SUBTITLE_DELAY_MS = 200;
const HOLD_AFTER_FINISH_MS = 900;

// Degradados (idénticos al login)
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#f200faff"] as const;

// PNG de micrófono (igual al login)
const APP_ICON = require("../assets/images/microfono.png");

// Reflejo del ícono (igual lógica que en login)
const REFLECTION_OPACITY = 0.32;
const REFLECTION_HEIGHT_FACTOR = 0.5;
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const;
/* ========================= */

export default function Splash() {
  const router = useRouter();

  const [typedTitle, setTypedTitle] = useState("");
  const [typedSub, setTypedSub] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const [titleDone, setTitleDone] = useState(false);

  useEffect(() => {
    // Cursor parpadeante
    const blink = setInterval(() => setCursorOn((v) => !v), 450);

    // Tipeo del título
    let i = 0;
    const typerTitle = setInterval(() => {
      i++;
      setTypedTitle(BRAND.slice(0, i));
      if (i >= BRAND.length) {
        clearInterval(typerTitle);
        setTitleDone(true);

        // Arrancamos subtítulo tras una pequeña pausa
        setTimeout(() => {
          let j = 0;
          const typerSub = setInterval(() => {
            j++;
            setTypedSub(SUBTITLE.slice(0, j));
            if (j >= SUBTITLE.length) clearInterval(typerSub);
          }, TYPE_SPEED_SUB_MS);
        }, SUBTITLE_DELAY_MS);
      }
    }, TYPE_SPEED_MS);

    // Navegación automática cuando termina todo
    const totalMs =
      BRAND.length * TYPE_SPEED_MS +
      SUBTITLE_DELAY_MS +
      SUBTITLE.length * TYPE_SPEED_SUB_MS +
      HOLD_AFTER_FINISH_MS;

    const navTimer = setTimeout(async () => {
      const token = await AsyncStorage.getItem("userToken");
      router.replace(token ? "/home" : "/login");
    }, totalMs);

    return () => {
      clearInterval(blink);
      clearInterval(typerTitle);
      clearTimeout(navTimer);
    };
  }, []);

  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* Ícono PNG del micrófono */}
      <Image
        source={APP_ICON}
        style={{ width: ICON_SIZE, height: ICON_SIZE, marginBottom: 6 }}
        resizeMode="contain"
      />

      {/* Reflejo del PNG (inversión vertical + desvanecido) */}
      <View
        style={{
          width: ICON_SIZE,
          height: reflectionHeight,
          opacity: REFLECTION_OPACITY,
          marginBottom: 10,
        }}
      >
        {/* Máscara de desvanecido vertical: opaco→transparente */}
        <MaskedView
          style={{ flex: 1 }}
          maskElement={
            <LinearGradient
              colors={REFLECTION_FADE_COLORS}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ flex: 1 }}
            />
          }
        >
          {/* Contenido a desvanecer: PNG invertido */}
          <Image
            source={APP_ICON}
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              transform: [{ scaleY: -1 }],
            }}
            resizeMode="contain"
          />
        </MaskedView>
      </View>

      {/* Marca con degradado turquesa + cursor mientras escribe */}
      <MaskedView
        style={styles.brandWrap}
        maskElement={
          <Text style={[styles.brandText, { fontSize: BRAND_SIZE }]}>
            {typedTitle}
            {!titleDone ? <Text style={{ opacity: cursorOn ? 1 : 0 }}>|</Text> : null}
          </Text>
        }
      >
        <LinearGradient
          colors={TURQ_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandGradientFill}
        />
      </MaskedView>

      {/* Subtítulo con el mismo degradado, aparece tras el título */}
      <MaskedView
        style={styles.subWrap}
        maskElement={
          <Text style={[styles.subText, { fontSize: SUB_SIZE }]}>
            {typedSub}
            {titleDone && typedSub.length < SUBTITLE.length ? (
              <Text style={{ opacity: cursorOn ? 1 : 0 }}>|</Text>
            ) : null}
          </Text>
        }
      >
        <LinearGradient
          colors={TURQ_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.subGradientFill}
        />
      </MaskedView>

      {/* Footer (tipografía y color como en login) */}
      <Text style={styles.footer}>
        from <Text style={styles.footerBold}>Prodigy Studios</Text>
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // Helpers
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  // Marca
  brandWrap: {
    height: BRAND_SIZE * 1.35,
    width: "80%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  brandText: {
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
    color: "#fff",
  },
  brandGradientFill: { ...StyleSheet.absoluteFillObject },

  // Subtítulo
  subWrap: {
    height: SUB_SIZE * 1.6,
    width: "86%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  subText: {
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
    color: "#fff",
  },
  subGradientFill: { ...StyleSheet.absoluteFillObject },

  // Footer (igual al login)
  footer: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#C7CFD9",
    fontSize: 13,
  },
  footerBold: { fontWeight: "900", color: "#EAF6F8" },
});
 