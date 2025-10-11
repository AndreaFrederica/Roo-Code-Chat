/**
 * 酒馆世界书转换工具
 * 将SillyTavern/Kobold格式的世界书转换为Markdown
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {
  WorldBook,
  WorldEntry,
  WorldBookMeta,
  ToMarkdownOptions,
  WorldBookLoaderConfig,
  WorldBookInfo,
  WorldBookConversionResult,
  WorldBookDictShape,
  WorldBookArrayShape,
  LegacyWorldBook
} from './silly-tavern-worldbook.js';

/**
 * 世界书转换器类
 */
export class WorldBookConverter {
  private cache = new Map<string, { data: any; timestamp: number; result: string }>();
  // private watchers = new Map<string, fs.FSWatcher>(); // 暂时注释，后续可重新实现

  constructor(private defaultOptions: Partial<ToMarkdownOptions> = {}) {}

  /**
   * 将世界书转换为Markdown
   */
  async convertToMarkdown(
    input: unknown,
    options: ToMarkdownOptions = {}
  ): Promise<WorldBookConversionResult> {
    const startTime = Date.now();
    const opt: Required<ToMarkdownOptions> = {
      headingLevel: options.headingLevel ?? 2,
      titleStrategy: options.titleStrategy ?? 'auto',
      includeDisabled: options.includeDisabled ?? false,
      sortBy: options.sortBy ?? 'order',
      secondarySortBy: options.secondarySortBy ?? 'uid',
      includeFrontMatter: options.includeFrontMatter ?? true,
      frontMatterStyle: options.frontMatterStyle ?? 'table',
      singleFile: options.singleFile ?? true,
      separator: options.separator ?? '---',
      includeKeys: options.includeKeys ?? true,
      contentFilter: {
        maxLength: options.contentFilter?.maxLength ?? 0,
        stripHtml: options.contentFilter?.stripHtml ?? true,
        normalizeWhitespace: options.contentFilter?.normalizeWhitespace ?? true,
        ...options.contentFilter
      }
    };

    const warnings: string[] = [];

    try {
      const entries = this.normalizeToEntries(input, warnings);
      const usable = entries.filter(e => opt.includeDisabled || !this.truthy(e.disable));
      const skippedCount = entries.length - usable.length;

      const sorted = this.sortEntries(usable, opt.sortBy, opt.secondarySortBy);

      const mdParts: string[] = [];

      // 添加文档头部
      if (sorted.length > 0) {
        mdParts.push('# 世界书知识库');
        mdParts.push('');
        mdParts.push(`*共 ${sorted.length} 个词条*`);
        mdParts.push('');
        mdParts.push(opt.separator);
        mdParts.push('');
      }

      for (const e of sorted) {
        const title = this.makeTitle(e, opt.titleStrategy);
        const h = '#'.repeat(Math.min(6, Math.max(1, opt.headingLevel)));
        mdParts.push(`${h} ${this.escapeMdInline(title)}`);

        if (opt.includeFrontMatter) {
          if (opt.frontMatterStyle === 'yaml') {
            mdParts.push(this.renderYamlFrontMatter(e));
          } else {
            mdParts.push(this.renderMetaTable(e));
          }
        }

        // 同步展示关键词
        if (opt.includeKeys) {
          const keysLine = this.renderKeys(e);
          if (keysLine) mdParts.push(keysLine);
        }

        // 正文处理
        let body = (e.content ?? '').toString().trim();

        // 应用内容过滤器
        if (opt.contentFilter.stripHtml) {
          body = this.stripHtml(body);
        }

        if (opt.contentFilter.normalizeWhitespace) {
          body = this.normalizeWhitespace(body);
        }

        if (opt.contentFilter.maxLength && opt.contentFilter.maxLength > 0 && body.length > opt.contentFilter.maxLength) {
          body = body.substring(0, opt.contentFilter.maxLength) + '...';
          warnings.push(`词条 "${title}" 内容被截断`);
        }

        if (body) {
          mdParts.push(body);
        } else {
          mdParts.push('*(暂无内容)*');
        }

        mdParts.push(opt.separator);
        mdParts.push('');
      }

      // 去掉最后一个分隔线
      while (mdParts.length > 0 && (mdParts[mdParts.length - 1] === opt.separator || mdParts[mdParts.length - 1] === '')) {
        mdParts.pop();
      }

      const markdown = mdParts.join('\n');
      const duration = Date.now() - startTime;

      return {
        markdown,
        entryCount: sorted.length,
        skippedCount,
        duration,
        warnings
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      warnings.push(`转换过程中发生错误: ${error instanceof Error ? error.message : String(error)}`);

      return {
        markdown: '',
        entryCount: 0,
        skippedCount: 0,
        duration,
        warnings
      };
    }
  }

  /**
   * 从文件加载并转换世界书
   */
  async loadFromFile(filePath: string, options: ToMarkdownOptions = {}): Promise<WorldBookConversionResult> {
    try {
      // 确保路径是绝对路径
      const absolutePath = path.resolve(filePath);

      // 读取文件内容，处理可能包含空格的路径
      let fileContent: string;
      try {
        fileContent = await fs.readFile(absolutePath, 'utf-8');
      } catch (readError) {
        throw new Error(`文件读取失败 ${absolutePath}: ${readError instanceof Error ? readError.message : String(readError)}`);
      }

      let data: unknown;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`JSON解析失败 ${absolutePath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      return this.convertToMarkdown(data, options);
    } catch (error) {
      return {
        markdown: '',
        entryCount: 0,
        skippedCount: 0,
        duration: 0,
        warnings: [`无法读取文件 ${filePath}: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * 扫描目录中的世界书文件
   */
  async scanDirectory(dirPath: string): Promise<WorldBookInfo[]> {
    const infos: WorldBookInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.jsonl'))) {
          const fullPath = path.join(dirPath, entry.name);
          const info = await this.getWorldBookInfo(fullPath);
          infos.push(info);
        }
      }

      return infos.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.warn(`扫描目录失败 ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * 获取世界书文件信息
   */
  async getWorldBookInfo(filePath: string): Promise<WorldBookInfo> {
    try {
      // 确保路径是绝对路径
      const absolutePath = path.resolve(filePath);

      let stats: fsSync.Stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch (statError) {
        throw new Error(`文件状态获取失败 ${absolutePath}: ${statError instanceof Error ? statError.message : String(statError)}`);
      }

      let fileContent: string;
      try {
        fileContent = await fs.readFile(absolutePath, 'utf-8');
      } catch (readError) {
        throw new Error(`文件读取失败 ${absolutePath}: ${readError instanceof Error ? readError.message : String(readError)}`);
      }

      let data: unknown;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`JSON解析失败 ${absolutePath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const entries = this.normalizeToEntries(data, []);

      let meta: Partial<WorldBookMeta> | undefined;

      // 尝试提取元数据
      if (this.isWorldBookDictShape(data)) {
        meta = data.meta;
      } else if (this.isWorldBookArrayShape(data)) {
        meta = data.meta;
      }

      return {
        name: meta?.name || path.basename(filePath, path.extname(filePath)),
        path: filePath,
        entryCount: entries.length,
        fileSize: stats.size,
        lastModified: stats.mtime.getTime(),
        meta,
        loaded: true
      };
    } catch (error) {
      return {
        name: path.basename(filePath, path.extname(filePath)),
        path: filePath,
        entryCount: 0,
        fileSize: 0,
        lastModified: 0,
        loaded: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /* ------------------ 私有方法 ------------------ */

  private normalizeToEntries(input: unknown, warnings: string[]): WorldEntry[] {
    try {
      // 允许 string -> JSON 解析
      const data: any = typeof input === 'string' ? JSON.parse(input) : input;

      if (Array.isArray(data)) {
        return data.map(e => this.sanitizeEntry(e, warnings));
      }

      if (data && typeof data === 'object') {
        // 常见：{ entries: [...] } 或 { entries: { "0": {...}, "1": {...} } }
        if (Array.isArray((data as any).entries)) {
          return (data as any).entries.map((e: any) => this.sanitizeEntry(e, warnings));
        }
        if ((data as any).entries && typeof (data as any).entries === 'object') {
          return Object.values((data as any).entries).map((e: any) => this.sanitizeEntry(e, warnings));
        }
        // 顶层是字典
        return Object.values(data as Record<string, unknown>).map((e: any) => this.sanitizeEntry(e, warnings));
      }

      warnings.push('无法识别的世界书数据格式');
      return [];
    } catch (error) {
      warnings.push(`解析世界书数据失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private sanitizeEntry(raw: any, warnings: string[]): WorldEntry {
    const e: WorldEntry = { ...raw };

    // 一些常见字段类型清洗
    if (e.key && !Array.isArray(e.key)) {
      e.key = [String(e.key)];
    }
    if (e.keysecondary && !Array.isArray(e.keysecondary)) {
      e.keysecondary = [String(e.keysecondary)];
    }

    if (typeof e.uid === 'number' || typeof e.uid === 'string') {
      // ok
    } else {
      // 兜底 uid
      e.uid = (raw && (raw.uid ?? raw.id)) ?? undefined;
    }

    // 验证必要字段
    if (!e.key && !e.comment && !e.content) {
      warnings.push(`词条 ${e.uid || 'unknown'} 缺少关键词、标题或内容`);
    }

    return e;
  }

  private sortEntries(
    entries: WorldEntry[],
    primary: Required<ToMarkdownOptions>['sortBy'],
    secondary: Required<ToMarkdownOptions>['secondarySortBy']
  ) {
    const titleOf = (e: WorldEntry) => this.makeTitle(e, 'auto').toLowerCase();

    const by = (a: WorldEntry, b: WorldEntry, key: 'order'|'displayIndex'|'uid'|'title') => {
      switch (key) {
        case 'order':
          return this.numCmp(a.order, b.order) ||
                 this.numCmp(a.displayIndex, b.displayIndex) ||
                 this.numCmp(a.uid as any, b.uid as any) ||
                 titleOf(a).localeCompare(titleOf(b));
        case 'displayIndex':
          return this.numCmp(a.displayIndex, b.displayIndex) ||
                 this.numCmp(a.order, b.order) ||
                 this.numCmp(a.uid as any, b.uid as any) ||
                 titleOf(a).localeCompare(titleOf(b));
        case 'uid':
          return this.numCmp(a.uid as any, b.uid as any) ||
                 this.numCmp(a.order, b.order) ||
                 titleOf(a).localeCompare(titleOf(b));
        case 'title':
          return titleOf(a).localeCompare(titleOf(b)) ||
                 this.numCmp(a.order, b.order) ||
                 this.numCmp(a.uid as any, b.uid as any);
      }
    };

    const arr = [...entries];
    if (primary === 'none') return arr;

    arr.sort((a, b) => {
      const p = by(a, b, primary as any);
      if (p !== 0) return p;
      return by(a, b, secondary);
    });
    return arr;
  }

  private numCmp(a: any, b: any) {
    const na = this.toNum(a);
    const nb = this.toNum(b);
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    return na - nb;
  }

  private toNum(v: any): number | null {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return +v;
    return null;
  }

  private makeTitle(e: WorldEntry, strategy: ToMarkdownOptions['titleStrategy']): string {
    if (strategy === 'comment') return e.comment?.trim() || this.defaultTitle(e);
    if (strategy === 'key') return (e.key?.[0] ?? '').toString() || this.defaultTitle(e);
    if (strategy === 'uid') return `词条 #${e.uid ?? ''}`.trim();
    // auto
    return e.comment?.trim() ||
           (e.key?.[0] ?? '').toString().trim() ||
           (e.uid !== undefined ? `词条 #${e.uid}` : '未命名词条');
  }

  private defaultTitle(e: WorldEntry): string {
    return e.uid !== undefined ? `词条 #${e.uid}` : '未命名词条';
  }

  private renderMetaTable(e: WorldEntry): string {
    const rows: Array<[string, string | undefined]> = [
      ['ID', e.uid?.toString()],
      ['标题', e.comment?.trim()],
      ['常驻', this.truthy(e.constant) ? '是' : undefined],
      ['向量化', this.truthy(e.vectorized) ? '是' : undefined],
      ['选择性', this.truthy(e.selective) ? `是 (逻辑=${e.selectiveLogic ?? 'N/A'})` : undefined],
      ['排序', this.valueStr(e.order)],
      ['位置', this.valueStr(e.position)],
      ['分组', e.group],
      ['权重', this.valueStr(e.groupWeight)],
      ['禁用', this.truthy(e.disable) ? '是' : undefined],
    ].filter(([_, v]) => v !== undefined && v !== '') as Array<[string, string]>;

    if (!rows.length) return '';

    const header = `| 属性 | 值 |
| --- | --- |`;
    const body = rows.map(([k, v]) => `| ${this.escapeMdInline(k)} | ${this.escapeMdInline(String(v))} |`).join('\n');
    return [header, body].join('\n');
  }

  private renderYamlFrontMatter(e: WorldEntry): string {
    const kv = {
      uid: e.uid ?? null,
      comment: e.comment ?? null,
      constant: !!e.constant || undefined,
      vectorized: !!e.vectorized || undefined,
      selective: !!e.selective || undefined,
      selectiveLogic: e.selective ? e.selectiveLogic ?? null : undefined,
      order: e.order ?? undefined,
      position: e.position ?? undefined,
      group: e.group ?? undefined,
      groupWeight: e.groupWeight ?? undefined,
      disabled: !!e.disable || undefined,
    } as Record<string, unknown>;

    const yaml = Object.entries(kv)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${this.yamlScalar(v)}`)
      .join('\n');

    return ['---', yaml, '---'].join('\n');
  }

  private yamlScalar(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    const s = String(v);
    if (/^[\w\-\.]+$/.test(s)) return s;
    return JSON.stringify(s); // 简易转义
  }

  private renderKeys(e: WorldEntry): string {
    const keys = (e.key ?? []).filter(Boolean).map(String);
    const sec = (e.keysecondary ?? []).filter(Boolean).map(String);

    if (!keys.length && !sec.length) return '';
    const k = keys.length ? `**关键词：** ${this.escapeMdInline(keys.join(' · '))}` : '';
    const s = sec.length ? `**同义词：** ${this.escapeMdInline(sec.join(' · '))}` : '';
    return [k, s].filter(Boolean).join('  \n'); // 两空格换行 -> MD 换行
  }

  private escapeMdInline(s: string): string {
    // 极简内联转义，够用就行：管 | * _ ` [ ] < >
    return s.replace(/[|*_`\[\]<>]/g, m => '\\' + m);
  }

  private valueStr(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined;
    return String(v);
  }

  private truthy(v: unknown): boolean {
    return !!v;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  private isWorldBookDictShape(data: any): data is WorldBookDictShape {
    return data && typeof data === 'object' &&
           typeof data.entries === 'object' &&
           !Array.isArray(data.entries);
  }

  private isWorldBookArrayShape(data: any): data is WorldBookArrayShape {
    return data && typeof data === 'object' &&
           Array.isArray(data.entries);
  }
}

/**
 * 便捷函数：转换世界书为Markdown
 */
export function convertWorldBookToMarkdown(
  input: unknown,
  options?: ToMarkdownOptions
): Promise<WorldBookConversionResult> {
  const converter = new WorldBookConverter();
  return converter.convertToMarkdown(input, options);
}

/**
 * 便捷函数：从文件转换世界书
 */
export function convertWorldBookFile(
  filePath: string,
  options?: ToMarkdownOptions
): Promise<WorldBookConversionResult> {
  const converter = new WorldBookConverter();
  return converter.loadFromFile(filePath, options);
}

// Re-export types that are commonly used by external modules
export type { WorldBookInfo } from './silly-tavern-worldbook.js';