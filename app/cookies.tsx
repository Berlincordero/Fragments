// app/cookies.tsx  ← POLÍTICA DE COOKIES (estilo FRAGMENTS + degradado + reflejo)
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/* =========================
   Ajustes rápidos (tamaños/colores/efectos)
   ========================= */

// Tamaños
const ICON_SIZE = 84;     // ícono puzzle
const TITLE_SIZE = 22;    // tamaño del título

// Degradado de fondo (matching login/register/terms/privacy)
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;

// Degradado turquesa/fucsia/lila (matching login/register/terms/privacy)
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#ff06acff"] as const;

// Reflejo del ícono
const REFLECTION_OPACITY = 0.32;
const REFLECTION_HEIGHT_FACTOR = 0.50; // 0.5 = mitad del ícono
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const;
/* ========================= */

export default function CookiesScreen() {
  const router = useRouter();
  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* HEADER: icono con degradado + reflejo + título en degradado */}
      <View style={styles.header}>
        {/* Ícono puzzle con degradado */}
        <MaskedView
          style={{ width: ICON_SIZE, height: ICON_SIZE, marginBottom: 6 }}
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
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
          />
        </MaskedView>

        {/* Reflejo del ícono */}
        <View
          style={{
            width: ICON_SIZE,
            height: reflectionHeight,
            opacity: REFLECTION_OPACITY,
            marginBottom: 8,
          }}
        >
          {/* Desvanecido vertical */}
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
            {/* Ícono invertido y recortado por su forma */}
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
                  transform: [{ scaleY: -1 }], // inversión vertical
                }}
              />
            </MaskedView>
          </MaskedView>
        </View>

        {/* Título con degradado */}
        <MaskedView
          style={styles.titleWrap}
          maskElement={<Text style={[styles.titleText, { fontSize: TITLE_SIZE }]}>Política de cookies</Text>}
        >
          <LinearGradient
            colors={TURQ_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.titleGradientFill}
          />
        </MaskedView>
      </View>

      {/* CUERPO: tarjeta glass con scroll */}
      <ScrollView style={styles.card} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <Text style={styles.text}>
          1. ¿Qué son las cookies?{"\n\n"}
          Las cookies son pequeños archivos de texto que los sitios web
          almacenan en tu dispositivo para recordar tus preferencias…{"\n\n"}
          2. ¿Por qué usamos cookies?{"\n\n"}
          Bribri Social utiliza cookies para mejorar tu experiencia, medir el
          rendimiento y proteger la plataforma…{"\n\n"}
          3. Tipos de cookies que utilizamos{"\n\n"}
          • Cookies esenciales{"\n"}
          • Cookies de rendimiento{"\n"}
          • Cookies de funcionalidad…{"\n\n"}
          4. Gestión de cookies{"\n\n"}
          Puedes deshabilitar las cookies en la configuración de tu navegador,
          pero la plataforma podría no funcionar correctamente…{"\n\n"}
          5. Cambios en esta política{"\n\n"}
          Podemos actualizar esta política ocasionalmente. Te notificaremos
          cualquier cambio importante…{"\n\n"}
          ────────────────────────────{"\n\n"}
        </Text>
      </ScrollView>

      {/* BOTÓN VOLVER (degradado) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.replace("/register")}
        style={styles.btnOuter}
      >
        <LinearGradient
          colors={TURQ_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>REGRESAR A REGISTRO</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

/* ---------- ESTILOS ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    justifyContent: "space-between",
  },

  header: { alignItems: "center", marginTop: 6 },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  // Título en degradado
  titleWrap: {
    height: TITLE_SIZE * 1.4,
    width: "90%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 8,
  },
  titleText: {
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
    color: "#fff",
  },
  titleGradientFill: { ...StyleSheet.absoluteFillObject },

  // Tarjeta "glass"
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  text: {
    color: "#E0F7FA",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  // Botón degradado
  btnOuter: { marginTop: 12, alignSelf: "center", width: "72%" },
  btn: {
    height: 48,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  btnText: {
    color: "#071217",
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 15,
  },
});
