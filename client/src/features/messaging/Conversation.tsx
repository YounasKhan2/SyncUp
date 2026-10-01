import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Search, X } from "lucide-react";
import { api, apiUpload } from "../../shared/api";
import {
  decryptMessage,
  encryptAttachment,
  encryptMessage,
} from "../auth/crypto/crypto";
import { loadDraft, saveDraft, savePendingMessage } from "./outbox";
import type { PendingMessage } from "./outbox";
import type {
  ActiveCall,
  CallRecord,
  ChatKind,
  ChatMember,
  DisplayMessage,
  EncryptedMessageReplyContext,
  EncryptedChatMessage,
  StagedAttachment,
  User,
} from "../../shared/types";
import { BrandMark } from "../../shared/components/BrandMark";
import { ConversationHeader } from "./ConversationHeader";
import { ChatDetailsScreen } from "./ChatDetailsScreen";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { ReportDialog } from "./ReportDialog";
import { prepareVideoV2 } from "../media/v2/prepareVideo";
import { prepareVoiceV2 } from "../media/v2/prepareVoice";
import type { VoiceDraft } from "./VoiceRecorder";
import { mediaV2UploadManager } from "../media/v2/runtime";
import type { MediaV2UploadSnapshot } from "../media/v2/uploadManager";
import { createGroupCallKey } from "../calls/groupCallCrypto";
import { Avatar } from "../../shared/components/Avatar";
import type { SearchableMessage } from "./SearchDialog";

async function decryptReplyContext(
  context: EncryptedMessageReplyContext | null | undefined,
): Promise<DisplayMessage["reply_context"]> {
  if (!context) return null;
  return {
    ...context,
    text: context.deleted_at
      ? ""
      : await decryptMessage({
          bodyCiphertext: context.body_ciphertext,
          bodyNonce: context.body_nonce,
          keyEnvelope: context.key_envelope,
        }).catch(() => "Unable to decrypt this message on this device."),
  };
}

