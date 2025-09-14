// components/CreatePostModal.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StyleSheet,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";

type Props = {
  visible: boolean;
  onClose: () => void;
  avatarSource: ImageSourcePropType;
  displayName: string;
  onPublish: (data: {
    text: string;
    uri?: string;
    mediaType?: "image" | "video";
  }) => Promise<void>;
  startWithPicker?: boolean;
  imagesOnly?: boolean;
  onAutoPickConsumed?: () => void;
};

/* =================== Crear publicación (EXTRAÍDO) =================== */
export default function CreatePostModal({
  visible,
  onClose,
  avatarSource,
  displayName,
  onPublish,
  startWithPicker = false,
  imagesOnly = false,
  onAutoPickConsumed,
}: Props) {
  const [text, setText] = useState("");
  const [mediaUri, setMediaUri] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<"image" | "video" | undefined>();
  const [mediaDim, setMediaDim] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: imagesOnly
        ? (ImagePicker as any).MediaType?.Images ??
          ImagePicker.MediaTypeOptions.Images
        : (ImagePicker as any).MediaType?.All ??
          ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      setMediaUri(asset.uri);
      setMediaType(
        (imagesOnly ? "image" : (asset as any).type) === "video" ? "video" : "image"
      );
      setMediaDim({
        w: (asset as any).width ?? 1,
        h: (asset as any).height ?? 1,
      });
    }
  };

  useEffect(() => {
    if (visible && startWithPicker) {
      (async () => {
        await pickMedia();
        onAutoPickConsumed?.();
      })();
    }
  }, [visible, startWithPicker]);

  const publish = async () => {
    if (!text.trim() && !mediaUri) return;
    try {
      setSaving(true);
      await onPublish({ text: text.trim(), uri: mediaUri, mediaType });
      setText("");
      setMediaUri(undefined);
      setMediaType(undefined);
      setMediaDim(null);
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo publicar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      setText("");
      setMediaUri(undefined);
      setMediaType(undefined);
      setMediaDim(null);
    }
  }, [visible]);

  const previewStyle = [
    mStyles.previewMedia,
    mediaDim ? { aspectRatio: mediaDim.w / mediaDim.h } : null,
  ] as any;

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={mStyles.modalSafe}>
        <View style={mStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={mStyles.headerTitle}>Crear publicación</Text>
          <TouchableOpacity
            style={[
              mStyles.publishBtn,
              !text.trim() && !mediaUri ? { opacity: 0.3 } : null,
            ]}
            disabled={(!text.trim() && !mediaUri) || saving}
            onPress={publish}
          >
            <Text style={mStyles.publishText}>{saving ? "..." : "PUBLICAR"}</Text>
          </TouchableOpacity>
        </View>

        <View style={mStyles.userRow}>
          <Image source={avatarSource} style={mStyles.userAvatar} />
          <Text style={mStyles.userName}>{displayName}</Text>
        </View>

        <TextInput
          style={[mStyles.textArea, { minHeight: 140 }]}
          multiline
          placeholder="¿Qué estás pensando?"
          placeholderTextColor="#ccc"
          value={text}
          onChangeText={setText}
        />

        {mediaUri &&
          (mediaType === "image" ? (
            <Image source={{ uri: mediaUri }} style={previewStyle} resizeMode="contain" />
          ) : (
            <Video
              source={{ uri: mediaUri }}
              resizeMode={ResizeMode.CONTAIN}
              style={previewStyle}
              useNativeControls
              shouldPlay={false}
              isLooping={false}
            />
          ))}

        <View style={mStyles.quickList}>
          <TouchableOpacity style={mStyles.quickRow} onPress={pickMedia}>
            <Ionicons
              name="image-outline"
              size={20}
              color="#43A047"
              style={{ width: 30 }}
            />
            <Text style={mStyles.quickLabel}>Foto / video</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* Solo los estilos que usa este modal (copiados tal cual de home.tsx) */
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
  userRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  userAvatar: { width: 42, height: 42, borderRadius: 21 },
  userName: { color: "#fff", fontWeight: "700", marginLeft: 12, fontSize: 16 },
  textArea: { color: "#fff", fontSize: 18, paddingHorizontal: 16, textAlignVertical: "top" },
  previewMedia: { width: "92%", alignSelf: "center", aspectRatio: 1, borderRadius: 10 },
  quickList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#444" },
  quickRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  quickLabel: { color: "#e0e0e0", fontSize: 14 },
});
