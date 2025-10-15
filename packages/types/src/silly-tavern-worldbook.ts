/**
 * 酒馆（SillyTavern/Kobold派系）世界书/World Info(Lorebook)类型定义
 * 基于社区通行数据结构，兼容多种常见格式
 */

/** 顶层世界书对象的几种常见形态 */
export type WorldBook =
  | WorldBookDictShape
  | WorldBookArrayShape
  | LegacyWorldBook;

/** 形态 A：顶层就是 { entries: Record<string, WorldEntry> }（最常见的结构） */
export interface WorldBookDictShape {
  entries: Record<string, WorldEntry>;
  // 一些实现会带元数据；这里预留
  meta?: Partial<WorldBookMeta>;
}

/** 形态 B：顶层就是 { entries: WorldEntry[] } */
export interface WorldBookArrayShape {
  entries: WorldEntry[];
  meta?: Partial<WorldBookMeta>;
}

/** 形态 C（旧/变体）：顶层就是 WorldEntry[] 或 Record<string, WorldEntry> */
export type LegacyWorldBook = WorldEntry[] | Record<string, WorldEntry>;

/** 单条世界书词条（社区常见字段全集，全部可选做兼容） */
export interface WorldEntry {
  /** 唯一 id（常见为 number） */
  uid?: number | string;

  /** 主关键词（触发词） */
  key?: string[];

  /** 次关键词/同义词 */
  keysecondary?: string[];

  /** 词条标题/注释（非必须） */
  comment?: string;

  /** 正文内容（Markdown/纯文皆可） */
  content?: string;

  /** 是否常驻（不参与检索而总是注入） */
  constant?: boolean;

  /** 是否使用向量召回（部分前端会用） */
  vectorized?: boolean;

  /**
   * selective/selectiveLogic：
   * 选择性注入策略相关；不同前端实现意义略有差异，这里仅保留
   */
  selective?: boolean;
  selectiveLogic?: number;

  /** 权重/出现概率/顺序等（各家语义不一，这里当排序辅助） */
  order?: number;

  /** 出场位置（上下文分层策略） */
  position?: number;

  /** 分组与权重（多见于分组召回或 UI 展示） */
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;

  /** 检索/扫描深度、大小写、整词匹配等过滤细项 */
  depth?: number;
  scanDepth?: number | null;
  caseSensitive?: boolean | null;
  matchWholeWords?: boolean | null;
  useGroupScoring?: boolean | null;

  /** 召回/扩散相关 */
  probability?: number;
  useProbability?: boolean;

  /** 控制开关/冷却等运行期字段 */
  disable?: boolean;
  cooldown?: number;

  /** 递归相关标志（在某些实现用于层层展开） */
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;

  /** 其他实现里偶尔出现的 UI/排序字段 */
  displayIndex?: number;
  sticky?: number;
  addMemo?: boolean;

  /** 附加自由字段（未来兼容） */
  [extra: string]: unknown;
}

/** 可选的元信息 */
export interface WorldBookMeta {
  name: string;
  author: string;
  description: string;
  version: string | number;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
}

/** 转成 Markdown 的选项 */
export interface ToMarkdownOptions {
  /**
   * 标题级别（1~6）。例如 2 => ## {title}
   * 默认 2
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * 词条标题优先级：comment > key[0] > `Entry #{uid}`
   * 你也可以改成 'uid'|'comment'|'key'
   */
  titleStrategy?: 'auto' | 'comment' | 'key' | 'uid';

  /** 是否包含被 disable 的词条（默认 false） */
  includeDisabled?: boolean;

  /** 排序策略（默认：order > displayIndex > uid > title） */
  sortBy?:
    | 'order'
    | 'displayIndex'
    | 'uid'
    | 'title'
    | 'none';

  /** 当 sortBy 缺值时的二级排序（默认 'uid'） */
  secondarySortBy?: 'uid' | 'title';

  /** 是否在每条词条顶部生成 metadata 表（默认 true） */
  includeFrontMatter?: boolean;

