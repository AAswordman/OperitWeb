import { useRef, type ChangeEvent, type ReactNode } from 'react';
import {
  DataObjectIcon,
  DescriptionAttachmentIcon,
  ImageAttachmentIcon,
  PlusIcon,
  ScreenshotMonitorIcon
} from '../util/chatIcons';
import { InputOverlayPopup } from './style/input/common/InputOverlayPopup';

type AttachmentSelectorMode = 'classic' | 'agent';
type AttachmentSelectorItem = {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  icon: (props: { size?: number }) => ReactNode;
};

function AttachmentSelectorButton({
  mode,
  icon: Icon,
  title,
  disabled,
  onClick
}: {
  mode: AttachmentSelectorMode;
  icon: (props: { size?: number }) => ReactNode;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`attachment-selector-button ${disabled ? 'is-disabled' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="attachment-selector-icon">
        <Icon size={mode === 'classic' ? 24 : 16} />
      </span>
      <strong>{title}</strong>
    </button>
  );
}

export function AttachmentSelector({
  mode,
  visible,
  onUploadFiles,
  onDismiss
}: {
  mode: AttachmentSelectorMode;
  visible: boolean;
  onUploadFiles: (files: FileList) => void;
  onDismiss: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      onUploadFiles(selectedFiles);
      onDismiss();
    }
    event.target.value = '';
  }

  if (!visible) {
    return null;
  }

  const selectorItems: AttachmentSelectorItem[] = [
    { title: '照片', onClick: () => imageInputRef.current?.click(), icon: ImageAttachmentIcon },
    { title: '拍照', disabled: true, icon: PlusIcon },
    { title: '记忆', disabled: true, icon: DataObjectIcon },
    { title: '文件', onClick: () => fileInputRef.current?.click(), icon: DescriptionAttachmentIcon },
    { title: '屏幕内容', disabled: true, icon: ScreenshotMonitorIcon },
    { title: '通知', disabled: true, icon: PlusIcon },
    { title: '定位', disabled: true, icon: PlusIcon },
    { title: '包', disabled: true, icon: PlusIcon }
  ];

  const fileInputs = (
    <>
      <input
        accept="image/*"
        hidden
        multiple
        onChange={handleFileInputChange}
        ref={imageInputRef}
        type="file"
      />
      <input
        hidden
        multiple
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file"
      />
    </>
  );

  if (mode === 'classic') {
    return (
      <div className="attachment-selector-sheet">
        <div className="attachment-selector-handle" />
        <div className="attachment-selector-grid">
          {selectorItems.map((item) => (
            <AttachmentSelectorButton
              disabled={item.disabled}
              icon={item.icon}
              key={item.title}
              mode={mode}
              onClick={item.onClick}
              title={item.title}
            />
          ))}
        </div>
        {fileInputs}
      </div>
    );
  }

  return (
    <InputOverlayPopup onDismiss={onDismiss} panelClassName="attachment-selector-panel">
      <div className="attachment-selector-list">
        {selectorItems.map((item) => (
          <AttachmentSelectorButton
            disabled={item.disabled}
            icon={item.icon}
            key={item.title}
            mode={mode}
            onClick={item.onClick}
            title={item.title}
          />
        ))}
      </div>
      {fileInputs}
    </InputOverlayPopup>
  );
}
