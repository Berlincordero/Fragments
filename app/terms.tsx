// app/terms.tsx  ← CONDICIONES (estilo FRAGMENTS + degradado + reflejo)
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/* =========================
   Ajustes rápidos (tamaños/colores/efectos)
   ========================= */

// Marca mostrada en el título
const BRAND = "FRAGMENTS";

// Tamaños
const ICON_SIZE = 84;     // ícono puzzle
const TITLE_SIZE = 22;    // tamaño del título "Condiciones de FRAGMENTS"

// Degradado de fondo (matching login/splash)
const BG_GRADIENT = ["#0B131A", "#121C25", "#18242F"] as const;

// Degradado turquesa (matching login actualizado)
const TURQ_GRADIENT = ["#00F7B0", "#ffffffff", "#fa0089ff"] as const;

// Reflejo del ícono
const REFLECTION_OPACITY = 0.32;
const REFLECTION_HEIGHT_FACTOR = 0.50; // 0.5 = mitad del ícono
const REFLECTION_FADE_COLORS = ["#000", "transparent"] as const;
/* ========================= */

export default function TermsScreen() {
  const router = useRouter();
  const reflectionHeight = Math.round(ICON_SIZE * REFLECTION_HEIGHT_FACTOR);

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* HEADER: ícono con degradado + reflejo + título en degradado */}
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
          maskElement={
            <Text style={[styles.titleText, { fontSize: TITLE_SIZE }]}>
              {`Condiciones de ${BRAND}`}
            </Text>
          }
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
          1. Uso del servicio{"\n\n"}
          El uso de Fragments está sujeto a las siguientes condiciones.
          Todo usuario debe ser mayor de 18 años queda claro esta condicion si se viola la politica de la misma y un menor de edad se registra ya que la plataforma permite registrarse y la usa se debe abstener de cualquier responsabilidad de la plataforma ya que esto se tomara como violacion de politicas y condiciones excepto que al mismo se le otorgue el permiso por parte del tutor legal de su uso y contenido en dicho caso dicho tutor legal tendra las responsabilidades de dicho uso y supervision. Esta plataforma es
          exclusivamente agropecuaria, el contenido de la misma es regulado y
          no se aceptará otro tipo de contenido y al usuario se le sancionara con advertencias y finalmente con la desactivacion de la cuenta. Nuestra misión es conectar a
          la agropecuaria con todas las personas que aman la agricultura y la
          naturaleza, por ello, el usuario está obligado a usarla para dichos
          fines. Si el usuario no lo hace, será eliminado de la plataforma y
          se eliminará su contenido . Cualquier intento de estafa, de acoso sexual,
          contenido ilegal o pornografico, intento de delitos con menores o
          cualquier delito sera notificado a la policia y autoridades judiciales
          y se dara colaboracion absoluta como informacion requerida por las mismas
          para que procedan contra dicha persona o usuario{"\n\n"}
          2. Responsabilidades del usuario{"\n\n"}
          El usuario es responsable de la información que comparte en
          Bribri Social. No se permite el uso de lenguaje ofensivo, contenido
          ilegal o cualquier actividad que pueda dañar la reputación de la
          plataforma. El contenido que el usuario sube es propiedad de la
          plataforma.{"\n\n"}
          3. Propiedad intelectual{"\n\n"}
          El usuario concede a Bribri Social una licencia no exclusiva,
          mundial y libre de regalías para usar, reproducir y distribuir el
          contenido que sube a la plataforma. El usuario garantiza que tiene
          los derechos necesarios para otorgar esta licencia. El contenido,
          diseño y estructura de Bribri Social son propiedad de la plataforma
          y están protegidos por derechos de autor y otras leyes de propiedad
          intelectual.{"\n\n"}
          4. Privacidad y protección de datos{"\n\n"}
          Bribri Social se compromete a proteger la privacidad de sus
          usuarios. La información personal recopilada se utilizará de acuerdo
          con nuestra política de privacidad.{"\n\n"}
          5. Limitación de responsabilidad{"\n\n"}
          El usuario acepta que Bribri Social no será responsable de ningún
          daño directo, indirecto o incidental que surja del uso de la
          plataforma. La plataforma no garantiza la disponibilidad continua
          del servicio y se reserva el derecho de suspenderlo temporalmente
          por mantenimiento o mejoras.{"\n\n"}
          6. Modificaciones de las condiciones{"\n\n"}
          Cuando Bribri Social realice cambios en estas condiciones, se
          notificará a los usuarios a través de la plataforma. El uso
          continuado del servicio después de la modificación implica la
          aceptación de las nuevas condiciones.{"\n\n"}
          7. Ley aplicable y jurisdicción{"\n\n"}
          Bribri Social se rige por las leyes del país en el que opera.
          Cualquier disputa relacionada con estas condiciones se resolverá en
          los tribunales competentes de dicho país.{"\n\n"}
          ────────────────────────────{"\n\n"}
        </Text>
      </ScrollView>

      {/* BOTÓN VOLVER (degradado) */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.replace("/register")} style={styles.btnOuter}>
        <LinearGradient colors={TURQ_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
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
