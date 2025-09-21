// app/components/PostActionsModal.tsx
import React from "react";
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

/* ==== Tamaños sección "Esta publicación ha obtenido" ==== */
const STATS_SIZES = { icon: 18, iconWrap: 30, label: 14, title: 16, badge: 12 } as const;

/** Tipos compatibles con tu FeedPost (home.tsx) */
export type MiniAuthor = {
  username: string;
  display_name: string;
  avatar: string | null;
};

export type FeedPostLike = {
  id: number;
  video: string | null;
  image?: string | null;
  content?: string | null;
  author?: MiniAuthor | null;
  // contadores y flags
  stars_count?: number;
  comments_count?: number;
  reposts_count?: number;
  saves_count?: number;
  has_saved?: boolean;
};

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  visible: boolean;
  onClose: () => void;

  /** Flujo de edición (solo se habilita si canEditDelete=true) */
  onEdit: () => void;

  /** Eliminar publicación (solo se habilita si canEditDelete=true) */
  onDelete: () => void | Promise<void>;

  /** Compartir por hoja del sistema u otros medios */
  onSharePress: () => void | Promise<void>;

  /** Reportar contenido (placeholder o flujo real) */
  onReport: () => void | Promise<void>;

  /** Si el post activo es mío, muestra Editar/Eliminar */
  canEditDelete?: boolean;

  /** Post activo (del feed) */
  post?: FeedPostLike | null;

  /** Toggle de guardados 🔖 (reutiliza tu handleToggleSave de home.tsx) */
  onToggleSave: () => void;
};

