import { useEffect, useRef, useState } from 'react';
import { BubbleStyleChatMessage } from './style/bubble/BubbleStyleChatMessage';
import { CursorStyleChatMessage } from './style/cursor/CursorStyleChatMessage';
import { ChatScrollNavigator } from './ChatScrollNavigator';
import type {
  ChatStyle,
  WebChatMessage,
  WebChatMessageLocatorPreview,
  WebThemeSnapshot
} from '../util/chatTypes';

function LoadingDots() {
  return (
    <div className="chat-loading-dots">
      <span />
      <span />
      <span />
    </div>
  );
}

type ChatScrollMessageAnchor = {
  absoluteTopPx: number;
  heightPx: number;
};

export function ChatArea({
  chatHistory,
  currentChatId,
  isLoading,
  isConversationLoading,
  hasMoreHistoryBefore,
  hasMoreHistoryAfter,
  isLoadingHistoryBefore,
  isLoadingHistoryAfter,
  onLoadOlder,
  onLoadNewer,
  onJumpToLatest,
  onLoadMessageLocatorEntries,
  onRevealMessageForLocator,
  onToggleFavoriteMessage,
  theme,
  chatStyle,
  autoScrollToBottom,
  onAutoScrollToBottomChange,
  topPadding,
  bottomPadding
}: {
  chatHistory: WebChatMessage[];
  currentChatId: string | null;
  isLoading: boolean;
  isConversationLoading: boolean;
  hasMoreHistoryBefore: boolean;
  hasMoreHistoryAfter: boolean;
  isLoadingHistoryBefore: boolean;
  isLoadingHistoryAfter: boolean;
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
  onJumpToLatest: () => Promise<void>;
  onLoadMessageLocatorEntries: (
    chatId: string,
    query?: string
  ) => Promise<WebChatMessageLocatorPreview[]>;
  onRevealMessageForLocator: (targetTimestamp: number) => Promise<boolean>;
  onToggleFavoriteMessage: (timestamp: number, isFavorite: boolean) => Promise<void>;
  theme: WebThemeSnapshot | null;
  chatStyle: ChatStyle;
  autoScrollToBottom: boolean;
  onAutoScrollToBottomChange: (value: boolean) => void;
  topPadding: number;
  bottomPadding: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const onJumpToLatestRef = useRef(onJumpToLatest);
  const [viewportHeightPx, setViewportHeightPx] = useState(0);
  const [messageAnchors, setMessageAnchors] = useState<Map<number, ChatScrollMessageAnchor>>(
    () => new Map()
  );
  const [pendingJumpToMessageTimestamp, setPendingJumpToMessageTimestamp] = useState<number | null>(
    null
  );

  const lastMessage = chatHistory[chatHistory.length - 1] ?? null;
  const pendingTargetAnchor =
    pendingJumpToMessageTimestamp == null
      ? null
      : messageAnchors.get(pendingJumpToMessageTimestamp) ?? null;
  const [hasLastAssistantStartedStreaming, setHasLastAssistantStartedStreaming] = useState(
    lastMessage?.sender === 'assistant' && lastMessage.content_raw.trim().length > 0
  );
  const messagesCount = chatHistory.length;

  useEffect(() => {
    onJumpToLatestRef.current = onJumpToLatest;
  }, [onJumpToLatest]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setPendingJumpToMessageTimestamp(null);
    }
  }, [chatHistory.length, currentChatId]);

  useEffect(() => {
    if (autoScrollToBottom && hasMoreHistoryAfter && !isLoadingHistoryAfter) {
      void onJumpToLatestRef.current();
    } else if (autoScrollToBottom && messagesCount > 0) {
      setPendingJumpToMessageTimestamp(lastMessage?.timestamp ?? null);
    }
  }, [
    autoScrollToBottom,
    hasMoreHistoryAfter,
    isLoadingHistoryAfter,
    lastMessage?.timestamp,
    messagesCount
  ]);

  useEffect(() => {
    setHasLastAssistantStartedStreaming(
      lastMessage?.sender === 'assistant' && lastMessage.content_raw.trim().length > 0
    );
  }, [lastMessage?.content_raw, lastMessage?.sender, lastMessage?.timestamp]);

  useEffect(() => {
    const threadElement = threadRef.current;
    if (!threadElement) {
      return;
    }

    const updateAnchors = () => {
      const nextAnchors = new Map<number, ChatScrollMessageAnchor>();
      const nodes = threadElement.querySelectorAll<HTMLElement>('[data-message-timestamp]');
      nodes.forEach((node) => {
        const timestamp = Number(node.dataset.messageTimestamp);
        if (Number.isFinite(timestamp)) {
          nextAnchors.set(timestamp, {
            absoluteTopPx: node.offsetTop,
            heightPx: node.offsetHeight
          });
        }
      });
      setMessageAnchors(nextAnchors);
      setViewportHeightPx(scrollRef.current?.clientHeight ?? 0);
    };

    updateAnchors();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => updateAnchors());
    observer.observe(threadElement);
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }
    return () => observer.disconnect();
  }, [chatHistory, currentChatId, bottomPadding, topPadding]);

  useEffect(() => {
    const targetTimestamp = pendingJumpToMessageTimestamp;
    const scrollElement = scrollRef.current;
    if (targetTimestamp == null || !scrollElement) {
      return;
    }

    const targetIndex = chatHistory.findIndex((message) => message.timestamp === targetTimestamp);
    if (targetIndex < 0) {
      return;
    }
    const targetAnchor = pendingTargetAnchor;
    if (!targetAnchor) {
      return;
    }

    const isActualLatestMessage = targetIndex === messagesCount - 1 && !hasMoreHistoryAfter;
    onAutoScrollToBottomChange(isActualLatestMessage);

    if (targetIndex === messagesCount - 1) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      scrollElement.scrollTo({
        top: Math.max(0, targetAnchor.absoluteTopPx),
        behavior: 'smooth'
      });
    }
    setPendingJumpToMessageTimestamp(null);
  }, [
    chatHistory,
    hasMoreHistoryAfter,
    messagesCount,
    onAutoScrollToBottomChange,
    pendingJumpToMessageTimestamp,
    pendingTargetAnchor
  ]);

  const isLatestMessageVisible = messagesCount > 0 && !hasMoreHistoryAfter;
  const showLoadingIndicator =
    isLatestMessageVisible &&
    isLoading &&
    Boolean(
      lastMessage &&
        (
          lastMessage.sender === 'user' ||
          (
            lastMessage.sender === 'assistant' &&
            !lastMessage.content_raw.trim() &&
            !hasLastAssistantStartedStreaming
          )
        )
    );
  const shouldHideLastAssistantBubble =
    isLatestMessageVisible &&
    showLoadingIndicator &&
    chatStyle === 'bubble' &&
    lastMessage?.sender === 'assistant';

  return (
    <div className="chat-area-shell">
      <div className="chat-area-scroll" ref={scrollRef}>
        <div
          className={`chat-area-thread chat-style-${chatStyle} ${theme?.bubble.wide_layout ? 'is-wide' : ''}`}
          ref={threadRef}
          style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}
        >
          {hasMoreHistoryBefore ? (
            <button
              className="chat-pagination-button"
              onClick={() => {
                onAutoScrollToBottomChange(false);
                if (!isLoadingHistoryBefore) {
                  void onLoadOlder();
                }
              }}
              type="button"
            >
              点击加载更早的历史记录
            </button>
          ) : null}

          {chatHistory.length ? (
            chatHistory.map((message, actualIndex) => {
              const isLastAssistantMessage =
                actualIndex === messagesCount - 1 && message.sender === 'assistant';
              const shouldHide = shouldHideLastAssistantBubble && isLastAssistantMessage;

              return (
                <div
                  className={
                    shouldHide ? 'chat-message-anchor-shell is-hidden' : 'chat-message-anchor-shell'
                  }
                  data-message-timestamp={message.timestamp}
                  key={message.id}
                >
                  {chatStyle === 'bubble' ? (
                    <BubbleStyleChatMessage message={message} theme={theme} />
                  ) : (
                    <CursorStyleChatMessage message={message} theme={theme} />
                  )}
                </div>
              );
            })
          ) : (
            <section className="chat-empty-state">
              <strong>{isConversationLoading ? '正在同步会话' : '准备开始聊天'}</strong>
              <p>
                {isConversationLoading
                  ? '正在按需拉取当前会话的主题和最近消息。'
                  : '这里会显示手机当前会话、主题和流式回复。'}
              </p>
            </section>
          )}

          {hasMoreHistoryAfter ? (
            <button
              className="chat-pagination-button"
              onClick={() => {
                if (!isLoadingHistoryAfter) {
                  void onLoadNewer();
                }
              }}
              type="button"
            >
              点击加载较新的消息
            </button>
          ) : null}

          {showLoadingIndicator ? (
            <div className={`chat-loading-indicator ${chatStyle === 'bubble' ? 'is-bubble' : 'is-cursor'}`}>
              <LoadingDots />
            </div>
          ) : null}

          <div aria-hidden="true" className="chat-area-end-spacer" />
        </div>
      </div>

      <ChatScrollNavigator
        autoScrollToBottom={autoScrollToBottom}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        hasNewerDisplayHistory={hasMoreHistoryAfter}
        loadLocatorEntries={onLoadMessageLocatorEntries}
        messageAnchors={messageAnchors}
        onJumpToMessage={(targetIndex) => {
          const targetMessage = chatHistory[targetIndex];
          if (!targetMessage) {
            return;
          }
          const isActualLatestMessage = targetIndex === messagesCount - 1 && !hasMoreHistoryAfter;
          onAutoScrollToBottomChange(isActualLatestMessage);
          setPendingJumpToMessageTimestamp(targetMessage.timestamp);
        }}
        onJumpToMessageTimestamp={async (targetTimestamp) => {
          setPendingJumpToMessageTimestamp(targetTimestamp);

          const targetIndex = chatHistory.findIndex((message) => message.timestamp === targetTimestamp);
          if (targetIndex >= 0) {
            const isActualLatestMessage = targetIndex === messagesCount - 1 && !hasMoreHistoryAfter;
            onAutoScrollToBottomChange(isActualLatestMessage);
            return true;
          }

          onAutoScrollToBottomChange(false);
          const didReveal = await onRevealMessageForLocator(targetTimestamp);
          if (!didReveal) {
            setPendingJumpToMessageTimestamp((current) =>
              current === targetTimestamp ? null : current
            );
          }
          return didReveal;
        }}
        onAutoScrollToBottomChange={onAutoScrollToBottomChange}
        onRequestLatestMessages={() => {
          void onJumpToLatest();
        }}
        onToggleFavoriteMessage={onToggleFavoriteMessage}
        scrollElement={scrollRef.current}
        viewportHeightPx={viewportHeightPx}
      />
    </div>
  );
}
