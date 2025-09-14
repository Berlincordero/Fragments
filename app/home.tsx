// app/home.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Linking,
  Share,
  Dimensions,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Video,
  ResizeMode,
  VideoFullscreenUpdate,
  AVPlaybackStatusSuccess,
} from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import LottieView from "lottie-react-native";
import { endpoints } from "./api";

/* === Componentes extraídos === */
import CreatePostModal from "./components/CreatePostModal";
import StarrersModal from "./components/StarrersModal";
import WhatsappersModal from "./components/WhatsappersModal";
import RepostersModal from "./components/RepostersModal";
import CommentsModal from "./components/CommentsModal";
import PostActionsModal from "./components/PostActionsModal";

/* ==== Tamaños sección "Esta publicación ha obtenido" ==== */
const STATS_SIZES = { icon: 18, iconWrap: 30, label: 14, title: 16, badge: 12 };

/* assets */
const bgImage = require("../assets/images/fondo.png");
const avatarMale = require("../assets/images/avatar.png");
const avatarFemale = require("../assets/images/avatar_female.png");
const avatarNeutral = require("../assets/images/avatar_neutral.png");
const welcomeAnim = require("../assets/lottie/welcome.json");

/* Tipos */
type Gender = "M" | "F" | "O";
interface ProfileDTO {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  bio: string;
  date_of_birth: string | null;
  gender: Gender | string | null;
  avatar: string | null;
  cover: string | null;
}
interface PostAuthor {
  username: string;
  display_name: string;
  avatar: string | null;
}
interface StarrUser {
  username: string;
  display_name: string;
  avatar: string | null;
}
interface CommentUser {
  username: string;
  display_name: string;
  avatar: string | null;
}
interface CommentDTO {
  id: number;
  text: string;
  created_at: string;
  parent: number | null;
  user: CommentUser;
  replies: CommentDTO[];
}
interface RepostPreview {
  id: number;
  author: PostAuthor;
  content?: string | null;
  image?: string | null;
  video?: string | null;
  created_at: string;
}
export interface PostDTO {
  id: number;
  text: string | null;
  image: string | null;
  video: string | null;
  created_at: string;
  author?: PostAuthor;
  content?: string | null;
  repost_of?: RepostPreview | null;
  reposts_count?: number;
  has_reposted?: boolean;
  repost_sample?: StarrUser[];
  first_reposter?: StarrUser | null;
  stars_count?: number;
  has_starred?: boolean;
  stars_sample?: StarrUser[];
  first_starrer?: StarrUser | null;
  comments_count?: number;
  whatsapp_count?: number;
  has_shared_whatsapp?: boolean;
  whatsapp_sample?: StarrUser[];
  first_whatsapper?: StarrUser | null;
  saves_count?: number;
  has_saved?: boolean;
}

/* Helper avatar (tipado) */
const getAvatarSource = (
  p?: Pick<ProfileDTO, "avatar" | "gender"> | null
): ImageSourcePropType => {
  const uri = p?.avatar ? String(p.avatar).trim() : "";
  if (uri) return { uri };
  const g = String((p as any)?.gender ?? "").trim().toLowerCase();
  if (g.startsWith("f")) return avatarFemale;
  if (g.startsWith("m")) return avatarMale;
  return avatarNeutral;
};

/* =================== Video (feed + fullscreen con HUD) =================== */
type OverlayActions = {
  has_starred?: boolean;
  stars_count?: number;
  comments_count?: number;
  whatsapp_count?: number;
  has_reposted?: boolean;
  reposts_count?: number;
  has_saved?: boolean;
  onStar?: () => void;
  onOpenComments?: () => void;
  onWhatsApp?: () => void;
  onRepost?: () => void;
  onSave?: () => void;
};

