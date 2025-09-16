import React from "react";
import { Modal, View, Image, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

export default function ImageViewerModal({ visible, uri, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.canvas}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: 40, right: 20, padding: 8 },
  canvas: { width: "92%", height: "80%", backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
