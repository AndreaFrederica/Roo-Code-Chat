/** ---- Root ---- */
export interface CharaCardV2 {
    /** 卡片主体数据（必有） */
    data: CardData;

    /** 规范标识；常见为 "chara_card_v2" */
    spec?: "chara_card_v2" | string;

    /** 版本；常见为 "2.0" */
    spec_version?: string;
}

/** ---- Character Card V3 ---- */
export interface CharacterCardV3 {
    /** 规范标识；必须为 "chara_card_v3" */
    spec: "chara_card_v3";
    
    /** 版本；必须为 "3.0" */
    spec_version: "3.0";
    
    /** 卡片主体数据（必有） */
    data: CharacterCardV3Data;
}

/** ---- Character Card V3 Data ---- */
export interface CharacterCardV3Data extends Omit<CardData, 'creator_notes' | 'character_book'> {
    /** 修改后的创作者备注 */
    creator_notes: string;
    
    /** 角色设定本（V3 格式） */
    character_book?: LorebookV3;
    
    /** 新增字段：角色资源数组 */
    assets?: CharacterAsset[];
    
    /** 新增字段：角色昵称（用于 {{char}} 占位符） */
    nickname?: string;
    
    /** 新增字段：多语言创作者备注 */
    creator_notes_multilingual?: Record<string, string>;
    
    /** 新增字段：来源信息 */
    source?: string[];
    
    /** 新增字段：群组专用问候语 */
    group_only_greetings: string[];
    
    /** 新增字段：创建日期（Unix 时间戳） */
    creation_date?: number;
    
    /** 新增字段：修改日期（Unix 时间戳） */
    modification_date?: number;
    
    /** 新增字段：原始格式信息（用于记录转换前的格式） */
    original_format?: {
        spec?: string;
        spec_version?: string;
        converted_at: number; // 转换时间戳
        converted_from: string; // 转换来源，如 "chara_card_v2"
    };
}

/** ---- Character Asset ---- */
export interface CharacterAsset {
    /** 资源类型 */
    type: string;
    
    /** 资源 URI */
    uri: string;
    
    /** 资源名称 */
    name: string;
    
    /** 文件扩展名 */
    ext: string;
}

/** ---- Lorebook V3 ---- */
export interface LorebookV3 {
    /** 设定本名称 */
    name?: string;
    
    /** 说明 */
    description?: string;
    
    /** 扫描深度 */
    scan_depth?: number;
    
    /** token 预算 */
    token_budget?: number;
    
    /** 是否递归扫描 */
    recursive_scanning?: boolean;
    
    /** 扩展字段 */
    extensions: Record<string, any>;
    
    /** 设定条目 */
    entries: LorebookEntryV3[];
}

/** ---- Lorebook Entry V3 ---- */
export interface LorebookEntryV3 {
    /** 条目名称 */
    name?: string;
    
    /** 触发关键词 */
    keys: Array<string>;
    
    /** 内容 */
    content: string;
    
    /** 扩展字段 */
    extensions: Record<string, any>;
    
    /** 是否启用 */
    enabled: boolean;
    
    /** 插入顺序 */
    insertion_order: number;
    
    /** 是否区分大小写 */
    case_sensitive?: boolean;
    
    /** 是否使用正则表达式 */
    use_regex: boolean;
    
    /** 是否常驻 */
    constant?: boolean;
    
    /** 优先级 */
    priority?: number;
    
    /** 唯一标识 */
    id?: number | string;
    
    /** 备注 */
    comment?: string;
    
    /** 选择性触发 */
    selective?: boolean;
    
    /** 次级关键词 */
    secondary_keys?: Array<string>;
    
    /** 插入位置 */
    position?: 'before_char' | 'after_char';
}

/** ---- Union Type ---- */
export type CharaCardV3 = CharacterCardV3 | CharaCardV2;

/** ---- Asset Types ---- */
export const AssetTypes = {
    ICON: 'icon',
    BACKGROUND: 'background',
    USER_ICON: 'user_icon',
    EMOTION: 'emotion',
} as const;

export type AssetType = typeof AssetTypes[keyof typeof AssetTypes];

/** ---- data ---- */
export interface CardData {
    /** 角色名 */
    name: string;
    /** 人设/世界观长描述（支持占位符 {{user}} / {{char}} 等） */
    description?: string;
    /** 人格/口癖简述 */
    personality?: string;
    /** 初始发言（first message / greeting） */
    first_mes?: string;
    /** 头像：可为 base64/URL/"none" */
    avatar?: string | null;
    /** 对话示例（多为长文本，可能含段落） */
    mes_example?: string;
    /** 场景/起始情境 */
    scenario?: string;
    /** 创作者对使用者的说明 */
    creator_notes?: string;
    /** 系统提示（注入到 system role 的内容） */
    system_prompt?: string;
    /** 贴历史前的指令（部分前端会用） */
    post_history_instructions?: string;

    /** 备选问候语（多段） */
    alternate_greetings?: string[];

    /** 标签数组（平台/搜索/分组用） */
    tags?: string[];

    /** 作者名/ID */
    creator?: string;

    /** 角色版本标识（如 "main"、"v3" 等） */
    character_version?: string;

    /** 扩展字段（平台/前端自定义） */
    extensions?: Extensions;

    /** 设定本/词条（又称 Lorebook / Character Book） */
    character_book?: CharacterBook;
}

/** ---- extensions ---- */
export interface Extensions {
    /** 是否收藏 */
    fav?: boolean;

