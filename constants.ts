
import { User, UserRole, UserStatus, Project, ProjectCategory, ProjectStatus, Application, Invoice, InvoiceStatus, ApplicationStatus, Message, Notification, NotificationType } from './types';

// n8n Webhook URLs
export const N8N_INVOICE_WEBHOOK_URL = 'https://pantheon-official.app.n8n.cloud/webhook/generate-invoice';

export const EXPERIENCE_TAGS = ['kintone', 'Shopify', 'freee', 'Slack', 'HubSpot', 'Salesforce', 'Notion', 'Zapier', 'Make'];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: '運営管理者',
    email: 'admin@pantheon.inc',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    avatarUrl: 'https://ui-avatars.com/api/?name=Admin+User&background=0F2E53&color=fff',
    phoneNumber: '03-1234-5678',
    postalCode: '100-0001',
    address: '東京都千代田区千代田1-1'
  }
];

export const MOCK_PROJECTS: Project[] = [];

export const MOCK_APPLICATIONS: Application[] = [];

export const MOCK_INVOICES: Invoice[] = [];

// Mock Messages (Direct Messages & Project Messages)
export const MOCK_MESSAGES: Message[] = [];

export const MOCK_NOTIFICATIONS: Notification[] = [];