function PostVideo({
  id,
  uri,
  overlay,
  viewportHeight,
  scrollTick,
  activeId,
  onVisibility,
  maxPlays = 3,
}: {
  id: string;
  uri: string;
  overlay?: OverlayActions;
  viewportHeight: number;
  scrollTick: number;
  activeId: string | null;
  onVisibility: (id: string, ratio: number) => void;
  maxPlays?: number;
}) {
  const containerRef = useRef<View>(null);
  const feedRef = useRef<Video>(null);
  const fsRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(false);
  const [, setIsLoaded] = useState(false); // omitimos el valor para evitar warning

  const lastTap = useRef(0);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef = useRef(false);

  const showHUD = (ms = 1200) => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), ms);
  };
  useEffect(() => {
    return () => {
      if (hudTimer.current) {
        clearTimeout(hudTimer.current);
        hudTimer.current = null;
      }
    };
  }, []);

  const MAX_PLAYS = Math.max(1, Number(maxPlays ?? 3));
  const playCountRef = useRef(0);
  const finishGuardRef = useRef(false);

  const fsPendingRef = useRef<{
    positionMillis: number;
    shouldPlay: boolean;
    volume: number;
    isMuted: boolean;
  } | null>(null);

  const getActive = () => (fsOpen ? fsRef.current : feedRef.current);
  const getPassive = () => (fsOpen ? feedRef.current : fsRef.current);

  const playActive = async () => {
    try { await getPassive()?.pauseAsync(); } catch {}
    try { await getActive()?.playAsync(); } catch {}
    setIsPlaying(true);
    userPausedRef.current = false;
  };
  const pauseActive = async () => {
    try { await getActive()?.pauseAsync(); } catch {}
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (ended) return;
    if (isPlaying) {
      userPausedRef.current = true;
      pauseActive();
    } else {
      playActive();
    }
  };

  const replayBoth = async () => {
    playCountRef.current = 0;
    try { await getActive()?.setPositionAsync(0); } catch {}
    try { await getPassive()?.setPositionAsync(0); } catch {}
    setEnded(false);
    playActive();
    showHUD();
  };

  const seekBy = async (deltaMs: number) => {
    try {
      const st: any = await getActive()?.getStatusAsync();
      const dur = Math.max(0, Number(st?.durationMillis ?? 0));
      const pos = Math.max(0, Math.min(dur, Number(st?.positionMillis ?? 0) + deltaMs));
      await getActive()?.setPositionAsync(pos);
      await getPassive()?.setPositionAsync(pos);
      showHUD();
    } catch {}
  };

  const onStatus = (s: AVPlaybackStatusSuccess, origin: "feed" | "fs") => {
    const originIsActive = fsOpen ? origin === "fs" : origin === "feed";
    if (!originIsActive || !s.isLoaded) return;

    setIsLoaded(true);
    setIsPlaying(!!s.isPlaying);

    if (s.didJustFinish) {
      if (finishGuardRef.current) return;
      finishGuardRef.current = true;
      setTimeout(() => { finishGuardRef.current = false; }, 150);

      if (playCountRef.current < MAX_PLAYS - 1 && !userPausedRef.current) {
        playCountRef.current += 1;
        (async () => {
          try {
            await getActive()?.setPositionAsync(0);
            await getPassive()?.setPositionAsync(0);
            setEnded(false);
            await playActive();
          } catch {}
        })();
      } else {
        setEnded(true);
        setIsPlaying(false);
        setHudVisible(true);
      }
    }
  };

  const openFS = async () => {
    try {
      const st: any = await feedRef.current?.getStatusAsync();
      fsPendingRef.current = {
        positionMillis: st?.positionMillis ?? 0,
        shouldPlay: !!(st?.isPlaying ?? st?.shouldPlay ?? false),
        volume: st?.volume ?? 1,
        isMuted: st?.isMuted ?? false,
      };
      setFsOpen(true);
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {}
      setIsPlaying(!!st?.isPlaying);
      if (st?.isPlaying) {
        try { await feedRef.current?.pauseAsync(); } catch {}
      }
    } catch {}
  };

  const closeFS = async () => {
    try {
      const st: any = await fsRef.current?.getStatusAsync();
      await feedRef.current?.setStatusAsync({
        positionMillis: st?.positionMillis ?? 0,
        shouldPlay: !!(st?.isPlaying ?? false),
        volume: st?.volume ?? 1,
        isMuted: st?.isMuted ?? false,
      });
      setIsPlaying(!!st?.isPlaying);
      if (st?.isPlaying) {
        try { await feedRef.current?.playAsync(); } catch {}
      }
    } finally {
      setFsOpen(false);
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {}
      setTimeout(reportVisibility, 0);
    }
  };

  const handleNativeFS = async ({ fullscreenUpdate }: { fullscreenUpdate: VideoFullscreenUpdate }) => {
    if (fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT) {
      try { await feedRef.current?.dismissFullscreenPlayer(); } catch {}
      openFS();
    }
  };

  const reportVisibility = () => {
    if (!containerRef.current || fsOpen) return;
    containerRef.current.measureInWindow((_x, y, _w, h) => {
      const winH = viewportHeight || 1;
      const visible = Math.max(0, Math.min(y + h, winH) - Math.max(y, 0));
      const ratio = visible / Math.max(1, h);
      onVisibility(id, ratio);
    });
  };
  useEffect(() => { reportVisibility(); }, [scrollTick]);

  useEffect(() => {
    if (fsOpen) return;
    const iAmActive = activeId === id;
    if (iAmActive && !ended && !userPausedRef.current) {
      playActive();
    } else {
      pauseActive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, fsOpen]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      fsOpen ? closeFS() : openFS();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    showHUD();
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={onTap}>
        <View ref={containerRef} style={{ position: "relative" }}>
          <Video
            ref={feedRef}
            source={{ uri }}
            resizeMode={ResizeMode.COVER}
            style={styles.postVideo}
            useNativeControls={false}
            onPlaybackStatusUpdate={(s) => {
              if ("isLoaded" in s && (s as any).isLoaded) onStatus(s as AVPlaybackStatusSuccess, "feed");
            }}
            onFullscreenUpdate={handleNativeFS}
            shouldPlay={false}
            isLooping={false}
          />

          {(hudVisible || ended) && (
            <View style={styles.centerHUD}>
              <TouchableOpacity
                onPress={() => seekBy(-10_000)}
                activeOpacity={0.85}
                style={styles.hudBtn}
              >
                <Ionicons name="play-back" size={22} color="#fff" />
                <Text style={styles.hudTiny}>10s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={ended ? replayBoth : togglePlay}
                activeOpacity={0.85}
                style={[styles.hudBtn, styles.hudPlay]}
              >
                <Ionicons name={ended ? "refresh" : isPlaying ? "pause" : "play"} size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekBy(10_000)}
                activeOpacity={0.85}
                style={styles.hudBtn}
              >
                <Ionicons name="play-forward" size={22} color="#fff" />
                <Text style={styles.hudTiny}>10s</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Fullscreen con HUD y acciones sociales */}
      <Modal
        visible={fsOpen}
        onRequestClose={closeFS}
        animationType="fade"
        transparent
        statusBarTranslucent
        supportedOrientations={["landscape", "portrait"]}
      >
        <TouchableWithoutFeedback onPress={onTap}>
          <View style={styles.fsBackdrop}>
            <TouchableOpacity onPress={closeFS} style={styles.fsCloseBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.fsCanvas}>
              <Video
                ref={fsRef}
                source={{ uri }}
                resizeMode={ResizeMode.CONTAIN}
                style={styles.fsVideo}
                useNativeControls={false}
                onLoad={async () => {
                  const pend = fsPendingRef.current;
                  if (pend) {
                    try {
                      await fsRef.current?.setStatusAsync(pend);
                      if (pend.shouldPlay) {
                        try { await fsRef.current?.playAsync(); } catch {}
                      }
                    } finally {
                      fsPendingRef.current = null;
                    }
                  }
                }}
                onPlaybackStatusUpdate={(s) => {
                  if ("isLoaded" in s && (s as any).isLoaded) onStatus(s as AVPlaybackStatusSuccess, "fs");
                }}
              />

              {(hudVisible || ended) && (
                <View style={styles.centerHUD}>
                  <TouchableOpacity onPress={() => seekBy(-10_000)} activeOpacity={0.85} style={styles.hudBtn}>
                    <Ionicons name="play-back" size={26} color="#fff" />
                    <Text style={styles.hudTiny}>10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={ended ? replayBoth : togglePlay}
                    activeOpacity={0.85}
                    style={[styles.hudBtn, styles.hudPlay]}
                  >
                    <Ionicons name={ended ? "refresh" : isPlaying ? "pause" : "play"} size={28} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => seekBy(10_000)} activeOpacity={0.85} style={styles.hudBtn}>
                    <Ionicons name="play-forward" size={26} color="#fff" />
                    <Text style={styles.hudTiny}>10s</Text>
                  </TouchableOpacity>
                </View>
              )}

              {overlay ? (
                <View style={styles.fsColumn}>
                  <TouchableOpacity onPress={overlay.onStar} style={styles.fsBtn}>
                    <Ionicons
                      name={overlay.has_starred ? "star" : "star-outline"}
                      size={22}
                      color={overlay.has_starred ? "#FFD54F" : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                  <Text style={styles.fsCount}>{Number(overlay.stars_count ?? 0)}</Text>

                  <TouchableOpacity onPress={overlay.onOpenComments} style={styles.fsBtn}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.fsCount}>{Number(overlay.comments_count ?? 0)}</Text>

                  <TouchableOpacity onPress={overlay.onWhatsApp} style={styles.fsBtn}>
                    <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                  </TouchableOpacity>
                  <Text style={styles.fsCount}>{Number(overlay.whatsapp_count ?? 0)}</Text>

                  <TouchableOpacity onPress={overlay.onRepost} style={styles.fsBtn}>
                    <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.fsCount}>{Number(overlay.reposts_count ?? 0)}</Text>

                  <TouchableOpacity onPress={overlay.onSave} style={[styles.fsBtn, { marginTop: 6 }]}>
                    <Ionicons
                      name={overlay.has_saved ? "bookmark" : "bookmark-outline"}
                      size={22}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

/* =================== Bloque del post original cuando es repost =================== */
function RepostBlock({
  data,
  overlay,
  viewportHeight,
  scrollTick,
  activeId,
  onVisibility,
}: {
  data: RepostPreview;
  overlay?: OverlayActions;
  viewportHeight: number;
  scrollTick: number;
  activeId: string | null;
  onVisibility: (id: string, ratio: number) => void;
}) {
  return (
    <View style={rpStyles.wrap}>
      <View style={rpStyles.header}>
        <Image
          source={data.author?.avatar ? { uri: data.author.avatar } : getAvatarSource(null)}
          style={rpStyles.avatar}
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={rpStyles.name}>
            {data.author?.display_name || data.author?.username || "Usuario"}
          </Text>
          <Text style={rpStyles.meta}>
            @{data.author?.username} · {new Date(data.created_at).toLocaleString()}
          </Text>
        </View>
      </View>
      {!!(data.content || "").trim() && <Text style={rpStyles.text}>{data.content}</Text>}
      {(!!data.image || !!data.video) && (
        <View style={rpStyles.media}>
          {!!data.image && (
            <Image source={{ uri: data.image! }} style={rpStyles.image} resizeMode="cover" />
          )}
          {!!data.video && (
            <PostVideo
              id={`repost-${data.id}`}
              uri={data.video!}
              overlay={overlay}
              viewportHeight={viewportHeight}
              scrollTick={scrollTick}
              activeId={activeId}
              onVisibility={onVisibility}
            />
          )}
        </View>
      )}
    </View>
  );
}

/* =================== Modal editar post =================== */
function EditPostModal({
  visible,
  onClose,
  post,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  post: PostDTO | null;
  onSave: (data: {
    text: string;
    newUri?: string;
    newType?: "image" | "video";
    removeMedia?: boolean;
  }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [newUri, setNewUri] = useState<string | undefined>();
  const [newType, setNewType] = useState<"image" | "video" | undefined>();
  const [remove, setRemove] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && post) {
      setText(post.text ?? post.content ?? "");
      setNewUri(undefined);
      setNewType(undefined);
      setRemove(false);
    }
  }, [visible, post]);

  const pickMedia = async () => {
    Alert.alert("Editor", "Para cambiar el media, usa el flujo de publicación o elimina el media.");
  };

  const renderCurrentMedia = () => {
    if (newUri && newType === "image")
      return <Image source={{ uri: newUri }} style={mStyles.previewMedia} />;
    if (newUri && newType === "video")
      return (
        <Video
          source={{ uri: newUri }}
          resizeMode={ResizeMode.COVER}
          style={mStyles.previewMedia}
        />
      );
    if (remove) return null;
    if (post?.image)
      return <Image source={{ uri: post.image }} style={mStyles.previewMedia} />;
    if (post?.video)
      return (
        <Video
          source={{ uri: post.video }}
          resizeMode={ResizeMode.COVER}
          style={mStyles.previewMedia}
        />
      );
    return null;
  };

  const save = async () => {
    if (!post) return;
    try {
      setSaving(true);
      await onSave({ text: text.trim(), newUri, newType, removeMedia: remove });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={mStyles.modalSafe}>
        <View style={mStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={mStyles.headerTitle}>Editar publicación</Text>
          <TouchableOpacity style={mStyles.publishBtn} onPress={save} disabled={saving}>
            <Text style={mStyles.publishText}>{saving ? "..." : "GUARDAR"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[mStyles.userRow, { paddingVertical: 8 }]}>
          <Ionicons name="create-outline" size={20} color="#C5E1A5" />
          <Text style={[mStyles.userName, { marginLeft: 10 }]}>Ajusta el contenido</Text>
        </View>

        <TextInput
          style={mStyles.textArea}
          multiline
          placeholder="Escribe algo…"
          placeholderTextColor="#ccc"
          value={text}
          onChangeText={setText}
        />
        {renderCurrentMedia()}

        <View style={mStyles.quickList}>
          <TouchableOpacity style={mStyles.quickRow} onPress={pickMedia}>
            <Ionicons name="image-outline" size={20} color="#43A047" style={{ width: 30 }} />
            <Text style={mStyles.quickLabel}>Reemplazar/Quitar media</Text>
          </TouchableOpacity>

          {(newUri || post?.image || post?.video) && (
            <TouchableOpacity
              style={mStyles.quickRow}
              onPress={() => {
                setNewUri(undefined);
                setNewType(undefined);
                setRemove(true);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#E53935" style={{ width: 30 }} />
              <Text style={[mStyles.quickLabel, { color: "#ffb3b0" }]}>Quitar media</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* =================== MODAL BIENVENIDA =================== */
function WelcomeModal({
  visible,
  profile,
  onClose,
}: {
  visible: boolean;
  profile: ProfileDTO;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={wStyles.backdrop}>
        <View style={wStyles.card}>
          <View style={wStyles.animWrap}>
            <LottieView
              source={welcomeAnim}
              autoPlay
              loop={false}
              style={[wStyles.lottie, { backgroundColor: "transparent" }]}
            />
          </View>
          <Image source={getAvatarSource(profile)} style={wStyles.avatar} />
          <Text style={wStyles.title}>
            ¡Qué felicidad que volviste sigue viendo mas contenido!
          </Text>
          <Text style={wStyles.name}>{profile.display_name || profile.username}</Text>
        </View>
      </View>
    </Modal>
  );
}

/* =================== HOME (feed global) =================== */
export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [feed, setFeed] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [actionsVisible, setActionsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [selected, setSelected] = useState<PostDTO | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [startWithPicker, setStartWithPicker] = useState(false);

  const [starrersOpen, setStarrersOpen] = useState(false);
  const [starrersPostId, setStarrersPostId] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<number | null>(null);

  const [whatsappersOpen, setWhatsappersOpen] = useState(false);
  const [whatsappersPostId, setWhatsappersPostId] = useState<number | null>(null);

  const [repostersOpen, setRepostersOpen] = useState(false);
  const [repostersPostId, setRepostersPostId] = useState<number | null>(null);

  const [welcomeVisible, setWelcomeVisible] = useState(false);

  /* Scroll awareness + visibilidad global */
  const [scrollTick, setScrollTick] = useState(0);
  const viewportHeight = Dimensions.get("window").height;

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const visRef = useRef<Record<string, number>>({});

  const updateActiveFromMap = () => {
    const entries = Object.entries(visRef.current);
    if (!entries.length) {
      if (activeVideoId) setActiveVideoId(null);
      return;
    }
    const threshold = 0.6;
    let best: { id: string; r: number } | null = null;
    for (const [id, r] of entries) {
      if (r >= threshold && (!best || r > best.r)) best = { id, r };
    }
    const nextId = best?.id ?? null;
    if (nextId !== activeVideoId) setActiveVideoId(nextId);
  };

  const handleVisibility = (id: string, ratio: number) => {
    visRef.current[id] = ratio;
    updateActiveFromMap();
  };

  /* cargar perfil + feed */
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (!token) {
          router.replace("/");
          return;
        }
        const [pRes, fRes] = await Promise.all([
          fetch(endpoints.finca(), { headers: { Authorization: `Token ${token}` } }),
          fetch(endpoints.feedAll(), { headers: { Authorization: `Token ${token}` } }),
        ]);
        const prof: ProfileDTO = await pRes.json();
        const raw: PostDTO[] = await fRes.json();
        const cooked = raw.map((x) => ({
          ...x,
          author:
            x.author ??
            ({
              username: prof.username,
              display_name: prof.display_name || prof.username,
              avatar: prof.avatar,
            } as PostAuthor),
        }));
        setProfile(prof);
        setFeed(cooked);
        setWelcomeVisible(true);
        setTimeout(() => setWelcomeVisible(false), 2000);
      } catch {
        Alert.alert("Error", "No se pudo cargar el feed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    updateActiveFromMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTick]);

  const canEdit = (p: PostDTO) =>
    !!profile && (p.author?.username || "") === profile.username;

  /* crear publicación */
  const createPost = async (data: {
    text: string;
    uri?: string;
    mediaType?: "image" | "video";
  }) => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) return;
    let body: any;
    let headers: any;
    if (data.uri) {
      body = new FormData();
      body.append("content", data.text);
      body.append(
        data.mediaType!,
        {
          uri: data.uri,
          name: `post.${data.mediaType === "video" ? "mp4" : "jpg"}`,
          type: data.mediaType === "video" ? "video/mp4" : "image/jpeg",
        } as any
      );
      headers = { Authorization: `Token ${tk}` };
    } else {
      body = JSON.stringify({ content: data.text });
      headers = {
        "Content-Type": "application/json",
        Authorization: `Token ${tk}`,
      };
    }
    const res = await fetch(endpoints.fincaPosts(), { method: "POST", headers, body });
    if (!res.ok) throw new Error(await res.text());
    const newPost: PostDTO = await res.json();
    const withAuthor = {
      ...newPost,
      author:
        newPost.author ??
        ({
          username: profile!.username,
          display_name: profile!.display_name || profile!.username,
          avatar: profile!.avatar,
        } as PostAuthor),
    };
    setFeed((prev) => [withAuthor, ...prev]);
  };

  /* compartir externo (sheet del SO) */
  const sharePost = async (post: PostDTO) => {
    try {
      const textContent = (post.text ?? post.content ?? "").trim();
      const parts = [textContent];
      if (post.image) parts.push(post.image);
      if (post.video) parts.push(post.video);
      const message = parts.filter(Boolean).join("\n\n") || "Mira esta publicación";
      await Share.share({ message });
    } catch {}
  };

  /* compartir por WhatsApp + registrar en backend */
  const shareOnWhatsApp = async (post: PostDTO) => {
    const textContent = (post.text ?? post.content ?? "").trim();
    const parts: Array<string | null | undefined> = [textContent];
    if (post.image) parts.push(post.image);
    if (post.video) parts.push(post.video);

    const message =
      parts.filter((s): s is string => !!s).join("\n\n") || "Mira esta publicación";

    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    } catch {}

    try {
      const tk = await AsyncStorage.getItem("userToken");
      if (!tk) return;
      const res = await fetch(endpoints.fincaPostWhatsApp(post.id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const body = await res.json();
      setFeed((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                has_shared_whatsapp: true,
                whatsapp_count: body.whatsapp_count ?? (p.whatsapp_count ?? 0),
              }
            : p
        )
      );
    } catch {}
  };

  /* 🔁 Repost dentro de la app */
  const repostInApp = async (post: PostDTO) => {
    const tk = await AsyncStorage.getItem("userToken");
    if (!tk) return;
    try {
      const res = await fetch(endpoints.fincaPostRepost(post.id), {
        method: "POST",
        headers: { Authorization: `Token ${tk}` },
      });
      const body = await res.json();
      setFeed((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          let next: PostDTO = {
            ...p,
            has_reposted: true,
            reposts_count: body.reposts_count ?? (p.reposts_count ?? 0),
          };
          if ((p.reposts_count ?? 0) === 0 && (body.reposts_count ?? 1) >= 1 && profile) {
            next.first_reposter = {
              username: profile.username,
              display_name: profile.display_name || profile.username,
              avatar: profile.avatar,
            };
          }
          return next;
        })
      );
      if (body.created) {
        Alert.alert("Compartido", "Tu audiencia verá este contenido en tu perfil.");
      } else {
        Alert.alert("Ya compartido", "Ya habías compartido esta publicación.");
      }
    } catch {
      Alert.alert("Error", "No se pudo compartir dentro de la app");
    }
  };

  const reportPost = (_post: PostDTO) => {
    Alert.alert("Gracias", "Hemos recibido tu reporte.");
  };

  /* eliminar */
  const deletePost = async (post: PostDTO) => {
    if (!canEdit(post)) {
      Alert.alert("No permitido", "Solo puedes eliminar tus publicaciones.");
      return;
    }
    const token = await AsyncStorage.getItem("userToken");
    if (!token) return;
    try {
      await fetch(endpoints.fincaPostDetail(post.id), {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });
      setFeed((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      Alert.alert("Error", "No se pudo eliminar");
    }
  };

  /* editar */
  const saveEdition = async (data: {
    text: string;
    newUri?: string;
    newType?: "image" | "video";
    removeMedia?: boolean;
  }) => {
    if (!selected) return;
    const token = await AsyncStorage.getItem("userToken");
    if (!token) return;

    if (data.removeMedia || data.newUri) {
      await fetch(endpoints.fincaPostDetail(selected.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ image: null, video: null }),
      });
    }
    if (data.newUri && data.newType) {
      const form = new FormData();
      form.append("content", data.text);
      form.append(
        data.newType,
        {
          uri: data.newUri,
          name: `post.${data.newType === "video" ? "mp4" : "jpg"}`,
          type: data.newType === "video" ? "video/mp4" : "image/jpeg",
        } as any
      );
      const res = await fetch(endpoints.fincaPostDetail(selected.id), {
        method: "PATCH",
        headers: { Authorization: `Token ${token}` },
        body: form,
      });
      const updated: PostDTO = await res.json();
      setFeed((prev) => prev.map((p) => (p.id === selected.id ? updated : p)));
      return;
    }
    const res = await fetch(endpoints.fincaPostDetail(selected.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        content: data.text,
        ...(data.removeMedia ? { image: null, video: null } : {}),
      }),
    });
    const updated: PostDTO = await res.json();
    setFeed((prev) => prev.map((p) => (p.id === selected.id ? updated : p)));
  };

  /* toggle ⭐ */
  const toggleStar = async (post: PostDTO) => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(endpoints.fincaPostStar(post.id), {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      const body = await res.json();
      setFeed((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          const nextCount = body.stars_count ?? 0;
          const prevCount = p.stars_count ?? 0;
          let nextFirst: StarrUser | null | undefined = p.first_starrer ?? null;
          if (prevCount === 0 && nextCount === 1 && body.has_starred && profile) {
            nextFirst = {
              username: profile.username,
              display_name: profile.display_name || profile.username,
              avatar: profile.avatar,
            };
          }
          if (nextCount === 0) nextFirst = null;
          return {
            ...p,
            has_starred: body.has_starred,
            stars_count: nextCount,
            first_starrer: nextFirst,
          };
        })
      );
    } catch {
      Alert.alert("Error", "No se pudo reaccionar con estrella");
    }
  };

  /* toggle 🔖 guardar */
  const toggleSave = async (
    post: PostDTO
  ): Promise<{ has_saved?: boolean; saves_count?: number } | void> => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(endpoints.fincaPostSave(post.id), {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      const body = await res.json();
      setFeed((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, has_saved: body.has_saved, saves_count: body.saves_count ?? 0 }
            : p
        )
      );
      setSelected((sel) =>
        sel && sel.id === post.id
          ? { ...sel, has_saved: body.has_saved, saves_count: body.saves_count ?? 0 }
          : sel
      );
      return body;
    } catch {
      Alert.alert("Error", "No se pudo guardar la publicación");
    }
  };

  const openComments = (postId: number) => {
    setCommentsPostId(postId);
    setCommentsOpen(true);
  };

  if (loading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <ImageBackground source={bgImage} style={styles.bg} resizeMode="cover">
      <View style={styles.dim} />

      {/* Bienvenida */}
      <WelcomeModal
        visible={welcomeVisible}
        profile={profile}
        onClose={() => setWelcomeVisible(false)}
      />

      {/* Composer (extraído) */}
      <CreatePostModal
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        avatarSource={getAvatarSource(profile)}
        displayName={profile.display_name || profile.username}
        onPublish={createPost}
        startWithPicker={startWithPicker}
        onAutoPickConsumed={() => setStartWithPicker(false)}
      />

      {/* Modales (extraídos + locales) */}
      <PostActionsModal
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        canEditDelete={!!(selected && canEdit(selected))}
        post={selected as any}
        onEdit={() => {
          if (!selected) return;
          if (!canEdit(selected)) {
            Alert.alert("No permitido", "Solo puedes editar tus publicaciones.");
            return;
          }
          setActionsVisible(false);
          setEditVisible(true);
        }}
        onDelete={() => {
          if (selected) deletePost(selected);
          setActionsVisible(false);
        }}
        onSharePress={async () => {
          if (selected) await sharePost(selected);
        }}
        onReport={() => {
          if (selected) reportPost(selected);
        }}
        onToggleSave={() => {
          if (selected) toggleSave(selected);
        }}
      />
      <EditPostModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        post={selected}
        onSave={saveEdition}
      />

      {/* 👇 Solo visor de imágenes */}
      <ImageViewerModal
        visible={imageOpen}
        uri={imageUri}
        onClose={() => {
          setImageOpen(false);
          setImageUri(null);
        }}
      />

      {/* Modales extraídos */}
      <StarrersModal
        visible={starrersOpen}
        postId={starrersPostId}
        onClose={() => {
          setStarrersOpen(false);
          setStarrersPostId(null);
        }}
      />
      <WhatsappersModal
        visible={whatsappersOpen}
        postId={whatsappersPostId}
        onClose={() => {
          setWhatsappersOpen(false);
          setWhatsappersPostId(null);
        }}
      />
      <RepostersModal
        visible={repostersOpen}
        postId={repostersPostId}
        onClose={() => {
          setRepostersOpen(false);
          setRepostersPostId(null);
        }}
      />
      <CommentsModal
        visible={commentsOpen}
        postId={commentsPostId}
        onClose={() => {
          setCommentsOpen(false);
          setCommentsPostId(null);
        }}
        onCountChange={(newCount: number) => {
          if (commentsPostId == null) return;
          setFeed((prev) =>
            prev.map((p) =>
              p.id === commentsPostId ? { ...p, comments_count: newCount } : p
            )
          );
        }}
      />

      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {/* HEADER propio */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.replace("/home")}
            >
              <Ionicons name="home-outline" size={28} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.replace("/marketplace")}
            >
              <Ionicons name="storefront-outline" size={28} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.replace("/notificaciones")}
            >
              <Ionicons name="notifications-outline" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.replace("/")}
            >
            
              <Ionicons name="add-circle-outline" size={30} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* post bar */}
        <View style={styles.postBarOuter}>
          <View style={[styles.postBar, { marginHorizontal: 0, marginTop: 0, flex: 1 }]}>
            <TouchableOpacity style={styles.postBarText} onPress={() => setShowComposer(true)}>
              <Text style={styles.postPlaceholder}>¿Qué estás pensando?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowComposer(true);
                setStartWithPicker(true);
              }}
            >
              <Ionicons name="image-outline" size={22} color="#C5E1A5" />
            </TouchableOpacity>
          </View>

          {/* 🔖 Abre pantalla de guardados */}
          <TouchableOpacity
            style={[styles.topIconBtn, styles.postBarSaveDark]}
            onPress={() => router.push("/")}
          >
            <Ionicons name="bookmark-outline" size={20} color="#C5E1A5" />
          </TouchableOpacity>
        </View>

        {/* FEED */}
        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          scrollEventThrottle={16}
          onScroll={() => setScrollTick((t) => t + 1)}
        >
          <View style={{ paddingHorizontal: 0, paddingTop: 14 }}>
            {feed.length ? (
              feed.map((p) => {
                const textContent = p.text ?? p.content ?? "";
                const first = p.first_starrer || p.stars_sample?.[0] || null;
                const firstReposter = p.first_reposter || p.repost_sample?.[0] || null;

                const overlay: OverlayActions = {
                  has_starred: !!p.has_starred,
                  stars_count: p.stars_count,
                  comments_count: p.comments_count,
                  whatsapp_count: p.whatsapp_count,
                  has_reposted: !!p.has_reposted,
                  reposts_count: p.reposts_count,
                  has_saved: !!p.has_saved,
                  onStar: () => toggleStar(p),
                  onOpenComments: () => {
                    setCommentsPostId(p.id);
                    setCommentsOpen(true);
                  },
                  onWhatsApp: () => shareOnWhatsApp(p),
                  onRepost: () => repostInApp(p),
                  onSave: () => {
                    toggleSave(p);
                  },
                };

                return (
                  <View key={p.id} style={styles.postCard}>
                    <View style={styles.topRightActions}>
                      <TouchableOpacity style={styles.topIconBtn} onPress={() => toggleSave(p)}>
                        <Ionicons
                          name={p.has_saved ? "bookmark" : "bookmark-outline"}
                          size={20}
                          color="#C5E1A5"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.topIconBtn}
                        onPress={() => {
                          setSelected(p);
                          setActionsVisible(true);
                        }}
                      >
                        <Ionicons name="leaf-outline" size={20} color="#C5E1A5" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.postHeader}>
                      <Image
                        source={
                          p.author?.avatar
                            ? { uri: p.author.avatar }
                            : getAvatarSource(profile)
                        }
                        style={styles.postAvatar}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.postAuthor}>
                          {p.author?.display_name ||
                            p.author?.username ||
                            profile.display_name ||
                            profile.username}
                        </Text>
                        <Text style={styles.postMeta}>@{p.author?.username || "usuario"}</Text>
                      </View>
                      <Text style={[styles.postMeta, { textAlign: "right" }]}>
                        {new Date(p.created_at).toLocaleString()}
                      </Text>
                    </View>

                    {!!textContent && <Text style={styles.postContent}>{textContent}</Text>}

                    {!!p.repost_of && (
                      <RepostBlock
                        data={p.repost_of}
                        overlay={overlay}
                        viewportHeight={viewportHeight}
                        scrollTick={scrollTick}
                        activeId={activeVideoId}
                        onVisibility={handleVisibility}
                      />
                    )}

                    {(!!p.image || !!p.video) && (
                      <View style={styles.mediaWrap}>
                        {!!p.image && (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                              setImageUri(p.image!);
                              setImageOpen(true);
                            }}
                          >
                            <Image
                              source={{ uri: p.image }}
                              style={styles.postImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        )}
                        {!!p.video && (
                          <PostVideo
                            id={`post-${p.id}`}
                            uri={p.video}
                            overlay={overlay}
                            viewportHeight={viewportHeight}
                            scrollTick={scrollTick}
                            activeId={activeVideoId}
                            onVisibility={handleVisibility}
                          />
                        )}
                      </View>
                    )}

                    <View style={styles.actionsRow}>
                      {/* ⭐ */}
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TouchableOpacity onPress={() => toggleStar(p)} style={{ paddingRight: 6 }}>
                          <Ionicons
                            name={p.has_starred ? "star" : "star-outline"}
                            size={22}
                            color={p.has_starred ? "#FFD54F" : "#C5E1A5"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if ((p.stars_count ?? 0) > 0) {
                              setStarrersPostId(p.id);
                              setStarrersOpen(true);
                            }
                          }}
                          disabled={!(p.stars_count ?? 0)}
                        >
                          <Text
                            style={{
                              color: (p.stars_count ?? 0) ? "#C5E1A5" : "#9E9E9E",
                              fontWeight: "700",
                            }}
                          >
                            {p.stars_count ?? 0}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 💬 */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <TouchableOpacity onPress={() => openComments(p.id)}>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={22}
                            color="#C5E1A5"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openComments(p.id)}
                          disabled={!(p.comments_count ?? 0)}
                        >
                          <Text
                            style={{
                              color: (p.comments_count ?? 0) ? "#C5E1A5" : "#9E9E9E",
                              fontWeight: "700",
                            }}
                          >
                            {p.comments_count ?? 0}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 📲 WhatsApp */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <TouchableOpacity onPress={() => shareOnWhatsApp(p)}>
                          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if ((p.whatsapp_count ?? 0) > 0) {
                              setWhatsappersPostId(p.id);
                              setWhatsappersOpen(true);
                            }
                          }}
                          disabled={!(p.whatsapp_count ?? 0)}
                        >
                          <Text
                            style={{
                              color: (p.whatsapp_count ?? 0) ? "#C5E1A5" : "#9E9E9E",
                              fontWeight: "700",
                            }}
                          >
                            {p.whatsapp_count ?? 0}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 🔁 Repost */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <TouchableOpacity onPress={() => repostInApp(p)}>
                          <Ionicons name="share-outline" size={22} color="#C5E1A5" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if ((p.reposts_count ?? 0) > 0) {
                              setRepostersPostId(p.id);
                              setRepostersOpen(true);
                            }
                          }}
                          disabled={!(p.reposts_count ?? 0)}
                        >
                          <Text
                            style={{
                              color: (p.reposts_count ?? 0) ? "#C5E1A5" : "#9E9E9E",
                              fontWeight: "700",
                            }}
                          >
                            {p.reposts_count ?? 0}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {(p.stars_count ?? 0) > 0 && first ? (
                      <View style={styles.firstStarrerRow}>
                        <Image
                          source={
                            first.avatar ? { uri: first.avatar } : getAvatarSource(null)
                          }
                          style={styles.firstStarrerAvatar}
                        />
                        <Text style={styles.firstStarrerText}>
                          <Text style={{ fontWeight: "700" }}>{first.display_name}</Text> te dio
                          una estrella
                        </Text>
                      </View>
                    ) : null}

                    {(p.reposts_count ?? 0) > 0 && firstReposter ? (
                      <View style={styles.firstStarrerRow}>
                        <Image
                          source={
                            firstReposter.avatar
                              ? { uri: firstReposter.avatar }
                              : getAvatarSource(null)
                          }
                          style={styles.firstStarrerAvatar}
                        />
                        <Text style={styles.firstStarrerText}>
                          <Text style={{ fontWeight: "700" }}>
                            {firstReposter.display_name}
                          </Text>{" "}
                          compartió esta publicación
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.placeholder}>Aún no hay publicaciones</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ---------- Estilos ---------- */
const styles = StyleSheet.create({
  bg: { flex: 1 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  safe: { flex: 1, justifyContent: "space-between" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    justifyContent: "space-between",
  },
  headerLeft: { width: 40 },
  headerCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1 },
  headerRight: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  iconButton: { marginHorizontal: 8 },

  postBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  postBarOuter: { flexDirection: "row", alignItems: "center", marginHorizontal: 24, marginTop: 18 },
  postBarText: { flex: 1 },
  postPlaceholder: { color: "#e0e0e0", fontSize: 14 },
  postBarSaveDark: { marginLeft: 8 },

  placeholder: { color: "#FFFFFF99", fontSize: 14, textAlign: "center" },
  postCard: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.40)",
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 34,
    marginBottom: 12,
  },
  topRightActions: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    gap: 6,
    zIndex: 50,
  },
  topIconBtn: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    elevation: 12,
  },

  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#fff" },
  postAuthor: { color: "#fff", fontWeight: "800", fontSize: 14 },
  postMeta: { color: "#C5E1A5", fontSize: 11 },
  postContent: { color: "#fff", fontSize: 15 },

  mediaWrap: {
    marginTop: 10,
    marginHorizontal: -14,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  postImage: { width: "100%", aspectRatio: 1 },
  postVideo: { width: "100%", aspectRatio: 1 },

  actionsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },

  firstStarrerRow: { flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 16 },
  firstStarrerAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 8, borderWidth: 1, borderColor: "#fff" },
  firstStarrerText: { color: "#C5E1A5", fontSize: 12 },

  /* ===== Fullscreen modal ===== */
  fsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fsCanvas: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fsVideo: { width: "100%", height: "100%" },
  fsCloseBtn: {
    position: "absolute",
    top: 36,
    left: 20,
    padding: 8,
    zIndex: 120,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 18,
  },
  fsColumn: {
    position: "absolute",
    right: 14,
    bottom: 20,
    alignItems: "center",
    gap: 6,
  },
  fsBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
  },
  fsCount: {
    color: "#fff",
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "700",
  },

  /* ====== HUD central (play/pausa, +/-10s, replay) ====== */
  centerHUD: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    flexDirection: "row",
    zIndex: 110,
    alignItems: "center",
    gap: 10,
  },
  hudBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  hudPlay: { paddingHorizontal: 16, paddingVertical: 12 },
  hudTiny: { color: "#fff", fontSize: 10, marginTop: 2 },
});

