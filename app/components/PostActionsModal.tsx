import React from "react";
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

/* ==== Tamaños sección "Esta publicación ha obtenido" (copiado del home) ==== */
const STATS_SIZES = { icon: 18, iconWrap: 30, label: 14, title: 16, badge: 12 } as const;

/* Tipos mínimos locales para evitar dependencias cruzadas */
export interface PostDTO {
  id: number;
  text: string | null;
  image: string | null;
  video: string | null;
  created_at: string;
  has_saved?: boolean;
  stars_count?: number;
  comments_count?: number;
  whatsapp_count?: number;
  reposts_count?: number;
  saves_count?: number;
}

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

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
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onSharePress: () => void | Promise<void>;
  onReport: () => void | Promise<void>;
  canEditDelete?: boolean;
  post?: PostDTO | null;
  onToggleSave: () => void;
}) {
  const stars = post?.stars_count ?? 0;
  const comments = post?.comments_count ?? 0;
  const whatsapp = post?.whatsapp_count ?? 0;
  const reposts = post?.reposts_count ?? 0;
  const saves = (post as any)?.saves_count ?? 0;

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

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={mStyles.modalSafe}>
        <View style={mStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={mStyles.headerTitle}>Opciones de publicación</Text>
          <View style={{ width: 92 }} />
        </View>

        <ScrollView
          style={mStyles.modalBody}
          contentContainerStyle={[
            mStyles.modalBodyContent,
            { paddingBottom: (insets?.bottom ?? 0) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
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
                  <Text style={mStyles.optionLabel}>Editar Contenido</Text>
                </TouchableOpacity>
                <TouchableOpacity style={mStyles.optionRow} onPress={onDelete}>
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color="#E53935"
                    style={{ width: 30 }}
                  />
                  <Text style={[mStyles.optionLabel, { color: "#ffb3b0" }]}>Eliminar Contenido</Text>
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
    </Modal>
  );
}

export default PostActionsModal;

/* ===== estilos locales (copiados del home para mantener look&feel) ===== */
const mStyles = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: "#262626" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1B1B1B",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 12, flex: 1 },
  publishBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  publishText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  // 👇 añadidos para el ScrollView
  modalBody: { flex: 1 },
  modalBodyContent: { paddingTop: 6, paddingBottom: 24 },
  userRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  userName: { color: "#fff", fontWeight: "700", marginLeft: 12, fontSize: 16 },
  textArea: { color: "#fff", fontSize: 18, paddingHorizontal: 16, textAlignVertical: "top" },
  previewMedia: { width: "92%", alignSelf: "center", aspectRatio: 1, borderRadius: 10 },
  quickList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#444" },
  quickRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  quickLabel: { color: "#e0e0e0", fontSize: 14 },
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
