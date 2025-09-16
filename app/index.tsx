// app/index.tsx  ← SPLASH (FRAGMENTS + subtítulo + reflejo)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/* =========================
   AJUSTES RÁPIDOS (tamaños/colores/velocidades)
   ========================= */

// Textos
const BRAND = "Bribri";                                   // título
const SUBTITLE = "la pieza que completa tu historia";        // subtítulo

// Tamaños
const BRAND_SIZE = 30;   // tamaño del texto de la marca
const SUB_SIZE = 16;     // tamaño del subtítulo
const ICON_SIZE = 128;   // tamaño del ícono central (pieza)

// Velocidades (ms por carácter)
const TYPE_SPEED_MS = 220;        // velocidad para la marca  (más alto = más lento)
const TYPE_SPEED_SUB_MS = 200;    // velocidad para subtítulo

// Tiempos de escena
const SUBTITLE_DELAY_MS = 200;    // pausa entre terminar la marca e iniciar el subtítulo
const HOLD_AFTER_FINISH_MS = 900; // pausa al final antes de navegar

// Degradados
const BG_GRADIENT = ["#050607", "#0B0E12", "#11161A"] as const;       // fondo oscuro
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#fa0089ff"] as const;     // turquesas (icono y textos)

// Reflejo del ícono (ajustes)
const REFLECTION_OPACITY = 0.32;                      // opacidad global del reflejo
const REFLECTION_HEIGHT_FACTOR = 0.50;                // % de la altura del ícono (0.5 = mitad)
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const; // máscara: opaco→transparente
/* ========================= */

export default function Splash() {
  const router = useRouter();

  const [typedTitle, setTypedTitle] = useState("");
  const [typedSub, setTypedSub] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const [titleDone, setTitleDone] = useState(false);

  useEffect(() => {
    // Cursor parpadeante
    const blink = setInterval(() => setCursorOn(v => !v), 450);

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
            if (j >= SUBTITLE.length) {
              clearInterval(typerSub);
            }
          }, TYPE_SPEED_SUB_MS);
        }, SUBTITLE_DELAY_MS);
      }
    }, TYPE_SPEED_MS);

    // Navegación automática cuando termina todo (duración calculada)
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
      {/* Ícono con degradado turquesa usando máscara */}
      <MaskedView
        style={{ width: ICON_SIZE, height: ICON_SIZE, marginBottom: 6 }}
        maskElement={
          <View style={styles.center}>
            {/* Ícono sólido para que el degradado se vea lleno */}
            <MaterialCommunityIcons name="puzzle" size={ICON_SIZE} color="#fff" />
          </View>
        }
      >
        <LinearGradient
          colors={TURQ_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        />
      </MaskedView>

      {/* Reflejo del ícono (inversión vertical + desvanecido) */}
      <View
        style={{
          width: ICON_SIZE,
          height: reflectionHeight,
          opacity: REFLECTION_OPACITY,
          marginBottom: 10,
        }}
      >
        {/* 1) Máscara de desvanecido vertical: opaco→transparente */}
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
          {/* 2) Contenido a desvanecer: el ícono invertido y recortado a su forma */}
          <MaskedView
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
            maskElement={
              <View style={styles.center}>
                <MaterialCommunityIcons name="puzzle" size={ICON_SIZE} color="#fff" />
              </View>
            }
          >
            <LinearGradient
              colors={TURQ_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                transform: [{ scaleY: -1 }], // invierte verticalmente
              }}
            />
          </MaskedView>
        </MaskedView>
      </View>

      {/* Texto de marca con degradado + cursor mientras escribe */}
      <MaskedView
        style={styles.brandWrap}
        maskElement={
          <Text style={[styles.brandText, { fontSize: BRAND_SIZE }]}>
            {typedTitle}
            {/* cursor visible mientras escribe la marca */}
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

      {/* Subtítulo con el mismo degradado, aparece luego del título */}
      <MaskedView
        style={styles.subWrap}
        maskElement={
          <Text style={[styles.subText, { fontSize: SUB_SIZE }]}>
            {typedSub}
            {/* cursor visible mientras el subtítulo se está escribiendo */}
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

      {/* Footer */}
      <Text style={styles.footer}>from Prodigy Studios</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Fondo con degradado oscuro (BG_GRADIENT)
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  // Contenedor del título con máscara
  brandWrap: {
    height: BRAND_SIZE * 1.35, // alto visible del texto
    width: "80%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  brandText: {
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
    color: "#fff", // queda cubierto por la máscara (ayuda en iOS)
  },
  brandGradientFill: {
    ...StyleSheet.absoluteFillObject,
  },

  // Contenedor del subtítulo con máscara
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
  subGradientFill: {
    ...StyleSheet.absoluteFillObject,
  },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 16,      // tamaño del footer
    fontWeight: "800", // peso del footer
    color: "#C7CFD9",  // color del footer
    letterSpacing: 0.5,
  },
});
