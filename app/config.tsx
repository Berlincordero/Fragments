import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

const bgImage = require("../assets/images/fondo.png");

export default function ConfigScreen() {
  const router = useRouter();

  return (
    <ImageBackground source={bgImage} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>
        <Text style={styles.title}>Configuraciones</Text>

        <View style={styles.card}>
          <Text style={styles.cardText}>
             cambiar la configuración de  cuenta y la app.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/")}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backText}>Volver al menú</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  /* mismos estilos que las otras pantallas */
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { color: "#E0F2F1", fontSize: 16, textAlign: "center" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 24,
  },
  backText: { color: "#fff", marginLeft: 6, fontWeight: "700" },
});
