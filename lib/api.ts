// lib/api.ts
import { Platform } from "react-native";
import * as Device from "expo-device";

/* ─────────────────── CONFIG RÁPIDA ───────────────────
   Cambia SOLO esta IP si tu PC cambia de IP LAN.
   Ahora mismo, tu PC (Wi-Fi) = 192.168.100.118:8000
------------------------------------------------------ */
const LAN_HOST = "http://192.168.100.118:8000";

/* Opciones especiales para simulación */
const ANDROID_EMULATOR = "http://10.0.2.2:8000";
const IOS_SIMULATOR    = "http://127.0.0.1:8000";

/* Permite override por variable de entorno:
   EXPO_PUBLIC_API_BASEURL=http://192.168.100.118:8000  */
const ENV_BASE =
  (process.env.EXPO_PUBLIC_API_BASEURL ??
   process.env.EXPO_PUBLIC_API_HOST ??
   process.env.EXPO_PUBLIC_API) as string | undefined;

function resolveBaseURL(): string {
  // 1) Si hay override por env, úsalo.
  if (ENV_BASE) return ENV_BASE;

  // 2) Si estamos en emulador/simulador, usa loopback especial.
  const isRealDevice = Device.isDevice === true;

  if (Platform.OS === "android") {
    return isRealDevice ? LAN_HOST : ANDROID_EMULATOR;
  }
  if (Platform.OS === "ios") {
    return isRealDevice ? LAN_HOST : IOS_SIMULATOR;
  }

  // 3) Web / otros: usa LAN (misma red).
  return LAN_HOST;
}

const baseURL = resolveBaseURL();

export const api = (path: string) => `${baseURL}${path}`;

/* ─────────────────── Endpoints ────────────────── */
export const endpoints = {
  /* Auth */
  register : () => api("/api/users/register/"),
  login    : () => api("/api/users/login/"),
  logout   : () => api("/api/users/logout/"),

  /* Mi finca (perfil propio) */
  finca           : () => api("/api/finca/"),
  fincaPosts      : () => api("/api/finca/posts/"),
  fincaPostDetail : (id: number | string) => api(`/api/finca/posts/${id}/`),

  /* Feed global */
  feedAll         : () => api("/api/finca/feed/"),

  /* Guardados */
  fincaSaved      : () => api("/api/finca/saved/"),

  /* Reacciones */
  fincaPostStar      : (id: number | string) => api(`/api/finca/posts/${id}/star/`),
  fincaPostStarrers  : (id: number | string) => api(`/api/finca/posts/${id}/starrers/`),

  /* Comentarios */
  fincaPostComments  : (postId: number | string) => api(`/api/finca/posts/${postId}/comments/`),
  fincaCommentDetail : (commentId: number | string) => api(`/api/finca/comments/${commentId}/`),

  /* WhatsApp */
  fincaPostWhatsApp     : (id: number | string) => api(`/api/finca/posts/${id}/whatsapp/`),
  fincaPostWhatsappers  : (id: number | string) => api(`/api/finca/posts/${id}/whatsappers/`),

  /* Repost */
  fincaPostRepost     : (id: number | string) => api(`/api/finca/posts/${id}/repost/`),
  fincaPostReposters  : (id: number | string) => api(`/api/finca/posts/${id}/reposters/`),

  /* Guardados por post */
  fincaPostSave    : (id: number | string) => api(`/api/finca/posts/${id}/save/`),
  fincaPostSavers  : (id: number | string) => api(`/api/finca/posts/${id}/savers/`),

  /* 👀 Vistas */
  fincaPostView    : (id: number | string) => api(`/api/finca/posts/${id}/view/`),

  /* 🔔 Suscripciones al autor */
  subscribeStatus : (username: string) =>
    api(`/api/finca/subscribe/${encodeURIComponent(username)}/status/`),
  subscribeToggle : (username: string) =>
    api(`/api/finca/subscribe/${encodeURIComponent(username)}/`),

  /* Suscripción por POST */
  fincaPostSubscribe   : (id: number | string) => api(`/api/finca/posts/${id}/subscribe/`),
  fincaPostSubscribers : (id: number | string) => api(`/api/finca/posts/${id}/subscribers/`),

  /* Carrusel de portada */
  fincaCoverSlides : () => api("/api/finca/cover-slides/"),

  /* ─────────── Chats ─────────── */
  chatsOpenDm: (username: string) =>
    api(`/api/chats/dm/${encodeURIComponent(username)}/`),

  chatsMessages: (roomId: number | string, page?: number) =>
    page
      ? api(`/api/chats/rooms/${roomId}/messages/?page=${page}`)
      : api(`/api/chats/rooms/${roomId}/messages/`),

  chatsMarkRead: (roomId: number | string) =>
    api(`/api/chats/rooms/${roomId}/read/`),

  chatsInbox : () => api("/api/chats/inbox/"),
  chatsRooms : () => api("/api/chats/rooms/"),
  chatsRoomDetail : (roomId: number | string) => api(`/api/chats/rooms/${roomId}/`),
};
