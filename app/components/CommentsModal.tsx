import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints } from "../../lib/api";  // 👈 dos niveles hacia arriba

// ✅ correcto desde app/components/*
const avatarMale = require("../../assets/images/avatar.png");
const avatarFemale = require("../../assets/images/avatar_female.png");
const avatarNeutral = require("../../assets/images/avatar_neutral.png");;

type CommentUser = { username: string; display_name: string; avatar: string | null };
type CommentDTO = {
  id: number;
  text: string;
  created_at: string;
  parent: number | null;
  user: CommentUser;
  replies: CommentDTO[];
};

const getAvatarSource = (p?: { avatar?: string | null; gender?: string | null } | null) => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri };
  const g = String(p?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

export default function CommentsModal({
  visible,
  postId,
  onClose,
  onCountChange,
}: {
  visible: boolean;
  postId: number | null;
  onClose: () => void;
  onCountChange: (newCount: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleThread = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const CollapsibleText = ({
    children,
    numberOfLines = 3,
  }: {
    children: React.ReactNode;
    numberOfLines?: number;
  }) => {
    const [showAll, setShowAll] = useState(false);
    const [truncated, setTruncated] = useState(false);
    return (
      <View>
        <Text
          style={cmStyles.text}
          numberOfLines={showAll ? undefined : numberOfLines}
          onTextLayout={(e) => {
            if (!showAll && !truncated && e.nativeEvent.lines.length > numberOfLines)
              setTruncated(true);
          }}
        >
          {children}
        </Text>
        {truncated ? (
          <TouchableOpacity onPress={() => setShowAll(!showAll)}>
            <Text style={cmStyles.showMore}>{showAll ? "Ver menos" : "Ver más"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const fetchComments = async (pid: number) => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) return;
    setLoading(true);
    try {
      const res = await fetch(endpoints.fincaPostComments(pid), {
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      setList(Array.isArray(data.results) ? data.results : []);
      onCountChange(Number(data.count || 0));
    } catch {
      Alert.alert("Error", "No se pudieron cargar los comentarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && postId) fetchComments(postId);
  }, [visible, postId]);

  const addReplyInTree = (
    arr: CommentDTO[],
    parentId: number,
    newItem: CommentDTO
  ): CommentDTO[] =>
    arr.map((c) => {
      if (c.id === parentId) return { ...c, replies: [...(c.replies || []), newItem] };
      if (c.replies?.length) return { ...c, replies: addReplyInTree(c.replies, parentId, newItem) };
      return c;
    });

  const send = async () => {
    if (!postId) return;
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) return;
    const val = text.trim();
    if (!val) return;
    try {
      setSending(true);
      const res = await fetch(endpoints.fincaPostComments(postId), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${tk}` },
        body: JSON.stringify({ text: val, parent: replyTo?.id ?? null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const created: CommentDTO = data.created;

      if (replyTo) {
        setList((prev) => addReplyInTree(prev, replyTo.id, created));
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(replyTo.id);
          return next;
        });
      } else {
        setList((prev) => [...prev, created]);
      }
      onCountChange(Number(data.count || 0));
      setText("");
      setReplyTo(null);
    } catch {
      Alert.alert("Error", "No se pudo comentar");
    } finally {
      setSending(false);
    }
  };

  const renderComment = (c: CommentDTO, level = 0, parentName?: string) => {
    const isReply = level > 0;
    const leftPad = { paddingLeft: isReply ? 24 : 0 };
    return (
      <View key={`${c.id}-${level}`} style={[cmStyles.item, leftPad]}>
        <Image
          source={c.user?.avatar ? { uri: c.user.avatar } : getAvatarSource(null)}
          style={cmStyles.avatar}
        />
        <View style={cmStyles.body}>
          <Text style={cmStyles.name} numberOfLines={1} ellipsizeMode="tail">
            {c.user?.display_name || c.user?.username || "Usuario"}
          </Text>

          <CollapsibleText numberOfLines={3}>
            {isReply && parentName ? (
              <Text style={cmStyles.replyPrefix}>↪ {parentName}: </Text>
            ) : null}
            {c.text}
          </CollapsibleText>

          <View style={cmStyles.metaRow}>
            <Text style={cmStyles.time}>{new Date(c.created_at).toLocaleString()}</Text>
            <TouchableOpacity
              onPress={() =>
                setReplyTo({
                  id: c.id,
                  name: c.user?.display_name || c.user?.username || "usuario",
                })
              }
            >
              <Text style={cmStyles.replyBtn}>Responder</Text>
            </TouchableOpacity>
          </View>

          {c.replies?.length ? (
            !expanded.has(c.id) ? (
              <TouchableOpacity onPress={() => toggleThread(c.id)} style={{ marginTop: 6 }}>
                <Text style={cmStyles.viewReplies}>Ver respuestas ({c.replies.length})</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => toggleThread(c.id)} style={{ marginTop: 6 }}>
                  <Text style={cmStyles.viewReplies}>Ocultar respuestas</Text>
                </TouchableOpacity>
                {c.replies.map((r) =>
                  renderComment(
                    r,
                    level + 1,
                    c.user?.display_name || c.user?.username || "usuario"
                  )
                )}
              </>
            )
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={mStyles.modalSafe}>
        <View style={mStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={mStyles.headerTitle}>Comentarios</Text>
          <View style={{ width: 92 }} />
        </View>

        {loading ? (
          <View style={mStyles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.select({ ios: "padding", android: undefined })}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {list.length ? (
                list.map((c) => renderComment(c, 0))
              ) : (
                <Text style={{ color: "#bbb", textAlign: "center", marginTop: 20 }}>
                  Sé el primero en comentar
                </Text>
              )}
            </ScrollView>

            <View style={cmStyles.inputRow}>
              {replyTo ? (
                <TouchableOpacity onPress={() => setReplyTo(null)} style={cmStyles.replyTag}>
                  <Ionicons name="return-down-back-outline" size={14} color="#1B5E20" />
                  <Text style={cmStyles.replyTagText}>Responder a {replyTo.name}</Text>
                </TouchableOpacity>
              ) : null}
              <View style={cmStyles.inputWrap}>
                <TextInput
                  style={cmStyles.input}
                  placeholder={replyTo ? `Escribe tu respuesta…` : "Escribe un comentario…"}
                  placeholderTextColor="#9e9e9e"
                  value={text}
                  onChangeText={setText}
                  multiline
                />
                <TouchableOpacity onPress={send} disabled={sending || !text.trim()} style={cmStyles.sendBtn}>
                  <Ionicons name="send" size={18} color={text.trim() ? "#fff" : "#999"} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});

const cmStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomColor: "rgba(255,255,255,0.07)",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10, marginTop: 2, backgroundColor: "#000" },
  body: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontWeight: "700", fontSize: 13 },
  text: { color: "#eaeaea", marginTop: 2, fontSize: 13, flexShrink: 1 },
  replyPrefix: { color: "#C5E1A5", fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" },
  time: { color: "#9ccc9c", fontSize: 11 },
  replyBtn: { color: "#C5E1A5", fontSize: 12, fontWeight: "700" },
  viewReplies: { color: "#9ccc9c", marginTop: 2, fontSize: 12, fontWeight: "700" },
  showMore: { color: "#9ccc9c", marginTop: 4, fontSize: 12, fontWeight: "700" },
  inputRow: { padding: 12, borderTopColor: "#333", borderTopWidth: StyleSheet.hairlineWidth },
  replyTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C8E6C9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  replyTagText: { color: "#1B5E20", fontWeight: "700", fontSize: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingLeft: 12,
  },
  input: { flex: 1, color: "#fff", paddingVertical: 8, paddingRight: 8, minHeight: 38, maxHeight: 120 },
  sendBtn: { paddingHorizontal: 12, paddingVertical: 8 },
});
