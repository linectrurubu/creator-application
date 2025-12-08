
export enum UserRole {
  ADMIN = 'ADMIN',
  PARTNER = 'PARTNER'
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED'
}

export enum ProjectCategory {
  LECTURER = 'LECTURER',
  DX_CONSULTING = 'DX_CONSULTING',
  DEVELOPMENT = 'DEVELOPMENT'
}

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  RECRUITING = 'RECRUITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  HIRED = 'HIRED'
}

export enum InvoiceStatus {
  UNBILLED = 'UNBILLED',
  BILLED = 'BILLED',
  PAID = 'PAID'
}

export enum NotificationType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  MESSAGE = 'MESSAGE'
}

export interface Review {
  score: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  n8nProfileUrl?: string;
  invoiceNumber?: string;
  bankAccountInfo?: string; // Mocked encrypted string
  experienceTags?: string[];
  selfIntroduction?: string;
  avatarUrl?: string;
  // New Profile Fields
  availableCategories?: ProjectCategory[];
  portfolioUrl?: string;
  // New Mandatory Fields
  phoneNumber?: string;
  postalCode?: string;
  address?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: ProjectCategory;
  budget: number;
  requiredSkills: string[];
  status: ProjectStatus;
  createdAt: string;
  assignedToUserId?: string; // If null, still recruiting or draft
  // New Review Field
  review?: Review;
}

export interface Application {
  id: string;
  projectId: string;
  userId: string;
  status: ApplicationStatus;
  message: string;
  quoteAmount: number;
  availableStartDate: string;
  createdAt: string;
  isRead?: boolean; // New: Read status for admin notification
}

export interface Invoice {
  id: string;
  userId: string;
  projectId: string;
  amount: number;
  issueDate: string;
  status: InvoiceStatus;
  pdfUrl?: string; // Virtual link
}

export interface Message {
  id: string;
  projectId?: string; // Optional: If null, it's a Direct Message
  senderId: string;
  receiverId?: string; // Optional: Required for Direct Message
  content: string;
  createdAt: string;
  attachments?: string[]; // Legacy for projects
  attachmentUrl?: string; // New: For DM file upload
  attachmentName?: string; // New: For DM file name
  attachmentType?: 'image' | 'file'; // New: Visual type
  attachmentSize?: string; // New: Visual size string (e.g. "1.2 MB")
  isRead?: boolean; // New: Read receipt status
}

// Navigation State
export type ViewState = 
  | 'LOGIN' 
  | 'REGISTER' 
  | 'DASHBOARD' 
  | 'PROJECTS_LIST' 
  | 'PROJECT_DETAIL' 
  | 'INVOICES' 
  | 'ADMIN_PARTNERS'
  | 'DIRECT_MESSAGES'
  | 'PROFILE'; // New View