function PostActionsModal({
  visible,
  onClose,
  onEdit,
  onDelete,
  onSharePress,
  onReport,
  canEditDelete = false,
  post,
  onToggleSave,
}: Props) {
  // Contadores seguros
  const stars = post?.stars_count ?? 0;
  const comments = post?.comments_count ?? 0;
  const whatsapp = 0; // si lo necesitas, pásalo como prop más adelante
  const reposts = post?.reposts_count ?? 0;
  const saves = post?.saves_count ?? 0;

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const sharedVerb = (n: number) => (n === 1 ? "compartió" : "compartieron");

  const StatLine = ({
    icon,
    tint,
    bg,
    label,
    count,
    muted = false,
  }: {
    icon: IconName;
    tint: string;
    bg: string;
    label: string;
    count: number;
    muted?: boolean;
  }) => (
    <View style={[mStyles.statLine, muted && mStyles.statLineDisabled]}>
      <View style={[mStyles.statIconWrap, { borderColor: tint, backgroundColor: bg }]}>
        <Ionicons name={icon} size={STATS_SIZES.icon} color={tint} />
      </View>
      <Text style={[mStyles.statLabel, muted && mStyles.statLabelMuted]}>{label}</Text>
      <View style={[mStyles.badge, { borderColor: tint }]}>
        <Text style={[mStyles.badgeText, { color: tint }]}>{count}</Text>
      </View>
    </View>
  );

  const insets = useSafeAreaInsets();

  const confirmDelete = () => {
    if (!canEditDelete) return;
    Alert.alert(
      "Eliminar publicación",
      "Esta acción no se puede deshacer. ¿Deseas continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => onDelete() },
      ],
    );
  };

  return (
    <Modal animationType={Platform.select({ ios: "slide", android: "fade" })} visible={visible} onRequestClose={onClose} transparent>
      <View style={mStyles.backdrop}>
        <SafeAreaView style={mStyles.modalSafe}>
          {/* Header */}
          <View style={mStyles.modalHeader}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={mStyles.headerTitle}>Opciones de publicación</Text>
            {/* espacio para alinear */}
            <View style={{ width: 26 }} />
          </View>

          {/* Body */}
          <ScrollView
            style={mStyles.modalBody}
            contentContainerStyle={[
              mStyles.modalBodyContent,
              { paddingBottom: (insets?.bottom ?? 0) + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {/* Acciones principales */}
            <View style={mStyles.quickList}>
              {canEditDelete && (
                <>
                  <TouchableOpacity style={mStyles.optionRow} onPress={onEdit}>
                    <Ionicons
                      name="create-outline"
                      size={22}
                      color="#C5E1A5"
                      style={{ width: 30 }}
                    />
                    <Text style={mStyles.optionLabel}>Editar contenido</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={mStyles.optionRow} onPress={confirmDelete}>
                    <Ionicons
                      name="trash-outline"
                      size={22}
                      color="#E53935"
                      style={{ width: 30 }}
                    />
                    <Text style={[mStyles.optionLabel, { color: "#ffb3b0" }]}>Eliminar contenido</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* 🔖 Guardar / desguardar */}
              <TouchableOpacity style={mStyles.optionRow} onPress={onToggleSave}>
                <Ionicons
                  name={post?.has_saved ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color="#C5E1A5"
                  style={{ width: 30 }}
                />
                <Text style={mStyles.optionLabel}>
                  {post?.has_saved ? "Quitar de guardados" : "Guardar esta publicación"}
                </Text>
              </TouchableOpacity>

              {/* Acciones sociales extra (placeholders listos para conectar) */}
              <TouchableOpacity style={mStyles.optionRow} onPress={() => {}}>
                <Ionicons name="person-add-outline" size={22} color="#81C784" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Seguir este perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mStyles.optionRow} onPress={() => {}}>
                <Ionicons name="pricetags-outline" size={22} color="#C5E1A5" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Ver más contenido de este tipo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mStyles.optionRow} onPress={() => {}}>
                <Ionicons name="eye-off-outline" size={22} color="#FFB74D" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Ocultar todo contenido de este tipo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mStyles.optionRow} onPress={() => {}}>
                <Ionicons name="person-remove-outline" size={22} color="#E57373" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Bloquear perfil/usuario</Text>
              </TouchableOpacity>

              {/* Compartir externo */}
              <TouchableOpacity style={mStyles.optionRow} onPress={onSharePress}>
                <Ionicons name="share-social-outline" size={22} color="#C5E1A5" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Compartir por otros medios…</Text>
              </TouchableOpacity>

              {/* Reportar */}
              <TouchableOpacity style={mStyles.optionRow} onPress={onReport}>
                <Ionicons name="flag-outline" size={22} color="#FFB74D" style={{ width: 30 }} />
                <Text style={mStyles.optionLabel}>Reportar publicación</Text>
              </TouchableOpacity>
            </View>

            {/* ------- Métricas de la publicación ------- */}
            <View style={mStyles.statsCard}>
              <View style={mStyles.statsHeader}>
                <Ionicons name="information-circle-outline" size={STATS_SIZES.icon + 2} color="#9ccc9c" />
                <Text style={mStyles.statsTitle}>Esta publicación ha obtenido</Text>
              </View>

              <View style={mStyles.separator} />

              <StatLine
                icon="star"
                tint="#FFD54F"
                bg="rgba(255,213,79,0.09)"
                count={stars}
                label={`Tiene ${stars} ${plural(stars, "estrella", "estrellas")}`}
                muted={stars === 0}
              />

              <StatLine
                icon="chatbubble-ellipses-outline"
                tint="#A5D6A7"
                bg="rgba(165,214,167,0.08)"
                count={comments}
                label={`Ha sido comentada ${comments} ${plural(comments, "vez", "veces")}`}
                muted={comments === 0}
              />

              <StatLine
                icon="logo-whatsapp"
                tint="#25D366"
                bg="rgba(37,211,102,0.08)"
                count={whatsapp}
                label={`Ha sido compartida por WhatsApp ${whatsapp} ${plural(whatsapp, "vez", "veces")}`}
                muted={whatsapp === 0}
              />

              <StatLine
                icon="share-outline"
                tint="#C5E1A5"
                bg="rgba(197,225,165,0.08)"
                count={reposts}
                label={`${reposts} ${plural(reposts, "usuario", "usuarios")} ${sharedVerb(reposts)} esta publicación`}
                muted={reposts === 0}
              />

              {/* 🔖 Guardados: tap para alternar */}
              <TouchableOpacity activeOpacity={0.8} onPress={onToggleSave}>
                <StatLine
                  icon={post?.has_saved ? "bookmark" : "bookmark-outline"}
                  tint="#C5E1A5"
                  bg="rgba(197,225,165,0.08)"
                  count={saves}
                  label={`Esta publicación se ha guardado ${saves} ${plural(saves, "vez", "veces")}`}
                  muted={saves === 0}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default PostActionsModal;

/* ===== estilos ===== */
const mStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSafe: { flex: 1, backgroundColor: "#262626", borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1B1B1B",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 12, flex: 1 },
  publishBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  publishText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  modalBody: { flex: 1 },
  modalBodyContent: { paddingTop: 6, paddingBottom: 24 },

  quickList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#444" },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 18,
    marginVertical: 6,
  },
  optionLabel: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },

  /* --- tarjeta de métricas --- */
  statsCard: {
    marginTop: 12,
    marginHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  statsHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  statsTitle: { color: "#e0e0e0", fontSize: STATS_SIZES.title, fontWeight: "900" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#3a3a3a", marginHorizontal: 16, opacity: 0.7 },

  statLine: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  statLineDisabled: { opacity: 0.55 },
  statIconWrap: {
    width: STATS_SIZES.iconWrap,
    height: STATS_SIZES.iconWrap,
    borderRadius: STATS_SIZES.iconWrap / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statLabel: { flex: 1, color: "#e0e0e0", fontSize: STATS_SIZES.label, fontWeight: "700", marginLeft: 12 },
  statLabelMuted: { color: "#9e9e9e" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontWeight: "900", fontSize: STATS_SIZES.badge },
});
