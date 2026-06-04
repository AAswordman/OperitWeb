export type MarketType = 'mcp' | 'skill' | 'script' | 'package';
export type ReviewState = 'pending' | 'approved' | 'changes_requested' | 'rejected';
export type ShelfState = 'open' | 'closed';
export type ReviewAction =
  | 'approve'
  | 'changes_requested'
  | 'reject'
  | 'reset_pending'
  | 'set_featured'
  | 'unset_featured';

export interface ReviewReasonOption {
  code: string;
  label: string;
  zh: string;
  en: string;
  description_zh?: string;
  description_en?: string;
}

export const MARKET_TYPE_ORDER: MarketType[] = ['mcp', 'skill', 'script', 'package'];
export const REVIEW_STATE_ORDER: ReviewState[] = ['pending', 'approved', 'changes_requested', 'rejected'];

export const REVIEW_STATE_COLORS: Record<ReviewState, string> = {
  pending: 'gold',
  approved: 'green',
  changes_requested: 'orange',
  rejected: 'red',
};

export const SHELF_STATE_COLORS: Record<ShelfState, string> = {
  open: 'blue',
  closed: 'default',
};

export const REVIEW_ACTION_STATE_MAP: Record<ReviewAction, ReviewState> = {
  approve: 'approved',
  changes_requested: 'changes_requested',
  reject: 'rejected',
  reset_pending: 'pending',
  set_featured: 'approved',
  unset_featured: 'approved',
};

export function getMarketTypeLabel(type: string, language: 'zh' | 'en'): string {
  const mapZh: Record<string, string> = {
    mcp: 'MCP',
    skill: 'Skill',
    script: 'Script',
    package: 'Package',
  };
  const mapEn: Record<string, string> = {
    mcp: 'MCP',
    skill: 'Skill',
    script: 'Script',
    package: 'Package',
  };
  return (language === 'zh' ? mapZh : mapEn)[type] || type;
}

export function getReviewStateLabel(state: string, language: 'zh' | 'en'): string {
  const mapZh: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    changes_requested: '已打回',
    rejected: '已拒绝',
  };
  const mapEn: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
    rejected: 'Rejected',
  };
  return (language === 'zh' ? mapZh : mapEn)[state] || state;
}

export function getShelfStateLabel(state: string, language: 'zh' | 'en'): string {
  const mapZh: Record<string, string> = {
    open: '上架中',
    closed: '已下架',
  };
  const mapEn: Record<string, string> = {
    open: 'Open',
    closed: 'Closed',
  };
  return (language === 'zh' ? mapZh : mapEn)[state] || state;
}

export function getReviewActionLabel(action: string, language: 'zh' | 'en'): string {
  const mapZh: Record<string, string> = {
    approve: '审核通过',
    changes_requested: '打回',
    reject: '拒绝',
    reset_pending: '作者重新提交',
    set_featured: '设为精选',
    unset_featured: '取消精选',
  };
  const mapEn: Record<string, string> = {
    approve: 'Approve',
    changes_requested: 'Changes Requested',
    reject: 'Reject',
    reset_pending: 'Reset Pending',
    set_featured: 'Set Featured',
    unset_featured: 'Unset Featured',
  };
  return (language === 'zh' ? mapZh : mapEn)[action] || action;
}

export function getReasonLabel(option: ReviewReasonOption, language: 'zh' | 'en'): string {
  return language === 'zh' ? option.zh : option.en;
}

export function getReasonDescription(option: ReviewReasonOption, language: 'zh' | 'en'): string {
  return language === 'zh'
    ? String(option.description_zh || '')
    : String(option.description_en || '');
}
