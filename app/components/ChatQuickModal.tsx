// app/components/ChatQuickModal.tsx
import React, { useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endpoints } from "../../lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  targetUsername: string;
  targetDisplayName: string;
  targetAvatar: string | null;
};

const avatarFallback = require("../../assets/images/avatar.png");

export default function ChatQuickModal({
  visible, onClose, targetUsername, targetDisplayName, targetAvatar,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ uri: string; name: string; type: string } | null>(null);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled) setImageUri(res.assets?.[0]?.uri ?? null);
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (!res.canceled) {
      const f = res.assets?.[0];
      if (f?.uri) setDoc({ uri: f.uri, name: f.name || "archivo", type: f.mimeType || "application/octet-stream" });
    }
  };

  const openRoomAndGo = async () => {
    try {
      setSending(true);
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) throw new Error("Sesión inválida");

      const res = await fetch(endpoints.chatsOpenDm(targetUsername), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.room_id) {
        throw new Error(data?.detail || "No se pudo abrir el chat");
      }

      if (imageUri || doc || text.trim()) {
        const msgUrl = endpoints.chatsMessages(data.room_id);
        if (imageUri || doc) {
          const fd = new FormData();
          if (imageUri) fd.append("image", { uri: imageUri, name: "image.jpg", type: "image/jpeg" } as any);
          if (doc) {
            fd.append("document", { uri: doc.uri, name: doc.name, type: doc.type } as any);
            fd.append("document_name", doc.name);
            fd.append("document_mime", doc.type);
          }
          if (text.trim()) fd.append("text", text.trim());
          await fetch(msgUrl, { method: "POST", headers: { Authorization: `Token ${tk}` }, body: fd });
        } else {
          await fetch(msgUrl, {
            method: "POST",
            headers: { Authorization: `Token ${tk}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.trim() }),
          });
        }
      }

      setText("");
      setImageUri(null);
      setDoc(null);
      onClose();

      router.push({
        pathname: "/conversation",
        params: {
          user: targetUsername,
          displayName: targetDisplayName || targetUsername,
          avatar: targetAvatar || "",
        },
      });
    } catch (e: any) {
      Alert.alert("Chat", e?.message || "No fue posible abrir el chat");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.header}>
            <Image source={targetAvatar ? { uri: targetAvatar } : avatarFallback} style={s.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{targetDisplayName || targetUsername}</Text>
              <Text style={s.subtitle}>Mensaje rápido</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={s.input}
            placeholder="Escribe un saludo..."
            placeholderTextColor="#bbb"
            value={text}
            onChangeText={setText}
            multiline
          />

          {/* Preview adjuntos simples */}
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 12 }}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={s.preview} />
            ) : null}
            {doc ? (
              <View style={s.docPill}>
                <Ionicons name="document-text-outline" size={16} color="#fff" />
                <Text numberOfLines={1} style={{ color: "#fff", maxWidth: 180 }}>{doc.name}</Text>
                <TouchableOpacity onPress={() => setDoc(null)}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={s.row}>
            <TouchableOpacity onPress={pickImage} style={s.attachBtn}>
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={s.attachTxt}>Imagen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickDocument} style={s.attachBtn}>
              <Ionicons name="attach-outline" size={18} color="#fff" />
              <Text style={s.attachTxt}>Archivo</Text>
            </TouchableOpacity>
          </View>

          <View style={s.row}>
            <TouchableOpacity onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openRoomAndGo} disabled={sending} style={[s.btn, s.btnPrimary, sending && { opacity: 0.6 }]}>
              {sending ? <ActivityIndicator color="#0a0" /> : (<><Ionicons name="paper-plane" size={16} color="#1a321a" /><Text style={s.btnPrimaryTxt}>Enviar y abrir chat</Text></>)}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:"rgba(0,0,0,0.55)", alignItems:"center", justifyContent:"center" },
  card:{ width:"90%", borderRadius:16, backgroundColor:"#111", borderWidth:1, borderColor:"rgba(255,255,255,0.1)" },
  header:{ flexDirection:"row", alignItems:"center", padding:12, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:"rgba(255,255,255,0.12)" },
  avatar:{ width:36, height:36, borderRadius:18, borderWidth:1.2, borderColor:"#fff", backgroundColor:"#000" },
  title:{ color:"#fff", fontWeight:"800" },
  subtitle:{ color:"#9ccc9c", fontSize:12 },
  closeBtn:{ width:28, height:28, borderRadius:8, alignItems:"center", justifyContent:"center", backgroundColor:"rgba(255,255,255,0.08)", marginLeft:8 },
  input:{ color:"#fff", minHeight:80, paddingHorizontal:12, paddingVertical:10 },
  row:{ flexDirection:"row", gap:10, padding:12, alignItems:"center" },
  btn:{ flex:1, height:42, borderRadius:12, alignItems:"center", justifyContent:"center" },
  btnGhost:{ borderWidth:1, borderColor:"rgba(255,255,255,0.18)" },
  btnGhostTxt:{ color:"#fff", fontWeight:"700" },
  btnPrimary:{ backgroundColor:"#C5E1A5", flexDirection:"row", gap:8, alignItems:"center", justifyContent:"center" },
  btnPrimaryTxt:{ color:"#0b0b0b", fontWeight:"800" },
  preview:{ width:72, height:72, borderRadius:10 },
  attachBtn:{ flexDirection:"row", alignItems:"center", gap:8, paddingHorizontal:12, paddingVertical:10, backgroundColor:"rgba(255,255,255,0.08)", borderRadius:10 },
  attachTxt:{ color:"#fff" },
  docPill:{ flexDirection:"row", alignItems:"center", gap:8, paddingHorizontal:10, paddingVertical:8, backgroundColor:"rgba(255,255,255,0.1)", borderRadius:10 },
});
