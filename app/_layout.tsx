// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { endpoints } from "./api";

/* ==== Ajustes (tamaños/colores/rutas) ==== */
const AVATAR_SIZE = 85;               // tamaño del avatar en el header
const TITLE_MAX_WIDTH = 180;           // ancho máximo del texto "Bribri Social"
const MSG_ANIM_SIZE = 42;              // tamaño del Lottie de mensajes
const messageAnim = require("../assets/lottie/message.json"); // ruta del JSON
const MOCK_FOLLOWERS = 100;            // solo para DISEÑO ahora mismo
const MOCK_POSTS = "312";         // solo para DISEÑO ("publicaciones 3125 mil")

/* === Avatares de fallback === */
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");

/* === Tipos mínimos para el perfil === */
type Gender = "M" | "F" | "O";
type Profile = {
  username: string;
  display_name: string;
  avatar: string | null;
  gender: Gender | string | null;
  // cuando tengas el real del backend, añade:
  // followers_count?: number; posts_count?: number;
};

/* === Helper para decidir avatar === */
const getAvatarSource = (p?: Pick<Profile, "avatar" | "gender"> | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri };
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

/* === Título con avatar (avatar primero, seguidores / publicaciones debajo) === */
function BrandWithAvatar() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // si falla, seguimos con el fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const avatar = getAvatarSource(profile);

  return (
    <View style={styles.titleRow}>
      {/* Avatar + stats (en columna) */}
      <View style={styles.avatarWrap}>
        <TouchableOpacity
          onPress={() => router.push("/finca")} // cambia a "/config" si prefieres
          style={styles.avatarBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Image source={avatar} style={styles.avatarImg} />
          )}
        </TouchableOpacity>

        <Text style={styles.followersText}>
          {MOCK_FOLLOWERS} seguidores
          {/* reemplaza por: {profile?.followers_count ?? 0} seguidores */}
        </Text>
        <Text style={styles.postsText}>
          publicaciones {MOCK_POSTS}
          {/* reemplaza por: publicaciones {formatPosts(profile?.posts_count)} */}
        </Text>
      </View>

      {/* Texto de marca */}
      <Text style={styles.titleText} numberOfLines={1}>
        Fragmenta
      </Text>
    </View>
  );
}

/* === Header personalizado (controla altura con padding, sin headerStyle.height) === */
function CustomHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerRoot, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <BrandWithAvatar />
        <View style={styles.headerRight}>
          <LottieView
            source={messageAnim}
            autoPlay
            loop
            style={{ width: MSG_ANIM_SIZE, height: MSG_ANIM_SIZE }}
          />
        </View>
      </View>
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          header: () => <CustomHeader />, // usamos nuestro header (personalizado)
        }}
      >
        {/* Splash (index) */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Login y registro */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />

        {/* Home y demás */}
        <Stack.Screen name="home" options={{ headerBackVisible: false }} />
        <Stack.Screen name="marketplace" options={{ headerBackVisible: false }} />
        <Stack.Screen name="notificaciones" options={{ headerBackVisible: false }} />
        <Stack.Screen name="buscar" options={{ headerBackVisible: false }} />

        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="cookies" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen name="novedades" options={{ headerShown: false }} />
        <Stack.Screen name="finca" options={{ headerShown: false }} />
        <Stack.Screen name="config" options={{ headerShown: false }} />

        {/* Publicaciones guardadas (restaura el header nativo con back) */}
        <Stack.Screen
          name="guardados"
          options={{
            header: undefined, // volver al header nativo para esta pantalla
            headerTitle: "Publicaciones guardadas",
            headerBackVisible: true,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

/* ===== estilos ===== */
const styles = StyleSheet.create({
  /* Header */
  headerRoot: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#00000014",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 10, // ajusta para “dar altura”
  },
  headerRight: {
    paddingRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Contenido de la marca (avatar + nombre) */
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    fontWeight: "700",
    fontSize: 18,
    color: "#000",
    maxWidth: TITLE_MAX_WIDTH, // ajusta si el texto se corta
  },
  avatarWrap: {
    alignItems: "center",
    minWidth: AVATAR_SIZE, // mantiene la columna del avatar estable
  },
  avatarBtn: {
    paddingVertical: 2,
    paddingRight: 4,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: "#00000020",
  },
  followersText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },
  postsText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
  },
});
