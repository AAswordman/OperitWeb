import { useEffect, useMemo, useRef, useState } from 'react';
import type { WebChatMessage, WebChatMessageLocatorPreview } from '../util/chatTypes';
import { ChevronDownIcon, StarFilledIcon, StarOutlineIcon } from '../util/chatIcons';

interface ChatScrollMessageAnchor {
  absoluteTopPx: number;
  heightPx: number;
}

interface ChatMessageLocatorEntry {
  index: number;
  preview: WebChatMessageLocatorPreview;
}

const LOCATOR_PREVIEW_CHAR_COUNT = 48;
const LOCATOR_HIDE_DELAY_MS = 650;
const HIDDEN_PLACEHOLDER_TEXT = '自动触发用户消息（内容已隐藏）';

function resolveCenteredMessageIndex(
  scrollElement: HTMLDivElement | null,
  viewportHeightPx: number,
  chatHistory: WebChatMessage[],
  messageAnchors: Map<number, ChatScrollMessageAnchor>
) {
  if (!scrollElement || viewportHeightPx <= 0 || chatHistory.length === 0 || messageAnchors.size === 0) {
    return null;
  }

  const viewportCenter = scrollElement.scrollTop + viewportHeightPx / 2;
  let centeredTimestamp: number | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const [timestamp, anchor] of messageAnchors.entries()) {
    const distance = Math.abs(anchor.absoluteTopPx + anchor.heightPx / 2 - viewportCenter);
    if (distance < minDistance) {
      minDistance = distance;
      centeredTimestamp = timestamp;
    }
  }

  if (centeredTimestamp == null) {
    return null;
  }

  const targetIndex = chatHistory.findIndex((message) => message.timestamp === centeredTimestamp);
  return targetIndex >= 0 ? targetIndex : null;
}

