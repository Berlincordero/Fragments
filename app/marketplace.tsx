import React from "react";
import { View, Text, StyleSheet, ImageBackground, ScrollView } from "react-native";
import { HeaderCenter, FooterBar } from "./components/NavBars";

const bgImage = require("../assets/images/fondo.png");

export default function MarketplaceScreen() {
  return (
    <ImageBackground source={bgImage} style={styles.bg} resizeMode="cover">
      <HeaderCenter />

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

const styles = StyleSheet.create({
  bg: { flex: 1 },
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
});