export function Conversation({
  user,
  chatId,
  refreshInbox,
  online,
  pending,
  onQueued,
  onCallStarted,
  onSearchableMessages,
}: {
  user: User;
  chatId: string | null;
  refreshInbox: () => void;
  online: boolean;
  pending: PendingMessage[];
  onQueued: (message: PendingMessage) => void;
  onCallStarted: (call: ActiveCall) => void;
  onSearchableMessages: (chatId: string, messages: SearchableMessage[]) => void;
}) {
  const [chat, setChat] = useState<{
    id: string;
    kind: ChatKind;
    title: string | null;
    last_seq: string;
    last_read_seq: string;
    members: ChatMember[];
  } | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DisplayMessage | null>(
    null,
  );
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [stagedAttachments, setStagedAttachments] = useState<
    StagedAttachment[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [videoSends, setVideoSends] = useState<MediaV2UploadSnapshot[]>([]);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [callStarting, setCallStarting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(chatId));
  const lastSeq = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);
  const pendingJumpId = useRef<string | null>(null);
  const initialScrollPending = useRef(Boolean(chatId));
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const shouldStickToBottom = useRef(true);
  const lastTypingSent = useRef(0);
  const typingActive = useRef(false);
  const typingTimers = useRef(new Map<string, number>());
  const submittingRef = useRef(false);
  const uploadingFileKeys = useRef(new Set<string>());
  const stagedFileKeys = useRef(new Map<string, string>());
  const sentV2AttachmentIds = useRef(new Set<string>());
  const processingV2AttachmentIds = useRef(new Set<string>());

  useEffect(() => {
    if (!chatId || !chat) return;
    onSearchableMessages(chatId, messages
      .filter((message) => !message.pending && !message.deleted_at && message.text.trim() && !message.text.startsWith("Unable to decrypt"))
      .map((message) => ({
        id: message.id,
        chatId,
        senderName: chat.members.find((member) => member.id === message.sender_id)?.displayName
          ?? (message.sender_id === user.id ? "You" : "Member"),
        text: message.text,
        createdAt: message.created_at,
      })));
  }, [chat, chatId, messages, onSearchableMessages, user.id]);

  const loadConversation = useCallback(
    async (id: string, initial: boolean) => {
      try {
        const [chatResult, messageResult, callResult, groupCallResult] = await Promise.all([
          api<{
            chat: {
              id: string;
              kind: ChatKind;
              title: string | null;
              last_seq: string;
              last_read_seq: string;
              members: ChatMember[];
            };
          }>(`/api/chats/${id}`),
          api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>(
            `/api/chats/${id}/messages?${initial ? "limit=50" : `after_seq=${lastSeq.current}&limit=100`}`,
          ),
          api<{ calls: CallRecord[] }>(`/api/chats/${id}/calls`),
          api<{ calls: CallRecord[] }>(`/api/chats/${id}/group-calls`),
        ]);
        const displayed = await Promise.all(
          messageResult.messages.map(async (message) => ({
            ...message,
            reply_context: await decryptReplyContext(message.reply_context),
            text: message.deleted_at
              ? ""
              : await decryptMessage({
                  bodyCiphertext: message.body_ciphertext,
                  bodyNonce: message.body_nonce,
                  keyEnvelope: message.key_envelope,
                }).catch(
                  () => "Unable to decrypt this message on this device.",
                ),
          })),
        );
        setChat(chatResult.chat);
        setCallHistory([...callResult.calls, ...groupCallResult.calls].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
        setMessages((current) => {
          if (initial) return displayed;
          const merged = new Map(current.map((message) => [message.id, message]));
          for (const message of displayed) merged.set(message.id, message);
          return [...merged.values()].sort((left, right) => Number(left.server_seq) - Number(right.server_seq));
        });
        if (initial) {
          setHasOlderMessages(messageResult.hasMore);
          initialScrollPending.current = true;
        }
        lastSeq.current = Math.max(
          lastSeq.current,
          ...displayed.map((message) => Number(message.server_seq)),
          0,
        );
        setError("");
        if (lastSeq.current > Number(chatResult.chat.last_read_seq)) {
          await api(`/api/chats/${id}/read`, {
            method: "POST",
            body: JSON.stringify({ lastSeq: lastSeq.current }),
          });
          refreshInbox();
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this conversation.",
        );
      } finally {
        if (initial) setLoading(false);
      }
    },
    [refreshInbox],
  );

  const loadOlderMessages = useCallback(async () => {
    const firstMessage = messages[0];
    if (
      !chatId ||
      !firstMessage ||
      !hasOlderMessages ||
      loadingOlderRef.current
    )
      return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const result = await api<{
        messages: EncryptedChatMessage[];
        hasMore: boolean;
      }>(
        `/api/chats/${chatId}/messages?before_seq=${encodeURIComponent(firstMessage.server_seq)}&limit=50`,
      );
      const earlier = await Promise.all(
        result.messages.map(async (message) => ({
          ...message,
          reply_context: await decryptReplyContext(message.reply_context),
          text: message.deleted_at
            ? ""
            : await decryptMessage({
                bodyCiphertext: message.body_ciphertext,
                bodyNonce: message.body_nonce,
                keyEnvelope: message.key_envelope,
              }).catch(() => "Unable to decrypt this message on this device."),
        })),
      );
      const container = messageListRef.current;
      if (container && earlier.length > 0) {
        scrollAnchor.current = {
          height: container.scrollHeight,
          top: container.scrollTop,
        };
      }
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        return [
          ...earlier.filter((message) => !existing.has(message.id)),
          ...current,
        ];
      });
      setHasOlderMessages(result.hasMore);
      if (result.messages.length === 0) scrollAnchor.current = null;
    } catch (historyError) {
      scrollAnchor.current = null;
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Unable to load earlier messages.",
      );
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId, hasOlderMessages, messages]);

  const highlightMessage = useCallback((messageId: string) => {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("message-jump-highlight");
    window.setTimeout(() => target.classList.remove("message-jump-highlight"), 1600);
    return true;
  }, []);

  const jumpToMessage = useCallback(async (messageId: string, serverSeq: string) => {
    if (messages.some((message) => message.id === messageId)) {
      highlightMessage(messageId);
      return;
    }
    if (!chatId || !serverSeq || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setError("");
    setLoadingOlder(true);
    try {
      const beforeSeq = (BigInt(serverSeq) + 1n).toString();
      const result = await api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>(
        `/api/chats/${chatId}/messages?before_seq=${encodeURIComponent(beforeSeq)}&limit=50`,
      );
      const earlier = await Promise.all(result.messages.map(async (message) => ({
        ...message,
        reply_context: await decryptReplyContext(message.reply_context),
        text: message.deleted_at
          ? ""
          : await decryptMessage({
              bodyCiphertext: message.body_ciphertext,
              bodyNonce: message.body_nonce,
              keyEnvelope: message.key_envelope,
            }).catch(() => "Unable to decrypt this message on this device."),
      })));
      if (!earlier.some((message) => message.id === messageId)) {
        setError("That original message is no longer available in this conversation.");
        return;
      }
      shouldStickToBottom.current = false;
      pendingJumpId.current = messageId;
      setMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        for (const message of earlier) merged.set(message.id, message);
        return [...merged.values()].sort((left, right) => Number(left.server_seq) - Number(right.server_seq));
      });
      setHasOlderMessages(result.hasMore);
    } catch (jumpError) {
      setError(jumpError instanceof Error ? jumpError.message : "Unable to open the referenced message.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId, highlightMessage, messages]);

  useLayoutEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    if (pendingJumpId.current) {
      const targetId = pendingJumpId.current;
      pendingJumpId.current = null;
      highlightMessage(targetId);
      return;
    }
    if (scrollAnchor.current) {
      const anchor = scrollAnchor.current;
      container.scrollTop = container.scrollHeight - anchor.height + anchor.top;
      scrollAnchor.current = null;
    } else if (initialScrollPending.current && !loading) {
      container.scrollTop = container.scrollHeight;
      initialScrollPending.current = false;
      shouldStickToBottom.current = true;
    } else if (shouldStickToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loading, loadingOlder, messageSearch, highlightMessage]);

  const handleMessageListScroll = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    shouldStickToBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      80;
    if (container.scrollTop < 120) void loadOlderMessages();
  }, [loadOlderMessages]);

  useEffect(() => {
    lastSeq.current = 0;
    if (chatId) void loadConversation(chatId, true);
  }, [chatId, loadConversation]);

  useEffect(() => {
    if (!chatId) return;
    const timers = typingTimers.current;
    const source = new EventSource(
      `/api/events?chat_id=${encodeURIComponent(chatId)}`,
    );
    source.addEventListener("message.created", () => {
      void loadConversation(chatId, false);
      refreshInbox();
    });
    for (const eventName of ["message.updated", "message.reactions", "message.pinned"]) {
      source.addEventListener(eventName, () => void loadConversation(chatId, false));
    }
    source.addEventListener("message.delivered", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        messageIds: string[];
      };
      const messageIds = new Set(update.messageIds);
      setMessages((current) => current.map((message) => {
        if (message.sender_id !== user.id || !messageIds.has(message.id)) return message;
        const receipts = message.delivery_receipts ?? [];
        if (receipts.includes(update.userId)) return message;
        return {
          ...message,
          delivery_receipts: [...receipts, update.userId],
        };
      }));
    });
    source.addEventListener("chat.read", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        lastReadSeq: string;
      };
      setMessages((current) => current.map((message) => {
        if (message.sender_id !== user.id || Number(message.server_seq) > Number(update.lastReadSeq)) return message;
        const readBy = message.read_by ?? [];
        return readBy.includes(update.userId)
          ? message
          : { ...message, read_by: [...readBy, update.userId] };
      }));
    });
    source.addEventListener("presence", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        online: boolean;
      };
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (update.online) next.add(update.userId);
        else next.delete(update.userId);
        return next;
      });
    });
    source.addEventListener("typing", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        displayName: string;
        active: boolean;
      };
      if (update.active) {
        setTypingUsers((current) => ({
          ...current,
          [update.userId]: update.displayName,
        }));
        const previous = timers.get(update.userId);
        if (previous) window.clearTimeout(previous);
        timers.set(
          update.userId,
          window.setTimeout(() => {
            setTypingUsers((current) => {
              const next = { ...current };
              delete next[update.userId];
              return next;
            });
            timers.delete(update.userId);
          }, 3500),
        );
      } else {
        const previous = timers.get(update.userId);
        if (previous) window.clearTimeout(previous);
        timers.delete(update.userId);
        setTypingUsers((current) => {
          const next = { ...current };
          delete next[update.userId];
          return next;
        });
      }
    });
    source.addEventListener("membership.changed", () => {
      void loadConversation(chatId, true);
      refreshInbox();
    });
    const wake = () => {
      void loadConversation(chatId, false);
    };
    window.addEventListener("syncup-refresh-chat", wake);
    const fallback = window.setInterval(() => {
      if (navigator.onLine) void loadConversation(chatId, false);
    }, 30_000);
    return () => {
      source.close();
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
      window.clearInterval(fallback);
      window.removeEventListener("syncup-refresh-chat", wake);
    };
  }, [chatId, loadConversation, refreshInbox, user.id]);

  useEffect(() => {
    typingActive.current = false;
    lastTypingSent.current = 0;
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    loadDraft(chatId)
      .then((value) => {
        if (!cancelled) setDraft(value);
      })
      .catch((draftError: unknown) => {
        if (!cancelled)
          setError(
            draftError instanceof Error
              ? draftError.message
              : "Unable to restore your draft.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const timeout = window.setTimeout(() => {
      void saveDraft(chatId, draft).catch((draftError: unknown) => {
        setError(
          draftError instanceof Error
            ? draftError.message
            : "Unable to save your draft.",
        );
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [chatId, draft]);

  useEffect(
    () =>
      mediaV2UploadManager.subscribe((snapshots) => {
        setVideoSends(
          snapshots.filter(
            (item) => item.chatId === chatId && item.status !== "sent",
          ),
        );
        for (const item of snapshots) {
          if (item.status !== "sent") continue;
          if (
            sentV2AttachmentIds.current.has(item.attachmentId) ||
            processingV2AttachmentIds.current.has(item.attachmentId)
          ) {
            continue;
          }
          processingV2AttachmentIds.current.add(item.attachmentId);
          void import("../media/v2/jobStore").then(
            async ({ getMediaV2Job }) => {
              const job = await getMediaV2Job(item.jobId);
              if (!job?.keyEnvelope) return;
              const attachment: StagedAttachment = {
                id: job.attachmentId,
                filename: job.filename,
                content_type: job.contentType,
                size_bytes: job.plaintextSize,
                nonce: null,
                key_envelope: job.keyEnvelope,
                transport_version: 2,
                duration_ms: job.durationMs ?? null,
                waveform: job.waveform ?? null,
                width: job.width ?? null,
                height: job.height ?? null,
                poster_attachment_id: job.previewAttachment?.id ?? null,
                preview: job.previewAttachment ?? null,
              };
              if (job.sendOnComplete && job.messageIdempotencyKey) {
                const members =
                  job.chatId === chat?.id
                    ? chat.members
                    : (
                        await api<{ chat: { members: ChatMember[] } }>(
                          `/api/chats/${job.chatId}`,
                        )
                      ).chat.members;
                const attachments = [
                  attachment,
                  ...(job.mediaKind === "video" && job.previewAttachment
                    ? [job.previewAttachment]
                    : []),
                ];
                const encrypted = await encryptMessage("", members);
                const pendingMessage: PendingMessage = {
                  chatId: job.chatId,
                  localId: crypto.randomUUID(),
                  idempotencyKey: job.messageIdempotencyKey,
                  ...encrypted,
                  attachmentIds: attachments.map((item) => item.id),
                  attachments,
                  createdAt: new Date().toISOString(),
                  attempts: 0,
                  nextAttemptAt: 0,
                };
                await savePendingMessage(pendingMessage);
                const { patchMediaV2Job } = await import("../media/v2/jobStore");
                await patchMediaV2Job(job.id, { sendOnComplete: false });
                sentV2AttachmentIds.current.add(job.attachmentId);
                onQueued(pendingMessage);
                window.dispatchEvent(new Event("syncup-outbox-wake"));
                return;
              }
              if (job.chatId !== chatId) return;
              setStagedAttachments((current) => {
                const additions = [
                  attachment,
                  ...(job.mediaKind === "video" && job.previewAttachment
                    ? [job.previewAttachment]
                    : []),
                ].filter(
                  (candidate) =>
                    !current.some((item) => item.id === candidate.id),
                );
                return additions.length ? [...current, ...additions] : current;
              });
            },
          )
            .catch((queueError: unknown) => {
              setError(
                queueError instanceof Error
                  ? queueError.message
                  : "Unable to queue uploaded media.",
              );
            })
            .finally(() => {
              processingV2AttachmentIds.current.delete(item.attachmentId);
            });
        }
      }),
    [chat, chatId, onQueued],
  );

  const activePending = useMemo(
    () => pending.filter((message) => message.chatId === chatId),
    [chatId, pending],
  );

  async function uploadFile(file: File) {
    if (!chat || !chatId || !file) return;
    const fileKey = JSON.stringify([
      file.name,
      file.size,
      file.type,
      file.lastModified,
    ]);
    if (
      uploadingFileKeys.current.has(fileKey) ||
      [...stagedFileKeys.current.values()].includes(fileKey)
    ) {
      setError(`${file.name} is already selected.`);
      return;
    }
    const image = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(file.type);
    const video = ["video/mp4", "video/webm"].includes(file.type);
    if (video) {
      uploadingFileKeys.current.add(fileKey);
      setUploading(true);
      setError("");
      try {
        await prepareVideoV2(file, chatId, chat.members, user.id);
      } catch (videoError) {
        setError(
          videoError instanceof Error
            ? videoError.message
            : "Couldn’t prepare this video. Try again.",
        );
      } finally {
        uploadingFileKeys.current.delete(fileKey);
        setUploading(uploadingFileKeys.current.size > 0);
      }
      return;
    }
    const fileType = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "text/plain",
    ].includes(file.type);
    if (
      (!image && !fileType) ||
      file.size === 0 ||
      file.size > (image ? 10 : 25) * 1024 * 1024
    ) {
      setError(
        "Images must be up to 10 MB. Supported documents are up to 25 MB.",
      );
      return;
    }
    uploadingFileKeys.current.add(fileKey);
    setUploading(true);
    setError("");
    try {
      const encrypted = await encryptAttachment(file, chat.members);
      const intent = await api<{ attachmentId: string }>(
        "/api/uploads/intent",
        {
          method: "POST",
          body: JSON.stringify({
            chatId,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            nonce: encrypted.nonce,
            keyEnvelopes: encrypted.keyEnvelopes,
          }),
        },
      );
      await apiUpload(
        `/api/uploads/${intent.attachmentId}/content`,
        encrypted.ciphertext,
      );
      await api<void>(`/api/uploads/${intent.attachmentId}/complete`, {
        method: "POST",
      });
      stagedFileKeys.current.set(intent.attachmentId, fileKey);
      setStagedAttachments((current) => [
        ...current,
        {
          id: intent.attachmentId,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          nonce: encrypted.nonce,
          key_envelope: encrypted.keyEnvelopes[user.id],
        },
      ]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload this encrypted file.",
      );
    } finally {
      uploadingFileKeys.current.delete(fileKey);
      setUploading(uploadingFileKeys.current.size > 0);
    }
  }

  async function sendVoiceNote() {
    if (!voiceDraft || !chat || !chatId) return;
    setUploading(true);
    setError("");
    try {
      const job = await prepareVoiceV2(
        voiceDraft.file,
        voiceDraft.durationMs,
        voiceDraft.waveform,
        chatId,
        chat.members,
        user.id,
      );
      await mediaV2UploadManager.track(job);
      URL.revokeObjectURL(voiceDraft.url);
      setVoiceDraft(null);
    } catch (voiceError) {
      setError(
        voiceError instanceof Error
          ? voiceError.message
          : "Couldn’t send this voice note.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function startCall(callType: "audio" | "video") {
    if (!chatId || !chat) return;
    setCallStarting(true);
    setError("");
    let e2eeKey: Uint8Array | undefined;
    try {
      if (chat.kind === "group") {
        const preparedKey = await createGroupCallKey(chat.members);
        e2eeKey = preparedKey.rawKey;
        const result = await api<{ call: { id: string } }>("/api/group-calls", {
          method: "POST",
          body: JSON.stringify({ chatId, callType, keyEnvelopes: preparedKey.keyEnvelopes }),
        });
        onCallStarted({
          id: result.call.id,
          chatId,
          callType,
          title,
          isGroup: true,
          isHost: true,
          e2eeKey,
        });
        e2eeKey = undefined;
        return;
      }
      const result = await api<{ call: { id: string } }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({ chatId, callType }),
      });
      onCallStarted({ id: result.call.id, chatId, callType, title });
    } catch (callError) {
      setError(
        callError instanceof Error
          ? callError.message
          : "Unable to start this call.",
      );
    } finally {
      e2eeKey?.fill(0);
      setCallStarting(false);
    }
  }

  async function sendTyping(active: boolean) {
    if (!chatId || !online) return;
    if (!active) {
      if (!typingActive.current) return;
      typingActive.current = false;
    } else {
      const now = Date.now();
      if (now - lastTypingSent.current < 2500) return;
      lastTypingSent.current = now;
      typingActive.current = true;
    }
    try {
      await api(`/api/chats/${chatId}/typing`, {
        method: "POST",
        body: JSON.stringify({ active }),
      });
    } catch (typingError) {
      if (active)
        setError(
          typingError instanceof Error
            ? typingError.message
            : "Unable to send typing status.",
        );
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (
      !chatId ||
      !chat ||
      uploading ||
      submittingRef.current ||
      (!text && stagedAttachments.length === 0) ||
      Array.from(text).length > 8000
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    void sendTyping(false);
    setError("");
    try {
      if (editingMessage) {
        if (!text) {
          setError("Edited messages cannot be empty.");
          return;
        }

        const encrypted = await encryptMessage(text, chat.members);
        await api(`/api/messages/${editingMessage.id}`, {
          method: "PATCH",
          body: JSON.stringify(encrypted),
        });
        setEditingMessage(null);
        setDraft("");
        await saveDraft(chatId, "");
        await loadConversation(chatId, true);
        refreshInbox();
        return;
      }
      const encrypted = await encryptMessage(text, chat.members);
      const selectedFiles = new Set<string>();
      const attachmentsToSend = stagedAttachments.filter((attachment) => {
        const fileKey =
          stagedFileKeys.current.get(attachment.id) ?? attachment.id;
        if (selectedFiles.has(fileKey)) return false;
        selectedFiles.add(fileKey);
        return true;
      });
      const pendingMessage: PendingMessage = {
        chatId,
        localId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        ...encrypted,
        ...(attachmentsToSend.length
          ? {
              attachmentIds: attachmentsToSend.map(
                (attachment) => attachment.id,
              ),
              attachments: attachmentsToSend,
            }
          : {}),
        ...(replyTo ? { replyToId: replyTo.id } : {}),
        createdAt: new Date().toISOString(),
        attempts: 0,
        nextAttemptAt: 0,
      };
      await savePendingMessage(pendingMessage);
      onQueued(pendingMessage);
      setDraft("");
      // Mark v2 attachments as submitted so the upload manager won't re-add them
      for (const att of attachmentsToSend) {
        if (att.transport_version === 2)
          sentV2AttachmentIds.current.add(att.id);
      }
      setStagedAttachments([]);
      stagedFileKeys.current.clear();
      setReplyTo(null);
      await saveDraft(chatId, "");
      await loadConversation(chatId, false);
      refreshInbox();
      window.dispatchEvent(new Event("syncup-outbox-wake"));
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to queue this message.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function reactTo(message: DisplayMessage, emoji: string) {
    try {
      await api(`/api/messages/${message.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      if (chatId) await loadConversation(chatId, false);
    } catch (reactionError) {
      setError(
        reactionError instanceof Error
          ? reactionError.message
          : "Unable to update reaction.",
      );
    }
  }

  function beginEdit(message: DisplayMessage) {
    setEditingMessage(message);
    setReplyTo(null);
    setDraft(message.text);
  }

  async function deleteMessage(
    message: DisplayMessage,
    scope: "me" | "everyone",
  ) {
    if (
      scope === "everyone" &&
      !window.confirm(
        "Delete this message for everyone? This cannot be undone.",
      )
    )
      return;
    try {
      await api(`/api/messages/${message.id}/delete`, {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      if (chatId) await loadConversation(chatId, true);
      refreshInbox();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this message.",
      );
    }
  }

  async function togglePin(message: DisplayMessage) {
    try {
      const result = await api<{ pinned: boolean; pinned_at: string | null; pinned_by: string | null }>(
        `/api/messages/${message.id}/pin`,
        { method: "POST" },
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                pinned_at: result.pinned_at,
                pinned_by: result.pinned_by,
              }
            : item,
        ),
      );
    } catch (pinError) {
      setError(
        pinError instanceof Error
          ? pinError.message
          : "Unable to pin this message.",
      );
    }
  }

  async function copyMessage(message: DisplayMessage) {
    try {
      await navigator.clipboard.writeText(message.text);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy this message.",
      );
    }
  }

  if (!chatId) {
    return (
      <section className="conversation-pane welcome-pane">
        <div className="welcome-content">
          <div className="welcome-mark">
            <BrandMark />
          </div>
          <p className="eyebrow">PRIVATE BY DESIGN</p>
          <h2>
            Good conversations
            <br />
            <em>start with hello.</em>
          </h2>
          <p className="welcome-description">
            Your personal messages are encrypted on your device. Start a direct
            chat or create a group with people you trust.
          </p>
          <div className="welcome-profile">
            <Avatar name={user.display_name} src={user.avatar_url} className="avatar-card" />
            <div>
              <span className="small strong">{user.display_name}</span>
              <span className="micro muted">@{user.username}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const title =
    chat?.kind === "group"
      ? (chat.title ?? "Group")
      : (chat?.members.find((member) => member.id !== user.id)?.displayName ??
        "Direct chat");
  const membersById = new Map(
    chat?.members.map((member) => [member.id, member]) ?? [],
  );
  const peer = chat?.members.find((member) => member.id !== user.id);
  const otherTypingUsers = Object.entries(typingUsers).filter(
    ([id]) => id !== user.id,
  );
  const typingSubtitle =
    otherTypingUsers.length === 1
      ? `${otherTypingUsers[0][1]} is typing…`
      : otherTypingUsers.length > 1
        ? "Several people are typing…"
        : null;
  const visibleMessages = [
    ...messages,
    ...activePending.map((message) => ({
      id: message.localId,
      chat_id: message.chatId,
      server_seq: "",
      sender_id: user.id,
      body_ciphertext: message.bodyCiphertext,
      body_nonce: message.bodyNonce,
      key_envelope: message.keyEnvelopes[user.id],
      reply_to_id: message.replyToId ?? null,
      deleted_at: null,
      created_at: message.createdAt,
      reactions: [],
      attachments: message.attachments ?? [],
      text: "",
      pending: true,
      failed: !online && message.attempts > 0,
    })),
  ].sort((left, right) => {
    if (left.pending && right.pending)
      return left.created_at.localeCompare(right.created_at);
    if (left.pending) return 1;
    if (right.pending) return -1;
    return Number(left.server_seq) - Number(right.server_seq);
  });
  return (
    <div className="conversation-layout">
    <section className={`conversation-pane active-conversation${detailsOpen ? " conversation-hidden" : ""}`} aria-label={title} aria-hidden={detailsOpen}>
      <ConversationHeader
        title={title}
        avatarUrl={chat?.kind === "direct" ? peer?.avatar_url : undefined}
        canOpenDetails={Boolean(chat)}
        subtitle={
          typingSubtitle ??
          (chat?.kind === "group"
            ? `${chat.members.length} people · ${onlineUsers.size} online · encrypted`
            : `@${peer?.username ?? ""} · ${peer && onlineUsers.has(peer.id) ? "online" : "offline"} · encrypted`)
        }
        callStarting={callStarting}
        online={online}
        onOpenDetails={() => setDetailsOpen(true)}
        onSearchMessages={() => setMessageSearchOpen((open) => !open)}
        onBack={() => window.dispatchEvent(new Event("syncup-close-chat"))}
        onStartCall={(type) => void startCall(type)}
      />
      {messageSearchOpen && (
        <div className="conversation-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            autoFocus
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            placeholder="Search loaded messages on this device"
            aria-label="Search messages in this conversation"
          />
          <span>
            {messageSearch.trim()
              ? `${visibleMessages.filter((message) => !message.pending && !message.deleted_at && message.text.toLocaleLowerCase().includes(messageSearch.trim().toLocaleLowerCase())).length} matches`
              : "On-device only"}
          </span>
          <button
            type="button"
            onClick={() => {
              setMessageSearchOpen(false);
              setMessageSearch("");
            }}
            aria-label="Close message search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <MessageList
        messages={
          messageSearch.trim()
            ? visibleMessages.filter(
                (message) =>
                  !message.pending &&
                  !message.deleted_at &&
                  message.text
                    .toLocaleLowerCase()
                    .includes(messageSearch.trim().toLocaleLowerCase()),
              )
            : visibleMessages
        }
        emptyMessage={
          messageSearch.trim()
            ? "No matching loaded messages. Search is performed only on this device."
            : undefined
        }
        scrollContainerRef={messageListRef}
        onScroll={handleMessageListScroll}
        loadingOlder={loadingOlder}
        mediaSends={videoSends}
        onRetryMedia={(jobId) => void mediaV2UploadManager.resume(jobId)}
        onCancelMedia={(jobId) => void mediaV2UploadManager.cancel(jobId)}
        calls={callHistory}
        members={chat?.members ?? []}
        currentUserId={user.id}
        loading={loading}
        error={error}
        onReply={setReplyTo}
        onJumpToMessage={(messageId, serverSeq) => void jumpToMessage(messageId, serverSeq)}
        onReact={(message, emoji) => void reactTo(message, emoji)}
        onEdit={beginEdit}
        onDelete={(message, scope) => void deleteMessage(message, scope)}
        onPin={(message) => void togglePin(message)}
        onCopy={(message) => void copyMessage(message)}
        onReport={(message) => setReportingMessageId(message.id)}
      />
      <MessageComposer
        draft={draft}
        replyTo={editingMessage ?? replyTo}
        editing={Boolean(editingMessage)}
        replyAuthor={
          membersById.get(replyTo?.sender_id ?? "")?.displayName ?? "message"
        }
        attachments={stagedAttachments}
        uploading={uploading}
        submitting={submitting}
        chatTitle={title}
        onSubmit={submitMessage}
        onDraftChange={setDraft}
        onTypingChange={(value) => void sendTyping(Boolean(value.trim()))}
        onClearReply={() => {
          if (editingMessage) {
            setEditingMessage(null);
            setDraft("");
            if (chatId) void saveDraft(chatId, "");
          } else {
            setReplyTo(null);
          }
        }}
        onRemoveAttachment={(id) => {
          stagedFileKeys.current.delete(id);
          setStagedAttachments((current) =>
            current.filter((item) => item.id !== id),
          );
        }}
        voiceDraft={voiceDraft}
        onUpload={(file) => void uploadFile(file)}
        onVoiceReady={setVoiceDraft}
        onDeleteVoice={() => {
          if (voiceDraft) URL.revokeObjectURL(voiceDraft.url);
          setVoiceDraft(null);
        }}
        onSendVoice={() => void sendVoiceNote()}
      />
      {reportingMessageId && (
        <ReportDialog
          messageId={reportingMessageId}
          onClose={() => setReportingMessageId(null)}
        />
      )}
    </section>
    {detailsOpen && chat && <ChatDetailsScreen
      chatId={chat.id}
      title={title}
      isGroup={chat.kind === "group"}
      members={chat.members}
      currentUserId={user.id}
      onBack={() => setDetailsOpen(false)}
      onMembersChanged={() => {
        void loadConversation(chat.id, false);
        refreshInbox();
      }}
      onLeave={() => {
        window.dispatchEvent(new Event("syncup-close-chat"));
        refreshInbox();
      }}
    />}
    </div>
  );
}