function normalizeMessageSearchText(text: string) {
  if (!text) {
    return '';
  }

  return text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toLocatorPreview(message: WebChatMessage): WebChatMessageLocatorPreview {
  const normalizedContent = normalizeMessageSearchText(message.content_raw);
  return {
    message_index: null,
    timestamp: message.timestamp,
    sender: message.sender,
    preview_content: normalizedContent.slice(0, LOCATOR_PREVIEW_CHAR_COUNT),
    content_length: normalizedContent.length,
    display_mode: 'NORMAL',
    is_favorite: false
  };
}

function visibleLocatorContent(preview: WebChatMessageLocatorPreview, hiddenPlaceholderText: string) {
  if (preview.sender === 'user' && preview.display_mode === 'HIDDEN_PLACEHOLDER') {
    return hiddenPlaceholderText;
  }

  return preview.preview_content;
}

function messageContentLength(
  preview: WebChatMessageLocatorPreview,
  hiddenPlaceholderText: string
) {
  return preview.content_length > 0
    ? preview.content_length
    : Math.max(visibleLocatorContent(preview, hiddenPlaceholderText).length, 1);
}

function messageBarFraction(messageLength: number, maxMessageLength: number) {
  if (maxMessageLength <= 0) {
    return 0.18;
  }

  return Math.max(0.18, Math.min(1, Math.sqrt(messageLength / maxMessageLength)));
}

function buildMessagePreview(
  preview: WebChatMessageLocatorPreview,
  hiddenPlaceholderText: string,
  searchQuery = ''
) {
  const content = normalizeMessageSearchText(visibleLocatorContent(preview, hiddenPlaceholderText));
  if (!content) {
    return String(preview.sender);
  }

  const normalizedSearchQuery = normalizeMessageSearchText(searchQuery);
  if (normalizedSearchQuery) {
    const matchIndex = content.toLowerCase().indexOf(normalizedSearchQuery.toLowerCase());
    if (matchIndex >= 0) {
      const previewLength = 72;
      const preferredStart = Math.max(0, matchIndex - 18);
      const start = Math.min(preferredStart, Math.max(0, content.length - previewLength));
      const end = Math.min(content.length, start + previewLength);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < content.length ? '...' : '';
      const snippet = content.slice(start, end).trim();
      if (snippet) {
        return `${prefix}${snippet}${suffix}`;
      }
    }
  }

  const shortPreview = content.slice(0, 72);
  return shortPreview.length < content.length ? `${shortPreview.trimEnd()}...` : shortPreview;
}

function senderLabel(sender: string) {
  if (sender === 'user') {
    return '用户';
  }
  if (sender === 'assistant') {
    return 'AI';
  }
  if (sender === 'summary') {
    return '总结';
  }
  if (sender === 'system') {
    return '系统';
  }
  if (sender === 'think') {
    return '思考';
  }

  return '其他';
}

function ChatMessageLocatorDialog({
  locatorEntries,
  currentMessageTimestamp,
  isLoading,
  loadFailed,
  currentChatId,
  loadLocatorEntries,
  onDismiss,
  onToggleFavoriteMessage,
  onJumpToMessage
}: {
  locatorEntries: WebChatMessageLocatorPreview[];
  currentMessageTimestamp: number;
  isLoading: boolean;
  loadFailed: boolean;
  currentChatId: string | null;
  loadLocatorEntries?: ((chatId: string, query?: string) => Promise<WebChatMessageLocatorPreview[]>) | null;
  onDismiss: () => void;
  onToggleFavoriteMessage?: ((timestamp: number, isFavorite: boolean) => Promise<void>) | null;
  onJumpToMessage: (timestamp: number) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchEntries, setSearchEntries] = useState<WebChatMessageLocatorPreview[]>([]);
  const [isLoadingSearchEntries, setLoadingSearchEntries] = useState(false);
  const [searchLoadFailed, setSearchLoadFailed] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<number, boolean>>({});
  const normalizedSearchQuery = normalizeMessageSearchText(searchQuery);
  const activeLocatorEntries = normalizedSearchQuery ? searchEntries : locatorEntries;
  const combinedLoading = isLoading || isLoadingSearchEntries;
  const combinedLoadFailed = normalizedSearchQuery ? searchLoadFailed : loadFailed;
  const currentMessageIndex = locatorEntries.findIndex((entry) => entry.timestamp === currentMessageTimestamp);
  const indexedEntries = useMemo<ChatMessageLocatorEntry[]>(
    () =>
      activeLocatorEntries.map((preview, index) => ({
        index: typeof preview.message_index === 'number' ? preview.message_index : index,
        preview
      })),
    [activeLocatorEntries]
  );
  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    if (!normalizedSearchQuery) {
      setSearchEntries([]);
      setLoadingSearchEntries(false);
      setSearchLoadFailed(false);
      return;
    }

    if (!currentChatId || !loadLocatorEntries) {
      setSearchEntries([]);
      setLoadingSearchEntries(false);
      setSearchLoadFailed(true);
      return;
    }

    setLoadingSearchEntries(true);
    setSearchLoadFailed(false);
    timeoutId = window.setTimeout(() => {
      void loadLocatorEntries(currentChatId, normalizedSearchQuery)
        .then((entries) => {
          if (!cancelled) {
            setSearchEntries(entries);
            setSearchLoadFailed(false);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            console.error('搜索消息定位列表失败', error);
            setSearchEntries([]);
            setSearchLoadFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingSearchEntries(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [currentChatId, loadLocatorEntries, normalizedSearchQuery]);
  const filteredEntries = useMemo(() => {
    if (combinedLoading) {
      return indexedEntries;
    }

    return indexedEntries.filter((entry) => {
      const isFavorite = favoriteOverrides[entry.preview.timestamp] ?? entry.preview.is_favorite;
      const matchesFavorite = !favoritesOnly || isFavorite;
      return matchesFavorite;
    });
  }, [combinedLoading, favoriteOverrides, favoritesOnly, indexedEntries]);
  const maxMessageLength = useMemo(
    () =>
      activeLocatorEntries.reduce((max, preview) => {
        return Math.max(max, messageContentLength(preview, HIDDEN_PLACEHOLDER_TEXT));
      }, 1),
    [activeLocatorEntries]
  );

  useEffect(() => {
    if (combinedLoading || filteredEntries.length === 0 || !listRef.current) {
      return;
    }

    const targetListIndex =
      normalizedSearchQuery.length === 0
        ? Math.max(
            0,
            filteredEntries.findIndex((entry) => entry.index === currentMessageIndex) - 2
          )
        : filteredEntries.reduce((closestIndex, entry, entryIndex) => {
            if (closestIndex < 0) {
              return entryIndex;
            }

            const currentDistance = Math.abs(entry.index - currentMessageIndex);
            const closestDistance = Math.abs(filteredEntries[closestIndex].index - currentMessageIndex);
            return currentDistance < closestDistance ? entryIndex : closestIndex;
          }, -1);
    const listElement = listRef.current;
    const targetElement = listElement.querySelector<HTMLElement>(
      `[data-locator-visible-index="${Math.max(targetListIndex, 0)}"]`
    );

    if (targetElement) {
      listElement.scrollTo({
        top: Math.max(targetElement.offsetTop - 16, 0)
      });
    } else {
      listElement.scrollTo({ top: 0 });
    }
  }, [combinedLoading, currentMessageIndex, filteredEntries, normalizedSearchQuery]);

  return (
    <div className="dialog-scrim" onClick={onDismiss} role="presentation">
      <div
        aria-modal="true"
        className="chat-message-locator-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="chat-message-locator-content">
          <div className="chat-message-locator-header">
            <div className="chat-message-locator-header-copy">
              <strong>跳转到消息</strong>
              <span>{`当前定位：第 ${Math.max(currentMessageIndex + 1, 0)} / ${locatorEntries.length} 条`}</span>
            </div>
            <button className="chat-message-locator-close" onClick={onDismiss} type="button">
              关闭
            </button>
          </div>

          <div className="chat-message-locator-toolbar">
            <label
              className={`chat-message-locator-search ${searchFocused ? 'is-focused' : ''}`}
            >
              <span
                className={`chat-message-locator-search-label ${
                  searchFocused || searchQuery.length > 0 ? 'is-floating' : ''
                }`}
              >
                搜索消息
              </span>
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                onBlur={() => setSearchFocused(false)}
                onFocus={() => setSearchFocused(true)}
                placeholder={searchFocused ? '输入消息内容关键词' : ''}
                value={searchQuery}
              />
            </label>

            <button
              className={`chat-message-locator-favorites ${favoritesOnly ? 'is-active' : ''}`}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              type="button"
            >
              {favoritesOnly ? <StarFilledIcon size={18} /> : <StarOutlineIcon size={18} />}
            </button>
          </div>

          {normalizedSearchQuery.length === 0 && !favoritesOnly ? (
            <div className="chat-message-locator-hint">点击任意一条消息即可快速跳转</div>
          ) : filteredEntries.length > 0 ? (
            <div className="chat-message-locator-hint">{`找到 ${filteredEntries.length} 条结果，点击即可跳转`}</div>
          ) : null}

          {combinedLoading ? (
            <div className="chat-message-locator-empty">正在加载...</div>
          ) : combinedLoadFailed ? (
            <div className="chat-message-locator-empty">加载失败: 跳转到消息</div>
          ) : filteredEntries.length === 0 ? (
            <div className="chat-message-locator-empty">没有找到匹配的消息</div>
          ) : (
            <div className="chat-message-locator-list" ref={listRef}>
              {filteredEntries.map((entry, visibleIndex) => {
                const isFavorite =
                  favoriteOverrides[entry.preview.timestamp] ?? entry.preview.is_favorite;
                const isCurrent = entry.index === currentMessageIndex;
                const messageLength = messageContentLength(entry.preview, HIDDEN_PLACEHOLDER_TEXT);
                const previewText = buildMessagePreview(
                  entry.preview,
                  HIDDEN_PLACEHOLDER_TEXT,
                  searchQuery
                );

                return (
                  <button
                    className={`chat-message-locator-row sender-${String(entry.preview.sender)} ${isCurrent ? 'is-current' : ''}`}
                    data-locator-visible-index={visibleIndex}
                    key={`${entry.preview.timestamp}_${entry.index}`}
                    onClick={() => onJumpToMessage(entry.preview.timestamp)}
                    type="button"
                  >
                    <div className="chat-message-locator-index">
                      <div className="chat-message-locator-index-top">
                        <strong>{entry.index + 1}</strong>
                        <button
                          aria-label={isFavorite ? '取消收藏消息' : '收藏消息'}
                          className="chat-message-locator-favorite-toggle"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const nextFavorite = !isFavorite;
                            setFavoriteOverrides((current) => ({
                              ...current,
                              [entry.preview.timestamp]: nextFavorite
                            }));
                            void onToggleFavoriteMessage?.(entry.preview.timestamp, nextFavorite);
                          }}
                          type="button"
                        >
                          {isFavorite ? (
                            <StarFilledIcon size={15} />
                          ) : (
                            <StarOutlineIcon size={15} />
                          )}
                        </button>
                      </div>
                      <small>{senderLabel(String(entry.preview.sender))}</small>
                    </div>

                    <div className={`chat-message-locator-bar-shell sender-${String(entry.preview.sender)}`}>
                      <div
                        className={`chat-message-locator-bar-fill sender-${String(entry.preview.sender)}`}
                        style={{ width: `${messageBarFraction(messageLength, maxMessageLength) * 100}%` }}
                      />
                      <span>{previewText}</span>
                    </div>

                    <em>{messageLength}</em>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatScrollNavigator({
  autoScrollToBottom,
  chatHistory,
  currentChatId,
  hasNewerDisplayHistory = false,
  scrollElement,
  messageAnchors,
  viewportHeightPx,
  loadLocatorEntries,
  onRequestLatestMessages,
  onAutoScrollToBottomChange,
  onJumpToMessageTimestamp,
  onJumpToMessage,
  onToggleFavoriteMessage
}: {
  autoScrollToBottom: boolean;
  chatHistory: WebChatMessage[];
  currentChatId: string | null;
  hasNewerDisplayHistory?: boolean;
  scrollElement: HTMLDivElement | null;
  messageAnchors: Map<number, ChatScrollMessageAnchor>;
  viewportHeightPx: number;
  loadLocatorEntries?: ((chatId: string, query?: string) => Promise<WebChatMessageLocatorPreview[]>) | null;
  onRequestLatestMessages?: (() => void) | null;
  onAutoScrollToBottomChange: (value: boolean) => void;
  onJumpToMessageTimestamp?: ((timestamp: number) => Promise<boolean>) | null;
  onJumpToMessage: (index: number) => void;
  onToggleFavoriteMessage?: ((timestamp: number, isFavorite: boolean) => Promise<void>) | null;
}) {
  const shouldRenderNavigator = chatHistory.length > 1 && viewportHeightPx > 0;
  const [showNavigatorChip, setShowNavigatorChip] = useState(false);
  const [userScrollSessionActive, setUserScrollSessionActive] = useState(false);
  const [showLocatorDialog, setShowLocatorDialog] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number | null>(
    chatHistory.length > 0 ? chatHistory.length - 1 : null
  );
  const [locatorEntries, setLocatorEntries] = useState<WebChatMessageLocatorPreview[]>([]);
  const [isLoadingLocatorEntries, setLoadingLocatorEntries] = useState(false);
  const [locatorLoadFailed, setLocatorLoadFailed] = useState(false);
  const firstMessageTimestamp = chatHistory[0]?.timestamp ?? null;
  const lastMessageTimestamp = chatHistory[chatHistory.length - 1]?.timestamp ?? null;
  const loadLocatorEntriesRef = useRef(loadLocatorEntries);
  const autoScrollToBottomRef = useRef(autoScrollToBottom);
  const hasNewerDisplayHistoryRef = useRef(hasNewerDisplayHistory);
  const scrollToBottomInteractionActiveRef = useRef(false);
  const userScrollSessionActiveRef = useRef(userScrollSessionActive);
  const dragInteractionActiveRef = useRef(false);

  useEffect(() => {
    autoScrollToBottomRef.current = autoScrollToBottom;
  }, [autoScrollToBottom]);

  useEffect(() => {
    hasNewerDisplayHistoryRef.current = hasNewerDisplayHistory;
  }, [hasNewerDisplayHistory]);

  useEffect(() => {
    loadLocatorEntriesRef.current = loadLocatorEntries;
  }, [loadLocatorEntries]);

  useEffect(() => {
    userScrollSessionActiveRef.current = userScrollSessionActive;
  }, [userScrollSessionActive]);

  useEffect(() => {
    setCurrentMessageIndex(chatHistory.length > 0 ? chatHistory.length - 1 : null);
  }, [chatHistory]);

  useEffect(() => {
    if (!shouldRenderNavigator || !scrollElement) {
      return;
    }

    let hideTimeoutId = 0;
    let wheelInteractionTimeoutId = 0;

    const clearHideTimeout = () => {
      window.clearTimeout(hideTimeoutId);
      hideTimeoutId = 0;
    };
    const scheduleHide = () => {
      clearHideTimeout();
      hideTimeoutId = window.setTimeout(() => {
        if (!dragInteractionActiveRef.current) {
          setShowNavigatorChip(false);
          userScrollSessionActiveRef.current = false;
          setUserScrollSessionActive(false);
        }
      }, LOCATOR_HIDE_DELAY_MS);
    };
    const beginUserSession = (persistentDrag: boolean) => {
      if (persistentDrag) {
        dragInteractionActiveRef.current = true;
        window.clearTimeout(wheelInteractionTimeoutId);
        return;
      }
      userScrollSessionActiveRef.current = true;
      setUserScrollSessionActive(true);
      setShowNavigatorChip(true);
      if (!persistentDrag) {
        scheduleHide();
      }
    };
    const endDragSession = () => {
      dragInteractionActiveRef.current = false;
      if (userScrollSessionActiveRef.current) {
        scheduleHide();
      }
    };
    const handleWheel = () => {
      beginUserSession(false);
      window.clearTimeout(wheelInteractionTimeoutId);
      wheelInteractionTimeoutId = window.setTimeout(() => {
        if (!dragInteractionActiveRef.current) {
          scheduleHide();
        }
      }, 80);
    };
    const handlePointerDown = () => {
      beginUserSession(true);
    };
    const handleTouchStart = () => {
      beginUserSession(true);
    };
    const handleScroll = () => {
      const centeredIndex = resolveCenteredMessageIndex(
        scrollElement,
        viewportHeightPx,
        chatHistory,
        messageAnchors
      );
      if (centeredIndex != null) {
        setCurrentMessageIndex(centeredIndex);
      }
      if (dragInteractionActiveRef.current && !userScrollSessionActiveRef.current) {
        userScrollSessionActiveRef.current = true;
        setUserScrollSessionActive(true);
      }
      if (!userScrollSessionActiveRef.current) {
        return;
      }
      setShowNavigatorChip(true);
      if (!dragInteractionActiveRef.current) {
        scheduleHide();
      }
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: true });
    scrollElement.addEventListener('pointerdown', handlePointerDown, { passive: true });
    scrollElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollElement.addEventListener('pointerup', endDragSession, { passive: true });
    scrollElement.addEventListener('pointercancel', endDragSession, { passive: true });
    scrollElement.addEventListener('touchend', endDragSession, { passive: true });
    scrollElement.addEventListener('touchcancel', endDragSession, { passive: true });
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearHideTimeout();
      window.clearTimeout(wheelInteractionTimeoutId);
      dragInteractionActiveRef.current = false;
      scrollElement.removeEventListener('wheel', handleWheel);
      scrollElement.removeEventListener('pointerdown', handlePointerDown);
      scrollElement.removeEventListener('touchstart', handleTouchStart);
      scrollElement.removeEventListener('pointerup', endDragSession);
      scrollElement.removeEventListener('pointercancel', endDragSession);
      scrollElement.removeEventListener('touchend', endDragSession);
      scrollElement.removeEventListener('touchcancel', endDragSession);
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [chatHistory, messageAnchors, scrollElement, shouldRenderNavigator, viewportHeightPx]);

  useEffect(() => {
    if (!scrollElement) {
      return;
    }

    let interactionTimeoutId = 0;
    let lastPosition = scrollElement.scrollTop;

    const setTransientInteractionActive = () => {
      scrollToBottomInteractionActiveRef.current = true;
      window.clearTimeout(interactionTimeoutId);
      interactionTimeoutId = window.setTimeout(() => {
        scrollToBottomInteractionActiveRef.current = false;
      }, 180);
    };
    const beginPersistentInteraction = () => {
      scrollToBottomInteractionActiveRef.current = true;
      window.clearTimeout(interactionTimeoutId);
    };
    const endPersistentInteraction = () => {
      scrollToBottomInteractionActiveRef.current = false;
      window.clearTimeout(interactionTimeoutId);
    };
    const handleScroll = () => {
      const currentPosition = scrollElement.scrollTop;
      const movedAwayFromBottom = currentPosition < lastPosition;

      if (movedAwayFromBottom) {
        if (
          autoScrollToBottomRef.current &&
          scrollToBottomInteractionActiveRef.current
        ) {
          onAutoScrollToBottomChange(false);
        }
      } else {
        const isAtBottom =
          Math.abs(
            scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop
          ) <= 1 && !hasNewerDisplayHistoryRef.current;
        if (isAtBottom && !autoScrollToBottomRef.current) {
          onAutoScrollToBottomChange(true);
        }
      }

      lastPosition = currentPosition;
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    scrollElement.addEventListener('wheel', setTransientInteractionActive, { passive: true });
    scrollElement.addEventListener('pointerdown', beginPersistentInteraction, { passive: true });
    scrollElement.addEventListener('pointerup', endPersistentInteraction, { passive: true });
    scrollElement.addEventListener('pointercancel', endPersistentInteraction, { passive: true });
    scrollElement.addEventListener('touchstart', beginPersistentInteraction, { passive: true });
    scrollElement.addEventListener('touchend', endPersistentInteraction, { passive: true });
    scrollElement.addEventListener('touchcancel', endPersistentInteraction, { passive: true });

    return () => {
      window.clearTimeout(interactionTimeoutId);
      scrollToBottomInteractionActiveRef.current = false;
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', setTransientInteractionActive);
      scrollElement.removeEventListener('pointerdown', beginPersistentInteraction);
      scrollElement.removeEventListener('pointerup', endPersistentInteraction);
      scrollElement.removeEventListener('pointercancel', endPersistentInteraction);
      scrollElement.removeEventListener('touchstart', beginPersistentInteraction);
      scrollElement.removeEventListener('touchend', endPersistentInteraction);
      scrollElement.removeEventListener('touchcancel', endPersistentInteraction);
    };
  }, [onAutoScrollToBottomChange, scrollElement]);

  useEffect(() => {
    let cancelled = false;
    const currentLoadLocatorEntries = loadLocatorEntriesRef.current;

    if (!currentChatId || !currentLoadLocatorEntries) {
      setLocatorEntries(chatHistory.map(toLocatorPreview));
      setLoadingLocatorEntries(false);
      setLocatorLoadFailed(false);
      return;
    }

    setLoadingLocatorEntries(true);
    setLocatorLoadFailed(false);

    void currentLoadLocatorEntries(currentChatId)
      .then((entries) => {
        if (!cancelled) {
          setLocatorEntries(entries);
          setLocatorLoadFailed(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('加载消息定位列表失败', error);
          setLocatorEntries([]);
          setLocatorLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLocatorEntries(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chatHistory.length, currentChatId, firstMessageTimestamp, lastMessageTimestamp]);

  if (!shouldRenderNavigator) {
    return null;
  }

  const activeMessageTimestamp =
    currentMessageIndex != null ? chatHistory[currentMessageIndex]?.timestamp ?? null : null;
  const activeGlobalMessageIndex =
    activeMessageTimestamp == null
      ? -1
      : locatorEntries.findIndex((entry) => entry.timestamp === activeMessageTimestamp);
  const progressTotalCount = locatorEntries.length > 0 ? locatorEntries.length : chatHistory.length;
  const progressIndex =
    activeGlobalMessageIndex >= 0 ? activeGlobalMessageIndex : currentMessageIndex ?? 0;
  const progress =
    progressTotalCount <= 1 ? 1 : Math.min(1, Math.max(0, progressIndex / (progressTotalCount - 1)));
  const shouldShowNavigatorControl = currentMessageIndex != null && showNavigatorChip;

  return (
    <>
      {shouldShowNavigatorControl ? (
        <div className="chat-scroll-navigator-chip">
          <button
            aria-label="跳转到消息"
            className="chat-scroll-navigator-locator-button"
            onClick={() => {
              setShowLocatorDialog(true);
              setShowNavigatorChip(false);
              userScrollSessionActiveRef.current = false;
              setUserScrollSessionActive(false);
            }}
            type="button"
          >
            <span className="chat-scroll-navigator-pill">
              <span className="chat-scroll-navigator-track">
                <span className="chat-scroll-navigator-line" />
                <span
                  className="chat-scroll-navigator-dot"
                  style={{ top: `${2 + progress * 30}px` }}
                />
              </span>
            </span>
            <span className="chat-scroll-navigator-arrow" />
          </button>
          <button
            aria-label="滚动到底部"
            className="chat-scroll-navigator-bottom-button"
            onClick={() => {
              if (hasNewerDisplayHistory && onRequestLatestMessages) {
                onRequestLatestMessages();
              }
              if (scrollElement) {
                scrollElement.scrollTo({
                  top: scrollElement.scrollHeight,
                  behavior: 'smooth'
                });
              }
              onAutoScrollToBottomChange(true);
            }}
            type="button"
          >
            <ChevronDownIcon size={14} />
          </button>
        </div>
      ) : null}

      {showLocatorDialog && activeMessageTimestamp != null ? (
        <ChatMessageLocatorDialog
          currentMessageTimestamp={activeMessageTimestamp}
          isLoading={isLoadingLocatorEntries}
          loadFailed={locatorLoadFailed}
          currentChatId={currentChatId}
          loadLocatorEntries={loadLocatorEntries}
          locatorEntries={locatorEntries}
          onDismiss={() => setShowLocatorDialog(false)}
          onJumpToMessage={(targetTimestamp) => {
            setShowLocatorDialog(false);
            const targetIndex = chatHistory.findIndex((message) => message.timestamp === targetTimestamp);
            if (targetIndex >= 0) {
              onJumpToMessage(targetIndex);
              return;
            }
            void onJumpToMessageTimestamp?.(targetTimestamp);
          }}
          onToggleFavoriteMessage={onToggleFavoriteMessage}
        />
      ) : null}
    </>
  );
}