    /** "Chub" 生态的元信息（可选） */
    chub?: {
        /** 富表情/姿态定义（平台自定；可能为 null 或对象） */
        expressions?: unknown | null;
        /** 替代表情（键值表） */
        alt_expressions?: Record<string, unknown>;
        /** 站内ID */
        id?: number | string;
        /** 站内全路径（author/slug） */
        full_path?: string;
        /** 关联的世界观词库ID列表 */
        related_lorebooks?: Array<number | string>;
        /** 背景图片URL */
        background_image?: string;
        /** 预设（采样/模板名） */
        preset?: string | null;
        /** 其他扩展列表 */
        extensions?: unknown[];
    };

    /** 角色归属的世界/宇宙名 */
    world?: string;

    /** 深度提示（常用于把一段说明注入到系统/助手） */
    depth_prompt?: {
        /** 注入到哪个 role（实现各异：有的用 "system"/"assistant"；也可能用数字） */
        role?: "system" | "assistant" | "user" | number | string;
        /** 深度/权重：平台自定义 */
        depth?: number;
        /** 实际提示文本 */
        prompt: string;
    };

    /** 话多程度（字符串或数字；具体解释由前端决定） */
    talkativeness?: string | number;

    /** 允许任意第三方扩展键 */
    [k: string]: unknown;
}

/** ---- character_book / lorebook ---- */
export interface CharacterBook {
    /** 设定本名称 */
    name: string;
    /** 说明 */
    description?: string;

    /** 扫描深度（多少历史消息内启用/检索） */
    scan_depth?: number;
    /** token 预算（前端裁剪/拼装时的限制） */
    token_budget?: number;
    /** 是否递归扫描 */
    recursive_scanning?: boolean;

    /** 平台自定义扩展 */
    extensions?: Record<string, unknown>;

    /** 设定条目 */
    entries: CharacterBookEntry[];

    /** 允许任意额外字段 */
    [k: string]: unknown;
}

/** 单条词条/设定 */
export interface CharacterBookEntry {
    /** 可选的条目名（展示/管理用） */
    name?: string;

    /** 触发表（出现这些词时考虑注入该条目） */
    keys: string[];
    /** 次级触发表（与 keys 配合或用于加权） */
    secondary_keys?: string[];

    /** 注入的内容（设定/背景/世界观片段） */
    content: string;

    /** 是否启用 */
    enabled?: boolean;

    /** 注入顺序（数值越小越早/越高优先） */
    insertion_order?: number;

    /** 匹配是否区分大小写（也可能是 null） */
    case_sensitive?: boolean | null;

    /** 优先级（平台自定义） */
    priority?: number;

    /** 唯一标识（数值或字符串） */
    id?: number | string;

    /** 条目注释/备注 */
    comment?: string;

    /** 选择性注入（命中即注入 vs 满足更多条件才注入） */
    selective?: boolean;

    /** 是否常驻（有的前端会在所有轮注入） */
    constant?: boolean;

    /** 注入位置：如 "before_char"、"after_char" 等 */
    position?: string;

    /** 条目层面的扩展参数（不同前端不同解释） */
    extensions?: {
        role?: number | string;
        delay?: number;
        depth?: number;
        group?: string;
        linked?: boolean;
        sticky?: number;
        weight?: number;
        addMemo?: boolean;
        cooldown?: number;
        embedded?: boolean;
        position?: number;
        scan_depth?: number | null;
        vectorized?: boolean;
        probability?: number;
        displayIndex?: number;
        group_weight?: number;
        automation_id?: string;
        display_index?: number;
        case_sensitive?: boolean;
        group_override?: boolean;
        selectiveLogic?: number;
        useProbability?: boolean;
        characterFilter?: unknown;
        excludeRecursion?: boolean;
        exclude_recursion?: boolean;
        match_whole_words?: boolean | null;
        prevent_recursion?: boolean;
        use_group_scoring?: boolean;
        delay_until_recursion?: boolean;

        /** 允许任意第三方扩展键 */
        [k: string]: unknown;
    };

    /** 命中概率（0-100，一些实现用） */
    probability?: number;

    /** 选择逻辑（平台自定义：0=默认 …） */
    selectiveLogic?: number;

    /** 允许任意额外字段 */
    [k: string]: unknown;
}

/** ---- 帮助类型：常见占位符 ---- */
/** 模板字符串里常见占位符，一般由前端替换；这里只作提示用途 */
export type CommonPlaceholders = "{{user}}" | "{{char}}" | `{{${string}}}`;

/** ---- 兼容性：未知字段容忍 ---- */
export type LooseCharaCard = CharaCardV2 & {
    /** 顶层也允许附加字段（部分导出器会加） */
    [k: string]: unknown;
};

/** ---- 工具类型：用于解析和验证 ---- */
export interface CharaCardParseResult {
    success: boolean;
    data?: CharaCardV3;
    error?: string;
}

/** ---- 常用的角色卡片操作接口 ---- */
export interface CharaCardOperations {
    /** 解析角色卡片 */
    parse(input: string | object): CharaCardParseResult;
    /** 验证角色卡片格式 */
    validate(card: unknown): card is CharaCardV3;
    /** 转换为标准格式 */
    normalize(card: LooseCharaCard): CharaCardV3;
    /** 提取角色基本信息 */
    extractBasicInfo(card: CharaCardV3): {
        name: string;
        description?: string;
        personality?: string;
        scenario?: string;
        avatar?: string;
        nickname?: string;
    };
    /** 提取头像 URL */
    extractAvatar(card: CharaCardV3): string | null;
    /** 检查是否为 V3 格式 */
    isV3(card: unknown): card is CharacterCardV3;
    /** 从 V2 转换为 V3 */
    convertV2ToV3(v2Card: CharaCardV2): CharacterCardV3;
}
