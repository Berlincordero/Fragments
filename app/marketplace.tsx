// app/marketplace.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const bgImage = require("../assets/images/fondo.png");

/* ────────── Header y Footer inline ────────── */
const HeaderCenter: React.FC<{ title?: string; onBack?: () => void }> = ({
  title = "Marketplace",
  onBack,
}) => (
  <SafeAreaView>
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.85}
        style={styles.headerSide}
      >
        {onBack ? <Ionicons name="chevron-back" size={24} color="#fff" /> : null}
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </View>

      <View style={styles.headerSide} />
    </View>
  </SafeAreaView>
);

const FooterBar: React.FC<{
  tabs?: Array<{ key: string; label: string; active?: boolean; onPress?: () => void }>;
}> = ({
  tabs = [
    { key: "home", label: "Inicio", active: true },
    { key: "sell", label: "Vender" },
    { key: "orders", label: "Pedidos" },
    { key: "account", label: "Cuenta" },
  ],
}) => (
  <SafeAreaView>
    <View style={styles.footer}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          onPress={t.onPress}
          activeOpacity={0.85}
          style={[styles.footerBtn, t.active && styles.footerBtnActive]}
        >
          <Text style={[styles.footerTxt, t.active && styles.footerTxtActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </SafeAreaView>
);

/* ────────── Pantalla ────────── */
export default function MarketplaceScreen() {
  return (
    <ImageBackground source={bgImage} style={styles.bg} resizeMode="cover">
      <HeaderCenter title="Marketplace Agro" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Marketplace Agro</Text>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            Aquí aparecerán los productos y servicios del agro.
          </Text>
        </View>
      </ScrollView>

      <FooterBar />
    </ImageBackground>
  );
}

/* ────────── Estilos ────────── */
const styles = StyleSheet.create({
  bg: { flex: 1 },

  /* Header */
  header: {
    height: 56,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
  },
  headerSide: { width: 48, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  /* Contenido */
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
  },
  cardText: { color: "#E0F2F1", fontSize: 16, textAlign: "center" },

  /* Footer */
  footer: {
    height: 56,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  footerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  footerBtnActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  footerTxt: { color: "rgba(255,255,255,0.9)", fontWeight: "700" },
  footerTxtActive: { color: "#fff" },
});
