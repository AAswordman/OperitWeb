// 英文停用词
export const ENGLISH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are',
  'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'can', 'need', 'want', 'like', 'get', 'make', 'go', 'come', 'take', 'give', 'know', 'think', 'see', 'look', 'use', 'find',
  'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call', 'good', 'new', 'first', 'last', 'long', 'great', 'little',
  'own', 'other', 'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important', 'public',
  'bad', 'same', 'able', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'what', 'which', 'who',
  'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  'then', 'once', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'while', 'until', 'since', 'still', 'any',
]);

// 中文停用词
export const CHINESE_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '吗', '呢', '吧', '啊', '让', '给', '把', '被', '从', '向', '往',
  '对', '关于', '根据', '按照', '通过', '可以', '能够', '应该', '需要', '想要', '希望', '如果', '虽然', '但是', '而且',
  '或者', '因为', '所以', '然后', '接着', '最后', '首先', '其次', '再次', '总之', '另外', '此外', '比如', '例如', '包括',
  '以及', '等', '等等', '之', '与', '及', '其', '它', '它们', '这个', '那个', '这些', '那些', '这样', '那样', '这里', '那里',
  '现在', '以后', '之前', '之后', '已经', '正在', '将要', '一直', '总是', '经常', '偶尔', '从来', '从不', '非常', '特别',
  '比较', '更加', '最', '更', '太', '相当', '十分', '极其', '格外', '尤其', '主要', '重要', '关键', '核心', '基本', '一般',
  '普通', '常见', '通常', '往往', '常常',
]);