/* ====== estilos bloque de repost ====== */
const rpStyles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginTop: 10,
  },
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#fff" },
  name: { color: "#fff", fontWeight: "800", fontSize: 13 },
  meta: { color: "#9ccc9c", fontSize: 11 },
  text: { color: "#eaeaea", marginTop: 6, fontSize: 14 },
  media: { marginTop: 8, marginHorizontal: -10, backgroundColor: "#000" },
  image: { width: "100%", aspectRatio: 1 },
});

/* estilos comunes modales locales (Acciones/Editar) */
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

/* ==== Visor de imagen reutilizado ==== */
function ImageViewerModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={ivStyles.backdrop}>
        <TouchableOpacity style={ivStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={ivStyles.canvas}>
          {uri ? (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              contentContainerStyle={ivStyles.scrollContent}
              centerContent
            >
              <Image source={{ uri }} style={ivStyles.image} resizeMode="contain" />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const ivStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: 40, right: 20, padding: 8 },
  canvas: { width: "92%", height: "80%", backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  scrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: "100%" },
});

/* estilos modal bienvenida */
const wStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "86%",
    backgroundColor: "#1B1B1B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  animWrap: { width: 180, height: 180, marginBottom: 8 },
  lottie: { width: "100%", height: "100%" },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "#fff",
    marginTop: 4,
  },
  title: {
    color: "#e0e0e0",
    marginTop: 10,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  name: { color: "#C5E1A5", marginTop: 6, fontWeight: "800", fontSize: 14 },
});
