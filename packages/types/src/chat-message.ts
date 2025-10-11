/**
 * Chat Message
 * 基础的聊天消息类型定义，用于触发词系统
 */

export interface ChatMessage {
  /** 消息内容 */
  content: string;
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息时间戳 */
  timestamp?: number;
  /** 消息ID */
  id?: string;
  /** 额外的元数据 */
  metadata?: Record<string, any>;
}