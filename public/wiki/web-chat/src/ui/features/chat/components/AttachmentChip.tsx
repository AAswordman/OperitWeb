import { formatFileSize, isImageAttachment } from '../util/chatUtils';
import type { WebMessageAttachment } from '../util/chatTypes';

export function AttachmentChip({
  attachment,
  removable,
  onRemove
}: {
  attachment: WebMessageAttachment;
  removable?: boolean;
  onRemove?: (id: string) => void;
}) {
  const sizeLabel = formatFileSize(attachment.file_size);
  const imagePreview = attachment.asset_url && isImageAttachment(attachment);

  if (imagePreview) {
    return (
      <div className={`attachment-chip is-image ${removable ? 'is-removable' : ''}`}>
        <img alt={attachment.file_name} src={attachment.asset_url ?? ''} />
        {removable && onRemove ? (
          <button onClick={() => onRemove(attachment.id)} type="button">
            ×
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`attachment-chip ${removable ? 'is-removable' : ''}`}>
      <div className="attachment-chip-copy">
        <strong>{attachment.file_name}</strong>
        <span>{sizeLabel || attachment.mime_type}</span>
      </div>
      {removable && onRemove ? (
        <button onClick={() => onRemove(attachment.id)} type="button">
          移除
        </button>
      ) : null}
    </div>
  );
}