  /** Front-matter 使用哪种风格：'table'（默认）或 'yaml' */
  frontMatterStyle?: 'table' | 'yaml';

  /** 合并所有条目为单文件（默认 true） */
  singleFile?: boolean;

  /** 分隔线样式（默认 '---'） */
  separator?: string;

  /** 是否包含关键词信息（默认 true） */
  includeKeys?: boolean;

  /** 内容过滤器 */
  contentFilter?: {
    /** 最大内容长度（0表示无限制） */
    maxLength?: number;
    /** 是否清理HTML标签 */
    stripHtml?: boolean;
    /** 是否清理多余空白 */
    normalizeWhitespace?: boolean;
  };
}

/** 世界书加载器配置 */
export interface WorldBookLoaderConfig {
  /** 世界书文件路径 */
  filePath: string;
  /** 是否自动重载 */
  autoReload?: boolean;
  /** 重载间隔（毫秒） */
  reloadInterval?: number;
  /** 转换选项 */
  markdownOptions?: ToMarkdownOptions;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiry?: number;
}

/** 世界书信息 */
export interface WorldBookInfo {
  /** 世界书名称 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 词条数量 */
  entryCount: number;
  /** 文件大小（字节） */
  fileSize: number;
  /** 最后修改时间 */
  lastModified: number;
  /** 元数据 */
  meta?: Partial<WorldBookMeta>;
  /** 是否已加载 */
  loaded: boolean;
  /** 错误信息 */
  error?: string;
  /** 范围：全局或工作区 */
  scope?: "global" | "workspace";
}

/** 转换结果 */
export interface WorldBookConversionResult {
  /** Markdown 内容 */
  markdown: string;
  /** 转换的词条数量 */
  entryCount: number;
  /** 跳过的词条数量 */
  skippedCount: number;
  /** 转换耗时（毫秒） */
  duration: number;
  /** 警告信息 */
  warnings: string[];
}

/** 世界书Mixin条目 - 允许动态修改世界书条目的设置 */
export interface WorldBookEntryMixin {
  /** 原始词条的UID */
  uid: number | string;
  /** 是否启用（覆盖原始设置） */
  enabled?: boolean;
  /** 是否禁用（覆盖原始设置） */
  disabled?: boolean;
  /** 修改后的关键词（覆盖原始设置） */
  keys?: string[];
  /** 修改后的次关键词（覆盖原始设置） */
  secondaryKeys?: string[];
  /** 修改后的内容（覆盖原始设置） */
  content?: string;
  /** 修改后的注释（覆盖原始设置） */
  comment?: string;
  /** 修改后的权重（覆盖原始设置） */
  order?: number;
  /** 是否常驻（覆盖原始设置） */
  constant?: boolean;
  /** 修改后的分组（覆盖原始设置） */
  group?: string;
  /** 修改后的概率（覆盖原始设置） */
  probability?: number;
  /** 自定义标签 */
  tags?: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 世界书Mixin配置 */
export interface WorldBookMixin {
  /** 世界书文件路径 */
  worldBookPath: string;
  /** 世界书名称 */
  worldBookName: string;
  /** 是否为全局世界书 */
  isGlobal: boolean;
  /** 条目修改列表 */
  entries: WorldBookEntryMixin[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 是否启用 */
  enabled: boolean;
}

/** 世界书Mixin信息 */
export interface WorldBookMixinInfo {
  /** 世界书文件路径 */
  worldBookPath: string;
  /** 世界书名称 */
  worldBookName: string;
  /** 是否为全局世界书 */
  isGlobal: boolean;
  /** Mixin文件路径 */
  mixinPath: string;
  /** 修改的词条数量 */
  modifiedEntryCount: number;
  /** 启用的词条数量 */
  enabledEntryCount: number;
  /** 禁用的词条数量 */
  disabledEntryCount: number;
  /** 最后修改时间 */
  lastModified: number;
  /** 是否启用 */
  enabled: boolean;
}