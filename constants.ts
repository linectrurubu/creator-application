import { Project, ProjectCategory, ProjectStatus, Application, Invoice, InvoiceStatus, ApplicationStatus, Message, Notification, NotificationType } from './types';

// n8n Webhook URLs
export const N8N_INVOICE_WEBHOOK_URL = 'https://pantheon-official.app.n8n.cloud/webhook/generate-invoice';

// 案件ポータルで選択可能な経験タグ
export const EXPERIENCE_TAGS = ['kintone', 'Shopify', 'freee', 'Slack', 'HubSpot', 'Salesforce', 'Notion', 'Zapier', 'Make'];

// モックデータは削除 - ユーザーはクリエイターポータルで管理
// export const MOCK_USERS: User[] = [];

export const MOCK_PROJECTS: Project[] = [];

export const MOCK_APPLICATIONS: Application[] = [];

export const MOCK_INVOICES: Invoice[] = [];

export const MOCK_MESSAGES: Message[] = [];

export const MOCK_NOTIFICATIONS: Notification[] = [];
