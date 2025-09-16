// app/login.tsx  ← LOGIN con estilo del Splash (FRAGMENTA) + degradado más claro + reflejo
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { endpoints } from "../lib/api";  // 👈 dos niveles hacia arriba

/* =========================
   Ajustes rápidos (tamaños/colores/efectos)
   ========================= */

// Marca y subtítulo
const BRAND = "Bribri";                                   // título
const SUBTITLE = "la pieza que completa tu historia";   

// Tamaños
const ICON_SIZE = 84;      // ícono puzzle
const BRAND_SIZE = 28;     // tamaño del título FRAGMENTS
const SUB_SIZE = 14;       // tamaño subtítulo
const INPUT_HEIGHT = 50;   // alto inputs
const CARD_RADIUS = 18;    // radio de la tarjeta

// Degradado de fondo (más claro que antes)
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;

// Degradado turquesa (un poco más luminoso)
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#f200faff"] as const;   

// Colores de texto/placeholders/bordes
const PLACEHOLDER = "#D9F7F8";
const INPUT_BORDER = "rgba(2, 253, 211, 0.75)"; // borde turquesa un poco más visible
const INPUT_BG = "rgba(255,255,255,0.08)";      // glass un pelín más claro

// Reflejo del ícono (ajustes)
const REFLECTION_OPACITY = 0.32;                // opacidad global del reflejo
const REFLECTION_HEIGHT_FACTOR = 0.50;          // % de la altura del ícono para el reflejo (0.5 = mitad)
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const; // máscara: opaco→transparente
/* ========================= */

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // BACKEND: SIN CAMBIOS
  const handleLogin = async () => {
    try {
      const response = await fetch(endpoints.login(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem("userToken", data.token);
        router.replace("/home"); // ← SIN Alert
      } else {
        const errorData = await response.json();
        Alert.alert("Error al iniciar sesión", JSON.stringify(errorData));
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo conectar con el servidor");
    }
  };

  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* HEADER: icono + marca + subtítulo (todos con degradado turquesa) */}
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

        {/* Reflejo del ícono (inversión vertical + desvanecido) */}
        <View
          style={{
            width: ICON_SIZE,
            height: reflectionHeight,
            opacity: REFLECTION_OPACITY,
            marginBottom: 8,
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

        {/* FRAGMENTA */}
        <MaskedView
          style={styles.brandWrap}
          maskElement={<Text style={[styles.brandText, { fontSize: BRAND_SIZE }]}>{BRAND}</Text>}
        >
          <LinearGradient
            colors={TURQ_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandGradientFill}
          />
        </MaskedView>

        {/* Subtítulo */}
        <MaskedView
          style={styles.subWrap}
          maskElement={<Text style={[styles.subText, { fontSize: SUB_SIZE }]}>{SUBTITLE}</Text>}
        >
          <LinearGradient
            colors={TURQ_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subGradientFill}
          />
        </MaskedView>
      </View>

      {/* CARD DEL FORMULARIO (glass) */}
      <View style={styles.card}>
        <Text style={styles.formTitle}>Iniciar Sesión</Text>

        {/* Usuario */}
        <View style={styles.inputRow}>
          <Ionicons name="person-outline" size={20} color={PLACEHOLDER} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Usuario o Email"
            placeholderTextColor={PLACEHOLDER}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        {/* Contraseña con ojito */}
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color={PLACEHOLDER} style={styles.inputIcon} />
          <TextInput
            key={showPassword ? "text" : "password"} // fuerza re-render en Android
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={PLACEHOLDER}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            style={styles.eyeBtn}
          >
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={PLACEHOLDER} />
          </TouchableOpacity>
        </View>

        {/* Botón login con degradado */}
        <TouchableOpacity activeOpacity={0.9} onPress={handleLogin} style={styles.btnOuter}>
          <LinearGradient
            colors={TURQ_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>ENTRAR</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Enlace a registro */}
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace("/register")}>
          <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>
      </View>

      {/* FOOTER */}
      <Text style={styles.footer}>
        from <Text style={styles.footerBold}>Prodigy Studios</Text>
      </Text>
    </LinearGradient>
  );
}

/* ---------- ESTILOS ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: "space-between",
  },

  // Header (icono + textos)
  header: { alignItems: "center", marginTop: 8 },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  brandWrap: {
    height: BRAND_SIZE * 1.3,
    width: "78%",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
    color: "#fff",
  },
  brandGradientFill: { ...StyleSheet.absoluteFillObject },

  subWrap: {
    height: SUB_SIZE * 1.6,
    width: "90%",
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

  // Card/form
  card: {
    backgroundColor: "rgba(255,255,255,0.08)", // glass un poco más claro
    borderRadius: CARD_RADIUS,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EAF6F8",
    alignSelf: "center",
    marginBottom: 12,
    letterSpacing: 0.4,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: INPUT_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    marginVertical: 6,
    paddingHorizontal: 10,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    color: "#EAF6F8",
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 0,
  },
  eyeBtn: { padding: 4, marginLeft: 6 },

  // Botón
  btnOuter: { marginTop: 10 },
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
    fontSize: 16,
  },

  // Enlaces y footer
  linkBtn: { marginTop: 12, alignItems: "center" },
  linkText: {
    color: "#9EEFEF",
    fontWeight: "700",
    textDecorationLine: "underline",
    letterSpacing: 0.2,
  },
  footer: {
    textAlign: "center",
    color: "#C7CFD9",
    fontSize: 13,
  },
  footerBold: { fontWeight: "900", color: "#EAF6F8" },
});
