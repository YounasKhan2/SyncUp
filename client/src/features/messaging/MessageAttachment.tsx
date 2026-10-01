import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Video,
} from "lucide-react";
import type { StagedAttachment } from "../../shared/types";
import { formatFileSize } from "../../shared/utils/format";
import { downloadAttachment, hydrateAttachment } from "../media/mediaHydrator";
import {
  hasCachedMediaV2Playback,
  hydrateMediaV2,
} from "../media/v2/mediaHydratorV2";
import { getLocalMediaV2Source } from "../media/v2/localMediaCache";

export function MessageAttachment({
  attachment,
  pending = false,
  onOpen,
}: {
  attachment: StagedAttachment;
  pending?: boolean;
  onOpen?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [visible, setVisible] = useState(pending);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [videoPosterUrl, setVideoPosterUrl] = useState("");
  const [videoPosterError, setVideoPosterError] = useState("");
  const [videoReady, setVideoReady] = useState(() =>
    Boolean(
      attachment.transport_version === 2 &&
        getLocalMediaV2Source(attachment.id),
    ),
  );
  const [videoDownloading, setVideoDownloading] = useState(false);
  const [videoDownloadProgress, setVideoDownloadProgress] = useState(0);
  const [videoDownloadError, setVideoDownloadError] = useState("");
  const videoDownloadActive = useRef(false);
  const videoPlaybackObjectUrl = useRef("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceAttempt, setVoiceAttempt] = useState(0);
  const [voiceCurrent, setVoiceCurrent] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(
    () => (attachment.duration_ms ?? 0) / 1000,
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceUrlRef = useRef("");
  const isImage = attachment.content_type.startsWith("image/");
  const isVideo = attachment.content_type.startsWith("video/");
  const isVoice = attachment.content_type.startsWith("audio/");
  const isVisualMedia = isImage || isVideo;
  const isMediaV2 = attachment.transport_version === 2;

  useEffect(() => {
    if (!isVisualMedia || pending || visible) return;
    const element = hostRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisualMedia, pending, visible]);

  useEffect(() => {
    if (
      pending ||
      isMediaV2 ||
      !isImage ||
      !visible ||
      !attachment.key_envelope
    )
      return;
    let cancelled = false;
    let objectUrl = "";
    setError("");
    hydrateAttachment(attachment)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to open this media.",
          );
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, attempt, isImage, isMediaV2, pending, visible]);

  useEffect(
    () => () => {
      if (videoPlaybackObjectUrl.current) {
        URL.revokeObjectURL(videoPlaybackObjectUrl.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isMediaV2 || !isVideo || pending || !attachment.preview) return;
    let cancelled = false;
    let objectUrl = "";
    hydrateAttachment(attachment.preview)
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setVideoPosterUrl(objectUrl);
      })
      .catch((previewError: unknown) => {
        if (!cancelled) {
          setVideoPosterError(
            previewError instanceof Error
              ? previewError.message
              : "Unable to load this video preview.",
          );
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.preview, isMediaV2, isVideo, pending]);

  useEffect(() => {
    if (!isMediaV2 || !isVideo || pending) return;
    let cancelled = false;
    hasCachedMediaV2Playback(attachment).then((cached) => {
      if (!cancelled && cached) setVideoReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment, isMediaV2, isVideo, pending]);

  useEffect(() => {
    if (!isMediaV2 || !isVoice || pending || voiceUrlRef.current) return;
    let cancelled = false;
    let objectUrl = "";
    const controller = new AbortController();
    setVoiceLoading(true);
    setError("");
    hydrateMediaV2(attachment, undefined, controller.signal)
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        voiceUrlRef.current = objectUrl;
        setVoiceUrl(objectUrl);
        setVoiceReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t load this voice note.");
      })
      .finally(() => {
        if (!cancelled) setVoiceLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        if (voiceUrlRef.current === objectUrl) voiceUrlRef.current = "";
      }
    };
  }, [attachment, isMediaV2, isVoice, pending, voiceAttempt]);

  function voiceClock(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  async function toggleVoice() {
    if (pending || !voiceReady || !voiceUrl) return;
    setError("");
    try {
      const url = voiceUrl;
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.src !== url) audio.src = url;
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (voiceError) {
      setError(
        voiceError instanceof Error
          ? voiceError.message
          : "Unable to play this voice note.",
      );
    } finally {
      setVoiceLoading(false);
    }
  }

  async function handleVideoAction() {
    if (pending || videoDownloading) return;
    if (videoReady) {
      onOpen?.();
      return;
    }
    if (videoDownloadActive.current) return;
    videoDownloadActive.current = true;
    setVideoDownloading(true);
    setVideoDownloadError("");
    setVideoDownloadProgress(0);
    try {
      const file = isMediaV2
        ? await hydrateMediaV2(attachment, setVideoDownloadProgress)
        : await hydrateAttachment(attachment);
      if (!isMediaV2) {
        const url = URL.createObjectURL(file);
        videoPlaybackObjectUrl.current = url;
        setPreviewUrl(url);
        setVideoDownloadProgress(100);
      }
      setVideoReady(true);
    } catch (downloadError) {
      setVideoDownloadError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download this video.",
      );
    } finally {
      videoDownloadActive.current = false;
      setVideoDownloading(false);
    }
  }

  return (
    <div className="message-attachment" ref={hostRef}>
      {isImage && previewUrl && (
        <button
          type="button"
          className="attachment-image-button"
          onClick={onOpen}
          aria-label={`Open ${attachment.filename}`}
        >
          <img src={previewUrl} alt={attachment.filename} />
        </button>
      )}
      {isVideo && (
        <button
          type="button"
          className={`attachment-v2-video-ready${videoReady ? " is-ready" : ""}`}
          onClick={() => void handleVideoAction()}
          disabled={pending || videoDownloading}
          aria-label={
            pending
              ? `Sending ${attachment.filename}`
              : videoDownloading
                ? isMediaV2
                  ? `Downloading ${attachment.filename}, ${videoDownloadProgress}%`
                  : `Downloading ${attachment.filename}`
                : videoReady
                  ? `Play ${attachment.filename}`
                  : `Download ${attachment.filename} to play`
          }
        >
          {isMediaV2 && videoPosterUrl && (
            <img
              className="attachment-v2-video-poster"
              src={videoPosterUrl}
              alt=""
            />
          )}
          {!isMediaV2 && previewUrl && (
            <video
              className="attachment-v2-video-poster"
              src={previewUrl}
              preload="metadata"
              muted
              playsInline
            />
          )}
          <span className="attachment-video-play">
            {videoDownloading ? (
              <LoaderCircle
                size={18}
                className="attachment-video-spinner"
                aria-hidden="true"
              />
            ) : videoReady ? (
              <Play size={18} fill="currentColor" aria-hidden="true" />
            ) : (
              <Download size={18} aria-hidden="true" />
            )}
          </span>
          {!videoReady && (
            <strong>
              {pending
                ? "Sending video…"
                : videoDownloading
                  ? isMediaV2
                    ? `Downloading… ${videoDownloadProgress}%`
                    : "Downloading…"
                  : "Download to play"}
            </strong>
          )}
          <small>
            <Video size={11} aria-hidden="true" />{" "}
            {formatFileSize(attachment.size_bytes)}
          </small>
          {videoDownloading && isMediaV2 && (
            <span
              className="attachment-v2-video-progress"
              style={{ width: `${videoDownloadProgress}%` }}
            />
          )}
        </button>
      )}
      {isVideo && videoDownloadError && (
        <small className="attachment-error" role="alert">
          {videoDownloadError}
        </small>
      )}
      {isMediaV2 && isVideo && videoPosterError && (
        <small className="attachment-error" role="status">
          Preview unavailable. Download to play.
        </small>
      )}
      {isImage && !isMediaV2 && !previewUrl && !error && (
        <div
          className="attachment-image-skeleton"
          aria-label={pending ? "Sending media" : "Loading media"}
        >
          {isVideo ? (
            <Video size={16} aria-hidden="true" />
          ) : (
            <ImageIcon size={16} aria-hidden="true" />
          )}
          <span>
            {pending
              ? `Sending ${isVideo ? "video" : "image"}…`
              : `Loading ${isVideo ? "video" : "image"}…`}
          </span>
        </div>
      )}
      {isVisualMedia && error && (
        <button
          type="button"
          className="attachment-image-error"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RefreshCw size={13} aria-hidden="true" />
          <span>Retry {isVideo ? "video" : "image"}</span>
        </button>
      )}
      {isMediaV2 && isVoice && (
        <div className="voice-message">
          <button
            type="button"
            onClick={() => {
              if (error && !voiceReady) {
                setError("");
                setVoiceUrl("");
                setVoiceAttempt((v) => v + 1);
                return;
              }
              void toggleVoice();
            }}
            disabled={pending || voiceLoading || (!voiceReady && !error)}
            aria-label={
              error && !voiceReady
                ? "Retry voice note"
                : voicePlaying
                  ? "Pause voice note"
                  : "Play voice note"
            }
          >
            {voicePlaying ? (
              <Pause size={14} />
            ) : error && !voiceReady ? (
              <RefreshCw size={14} />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>
          <audio
            ref={audioRef}
            src={voiceUrl || undefined}
            preload="metadata"
            onLoadedMetadata={(event) => {
              if (Number.isFinite(event.currentTarget.duration)) {
                setVoiceDuration(event.currentTarget.duration);
              }
            }}
            onTimeUpdate={(event) =>
              setVoiceCurrent(event.currentTarget.currentTime)
            }
            onPlay={() => setVoicePlaying(true)}
            onPause={() => setVoicePlaying(false)}
            onEnded={() => {
              setVoicePlaying(false);
              setVoiceCurrent(0);
            }}
          />
          <div className="voice-message-body">
            {attachment.waveform?.length ? (
              <div className="voice-wave" aria-hidden="true">
                {attachment.waveform.map((level, index) => (
                  <i
                    key={index}
                    style={{ height: `${Math.max(3, level * 18)}px` }}
                  />
                ))}
              </div>
            ) : (
              <div className="voice-message-wave" aria-hidden="true">
                {Array.from({ length: 28 }, (_, index) => (
                  <i
                    key={index}
                    style={{ height: `${4 + ((index * 7) % 13)}px` }}
                  />
                ))}
              </div>
            )}
            <input
              className="voice-scrubber"
              type="range"
              min="0"
              max={Math.max(voiceDuration, 0)}
              step=".05"
              value={Math.max(0, Math.min(voiceCurrent, voiceDuration || 0))}
              disabled={!voiceReady}
              aria-label="Voice note position"
              onChange={(event) => {
                const audio = audioRef.current;
                if (!audio) return;
                audio.currentTime = Number(event.currentTarget.value);
                setVoiceCurrent(audio.currentTime);
              }}
            />
            <div className="voice-message-meta">
              <small>
                {voiceLoading
                  ? "Loading…"
                  : error
                    ? "Tap to retry"
                    : voiceClock(voiceCurrent)}
              </small>
              <small>
                {voiceDuration > 0 ? voiceClock(voiceDuration) : ""}
              </small>
            </div>
          </div>
        </div>
      )}
      {!isVisualMedia && !isVoice && (
        <button
          type="button"
          className="attachment-file-button"
          onClick={() =>
            void downloadAttachment(attachment).catch(
              (downloadError: unknown) =>
                setError(
                  downloadError instanceof Error
                    ? downloadError.message
                    : "Unable to download this file.",
                ),
            )
          }
          disabled={pending}
        >
          <Download size={14} aria-hidden="true" />
          <FileText size={14} aria-hidden="true" />
          <span>
            <strong>{attachment.filename}</strong>
            <small>{formatFileSize(attachment.size_bytes)}</small>
          </span>
        </button>
      )}
      {error && !isVisualMedia && !isVoice && (
        <small className="attachment-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
