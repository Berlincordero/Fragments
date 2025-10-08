// app/register.tsx — Responsive, sin desbordes (incluye fix del campo Fecha de nacimiento)
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
  KeyboardAvoidingView,
  useWindowDimensions,
  StatusBar,
  Image,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { endpoints } from "../lib/api";

/* Paleta/textos (igual a login/index) */
const BRAND = "Bribri";
const SUBTITLE = "Cuentanos tu historia";
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#fa0089ff"] as const;
const APP_ICON = require("../assets/images/microfono.png");

const PLACEHOLDER = "#D9F7F8";
const INPUT_BORDER = "rgba(2, 253, 211, 0.75)";
const INPUT_BG = "rgba(255,255,255,0.08)";

const REFLECTION_OPACITY = 0.28;
const REFLECTION_HEIGHT_FACTOR = 0.5;
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const;

type Gender = "F" | "M" | "O";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Escala responsiva por alto y ancho (agresiva para pantallas cortas/angostas)
  const scale = Math.min(1, Math.min(height / 820, width / 420));
  const isShort = height < 700;
  const isTiny = height < 600; // súper compacto

  const ICON_SIZE = Math.round(Math.min(112, Math.max(72, width * 0.25)) * (isTiny ? 0.9 : scale));
  const BRAND_SIZE = Math.max(20, Math.round(26 * scale));
  const SUB_SIZE = Math.max(11, Math.round(13 * scale));
  const INPUT_HEIGHT = Math.round((isTiny ? 44 : 46) * scale);
  const BTN_HEIGHT = Math.round((isTiny ? 44 : 46) * scale);
  const CARD_RADIUS = Math.round(16 * scale);
  const PAD_H = Math.round((isTiny ? 16 : 18) * scale);
  const PAD_V = Math.round((isTiny ? 14 : 16) * scale);
  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  // Estado
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dob, setDob] = useState<Date | undefined>();
  const [showPicker, setShowPicker] = useState(false);
  const [gender, setGender] = useState<Gender>("M");

  // Backend sin cambios
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
        router.replace("/home");
      } else {
        const err = await res.json();
        Alert.alert("Error al registrar", JSON.stringify(err));
      }
    } catch {
      Alert.alert("Error", "No se pudo conectar con el servidor");
    }
  };

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.fill}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : (StatusBar.currentHeight ?? 24)}
        >
          <ScrollView
            style={styles.fill}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: insets.top + Math.round((isTiny ? 4 : 8) * scale),
              paddingBottom: insets.bottom + Math.round(12 * scale),
              paddingHorizontal: PAD_H,
            }}
            contentInsetAdjustmentBehavior="always"
            contentInset={{ bottom: 6 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
          >
            {/* HEADER */}
            <View style={{ alignItems: "center", marginBottom: Math.round((isTiny ? 6 : 10) * scale) }}>
              <Image
                source={APP_ICON}
                style={{ width: ICON_SIZE, height: ICON_SIZE, marginBottom: Math.round(4 * scale) }}
                resizeMode="contain"
              />

              {/* Reflejo (se apaga en pantallas muy cortas) */}
              {!isTiny && (
                <View
                  style={{
                    width: ICON_SIZE,
                    height: reflectionHeight,
                    opacity: REFLECTION_OPACITY,
                    marginBottom: Math.round(6 * scale),
                  }}
                >
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
              )}

              {/* Marca */}
              <MaskedView
                style={{ height: BRAND_SIZE * 1.2, width: "74%", alignItems: "center", justifyContent: "center" }}
                maskElement={
                  <Text style={[styles.brandText, { fontSize: BRAND_SIZE }]} numberOfLines={1} adjustsFontSizeToFit>
                    {BRAND}
                  </Text>
                }
              >
                <LinearGradient colors={TURQ_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </MaskedView>

              {/* Subtítulo */}
              <MaskedView
                style={{ height: SUB_SIZE * 1.5, width: "86%", alignItems: "center", justifyContent: "center", marginTop: 2 }}
                maskElement={
                  <Text
                    style={[styles.subText, { fontSize: SUB_SIZE }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {SUBTITLE}
                  </Text>
                }
              >
                <LinearGradient colors={TURQ_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </MaskedView>
            </View>

            {/* CARD / FORM */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.10)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                borderRadius: CARD_RADIUS,
                paddingHorizontal: PAD_H,
                paddingTop: PAD_V,
                paddingBottom: Math.round((isTiny ? 10 : 12) * scale),
              }}
            >
              <Text style={[styles.formTitle, { fontSize: Math.round(20 * scale), marginBottom: Math.round(10 * scale) }]}>
                Registro
              </Text>

              {/* Usuario */}
              <View style={[styles.inputRow, { height: INPUT_HEIGHT }]}>
                <Ionicons name="person-outline" size={18} color={PLACEHOLDER} style={styles.inputIcon} />
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
              <View style={[styles.inputRow, { height: INPUT_HEIGHT }]}>
                <Ionicons name="mail-outline" size={18} color={PLACEHOLDER} style={styles.inputIcon} />
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

              {/* Contraseña */}
              <View style={[styles.inputRow, { height: INPUT_HEIGHT }]}>
                <Ionicons name="lock-closed-outline" size={18} color={PLACEHOLDER} style={styles.inputIcon} />
                <TextInput
                  key={showPassword ? "text" : "password"}
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={styles.eyeBtn}
                >
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={PLACEHOLDER} />
                </TouchableOpacity>
              </View>

              {/* ===== Fecha de nacimiento (compacta, nunca se desborda) ===== */}
              <TouchableOpacity
                style={[styles.inputRow, { height: INPUT_HEIGHT }]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color={PLACEHOLDER} style={styles.inputIcon} />

                {/* contenedor de textos: permite encogerse */}
                <View style={styles.dobTextWrap}>
                  <Text style={styles.dobLabel} numberOfLines={1} adjustsFontSizeToFit>
                    Fecha de nacimiento
                  </Text>
                  <Text style={styles.dobValue} numberOfLines={1} ellipsizeMode="tail">
                    {dob ? dob.toLocaleDateString() : "Toca para elegir"}
                  </Text>
                </View>

                {/* icono chevron a la derecha */}
                <Ionicons name="chevron-forward" size={18} color={PLACEHOLDER} />
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
              <Text style={[styles.genderLabel, { marginTop: Math.round(6 * scale) }]}>Género</Text>
              <View style={styles.genderRow}>
                {[
                  { lbl: "Mujer", val: "F" as Gender },
                  { lbl: "Hombre", val: "M" as Gender },
                  { lbl: "Personalizado", val: "O" as Gender },
                ].map(({ lbl, val }) => (
                  <TouchableOpacity key={val} style={styles.radioOpt} onPress={() => setGender(val)}>
                    <Ionicons name={gender === val ? "radio-button-on" : "radio-button-off"} size={18} color="#C5E1A5" />
                    <Text style={styles.radioTxt}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Aviso legal */}
              <Text
                style={[styles.legalText, { marginTop: Math.round(6 * scale) }]}
                numberOfLines={isTiny ? 4 : undefined}
                adjustsFontSizeToFit={isTiny}
                minimumFontScale={0.85}
              >
                Al hacer clic en <Text style={{ fontWeight: "bold" }}>"Crear cuenta"</Text>, aceptas nuestras{" "}
                <Text style={styles.link} onPress={() => router.push("/terms")}>Condiciones</Text>, la{" "}
                <Text style={styles.link} onPress={() => router.push("/privacy")}>Política de privacidad</Text> y la{" "}
                <Text style={styles.link} onPress={() => router.push("/cookies")}>Política de cookies</Text>.
              </Text>

              {/* Botón */}
              <TouchableOpacity activeOpacity={0.9} onPress={handleRegister} style={{ marginTop: Math.round(10 * scale) }}>
                <LinearGradient
                  colors={TURQ_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    height: BTN_HEIGHT,
                    borderRadius: Math.round(26 * scale),
                    alignItems: "center",
                    justifyContent: "center",
                    elevation: 3,
                  }}
                >
                  <Text style={styles.btnText}>CREAR CUENTA</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Volver a login */}
              <TouchableOpacity
                style={{ marginTop: Math.round(8 * scale), alignItems: "center" }}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.backLoginText}>¿Ya tienes? Ingresa</Text>
              </TouchableOpacity>
            </View>

            {/* FOOTER */}
            <Text
              style={{
                textAlign: "center",
                color: "#C7CFD9",
                fontSize: 12,
                marginTop: Math.round((isShort ? 10 : 14) * scale),
              }}
            >
              from <Text style={{ fontWeight: "900", color: "#EAF6F8" }}>Prodigy Studios</Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ---------- ESTILOS base ---------- */
const styles = StyleSheet.create({
  fill: { flex: 1 },

  brandText: {
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
    color: "#fff",
  },
  subText: {
    fontWeight: "700",
    letterSpacing: 0.25,
    textAlign: "center",
    color: "#fff",
  },

  formTitle: {
    fontWeight: "800",
    color: "#EAF6F8",
    alignSelf: "center",
    letterSpacing: 0.4,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    color: "#EAF6F8",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 0,
    minWidth: 0, // por si acaso en Android
  },
  eyeBtn: { padding: 2, marginLeft: 6 },

  // ---- Fecha de nacimiento (anti-desborde) ----
  dobTextWrap: {
    flex: 1,
    minWidth: 0, // CLAVE: permite encoger el contenido en filas flex
  },
  dobLabel: {
    color: "#EAF6F8",
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 16,
  },
  dobValue: {
    color: "#D9F7F8",
    fontWeight: "700",
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },

  // Género
  genderLabel: { color: "#E8F5E9", fontSize: 13 },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  radioOpt: { flexDirection: "row", alignItems: "center" },
  radioTxt: { color: "#E8F5E9", marginLeft: 4, fontSize: 13 },

  // Legal y links
  legalText: { fontSize: 10.5, color: "#E0F2F1", lineHeight: 14.5 },
  link: { textDecorationLine: "underline", fontWeight: "bold", color: "#C5E1A5" },

  // Botón y enlaces
  btnText: { color: "#071217", fontWeight: "900", letterSpacing: 1, fontSize: 15 },
  backLoginText: {
    color: "#9EEFEF",
    fontWeight: "700",
    textDecorationLine: "underline",
    letterSpacing: 0.2,
    fontSize: 13,
  },
});
