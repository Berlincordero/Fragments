// app/register.tsx  ← REGISTER con estilo FRAGMENTS + degradado + reflejo (backend intacto)
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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

// Degradado de fondo (claro, matching login actualizado)
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;

// Degradado turquesa (matching login actualizado)
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#fa0089ff"] as const;

// Colores de texto/placeholders/bordes
const PLACEHOLDER = "#D9F7F8";
const INPUT_BORDER = "rgba(2, 253, 211, 0.75)"; // borde más visible
const INPUT_BG = "rgba(255,255,255,0.08)";      // glass leve

// Reflejo del ícono
const REFLECTION_OPACITY = 0.32;                         // opacidad global del reflejo
const REFLECTION_HEIGHT_FACTOR = 0.50;                   // % de altura del ícono (0.5 = mitad)
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const; // máscara: opaco→transparente
/* ========================= */

type Gender = "F" | "M" | "O";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [dob, setDob] = useState<Date | undefined>();
  const [showPicker, setShowPicker] = useState(false);

  const [gender, setGender] = useState<Gender>("M");

  const router = useRouter();

  // BACKEND: SIN CAMBIOS
  const handleRegister = async () => {
    try {
      const payload: any = { username, email, password, gender };
      if (dob) payload.date_of_birth = dob.toISOString().split("T")[0];

      const res = await fetch(endpoints.register(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem("userToken", data.token);
        router.replace("/home"); // ← SIN Alert
      } else {
        const err = await res.json();
        Alert.alert("Error al registrar", JSON.stringify(err));
      }
    } catch {
      Alert.alert("Error", "No se pudo conectar con el servidor");
    }
  };

  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* HEADER: icono + marca + subtítulo (degradado y reflejo) */}
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
            {/* 2) Contenido a desvanecer: ícono invertido y recortado a su forma */}
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

        {/* FRAGMENTS */}
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

      {/* FORMULARIO DESPLAZABLE (glass) */}
      <ScrollView
        style={styles.card}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.formTitle}>Registro</Text>

        {/* Usuario */}
        <View style={styles.inputRow}>
          <Ionicons name="person-outline" size={20} color={PLACEHOLDER} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            placeholderTextColor={PLACEHOLDER}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Correo */}
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={20} color={PLACEHOLDER} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Correo"
            placeholderTextColor={PLACEHOLDER}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
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

        {/* Fecha de nacimiento (abre DateTimePicker) */}
        <TouchableOpacity
          style={styles.inputRow}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={20} color={PLACEHOLDER} style={styles.inputIcon} />
          <Text style={{ color: PLACEHOLDER, fontSize: 16, fontWeight: "700" }}>
            {dob ? dob.toLocaleDateString() : "Fecha de nacimiento (tocar para elegir)"}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={dob ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={(_: any, selectedDate?: Date) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selectedDate) setDob(selectedDate);
            }}
          />
        )}

        {/* Género */}
        <Text style={styles.genderLabel}>Género</Text>
        <View style={styles.genderRow}>
          {[
            { lbl: "Mujer", val: "F" as Gender },
            { lbl: "Hombre", val: "M" as Gender },
            { lbl: "Personalizado", val: "O" as Gender },
          ].map(({ lbl, val }) => (
            <TouchableOpacity key={val} style={styles.radioOpt} onPress={() => setGender(val)}>
              <Ionicons
                name={gender === val ? "radio-button-on" : "radio-button-off"}
                size={20}
                color="#C5E1A5"
              />
              <Text style={styles.radioTxt}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Aviso legal */}
        <Text style={styles.legalText}>
          Al hacer clic en <Text style={{ fontWeight: "bold" }}>"Crear cuenta"</Text>, aceptas
          nuestras{" "}
          <Text style={styles.link} onPress={() => router.push("/terms")}>
            Condiciones
          </Text>
          , la{" "}
          <Text style={styles.link} onPress={() => router.push("/privacy")}>
            Política de privacidad
          </Text>{" "}
          y la{" "}
          <Text style={styles.link} onPress={() => router.push("/cookies")}>
            Política de cookies
          </Text>
          .
        </Text>

        {/* Botón crear cuenta con degradado */}
        <TouchableOpacity activeOpacity={0.9} onPress={handleRegister} style={styles.btnOuter}>
          <LinearGradient
            colors={TURQ_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>CREAR CUENTA</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Volver a login */}
        <TouchableOpacity style={styles.backLogin} onPress={() => router.replace("/")}>
          <Text style={styles.backLoginText}>¿Ya tienes? Ingresa</Text>
        </TouchableOpacity>
      </ScrollView>

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
    paddingHorizontal: 20,
    paddingVertical: 26,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: 520,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  formTitle: {
    fontSize: 22,
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

  genderLabel: {
    color: "#E8F5E9",
    marginTop: 6,
    marginBottom: 2,
    fontSize: 14,
  },
  genderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  radioOpt: { flexDirection: "row", alignItems: "center" },
  radioTxt: { color: "#E8F5E9", marginLeft: 4, fontSize: 14 },

  legalText: {
    fontSize: 11,
    color: "#E0F2F1",
    marginTop: 6,
    lineHeight: 15,
  },
  link: {
    textDecorationLine: "underline",
    fontWeight: "bold",
    color: "#C5E1A5",
  },

  // Botón
  btnOuter: { marginTop: 12 },
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

  backLogin: { marginTop: 10, alignItems: "center" },
  backLoginText: {
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
