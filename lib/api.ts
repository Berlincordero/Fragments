// lib/api.ts
import { Platform } from "react-native";

/* ─────────────────── URL base ───────────────────
   • Android emulator: usa 10.0.2.2 para llegar al host
   • iOS simulator : usa 127.0.0.1
   • Dispositivo/Web: CAMBIA la IP por la de tu PC
-------------------------------------------------- */
const baseURL = Platform.select({
  android : "http://10.0.2.2:8000",
  ios     : "http://127.0.0.1:8000",
  default : "http://192.168.100.70:8000",
}) as string;

/** Concatena la base con un path (siempre incluye la barra inicial en `path`). */
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

  /* Guardados (listado general del usuario) 🔖 */
  fincaSaved      : () => api("/api/finca/saved/"),

  /* Reacciones ⭐ */
  fincaPostStar      : (id: number | string) => api(`/api/finca/posts/${id}/star/`),       // POST (toggle)
  fincaPostStarrers  : (id: number | string) => api(`/api/finca/posts/${id}/starrers/`),   // GET  (listado)

  /* Comentarios 💬 */
  fincaPostComments  : (postId: number | string) => api(`/api/finca/posts/${postId}/comments/`), // GET/POST
  fincaCommentDetail : (commentId: number | string) => api(`/api/finca/comments/${commentId}/`), // DELETE

  /* Compartidos por WhatsApp 📲 */
  fincaPostWhatsApp     : (id: number | string) => api(`/api/finca/posts/${id}/whatsapp/`),     // POST (idempotente)
  fincaPostWhatsappers  : (id: number | string) => api(`/api/finca/posts/${id}/whatsappers/`),  // GET

  /* Repost (compartir dentro de la app) 🔁 */
  fincaPostRepost     : (id: number | string) => api(`/api/finca/posts/${id}/repost/`),      // POST (idempotente)
  fincaPostReposters  : (id: number | string) => api(`/api/finca/posts/${id}/reposters/`),   // GET

  /* Guardados por post (toggle y listado) 🔖 */
  fincaPostSave    : (id: number | string) => api(`/api/finca/posts/${id}/save/`),     // POST (toggle)
  fincaPostSavers  : (id: number | string) => api(`/api/finca/posts/${id}/savers/`),   // GET  (listado)

  /* NUEVO: carrusel de portada (3 imágenes) */
  fincaCoverSlides : () => api("/api/finca/cover-slides/"), // GET (listar) / POST (subir/actualizar)
};
