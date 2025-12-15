
import React, { useState, useEffect } from 'react';
import { User, Project, Invoice, UserRole, UserStatus, ProjectStatus, InvoiceStatus, Application, Message, ApplicationStatus, Notification, NotificationType } from '../types';
import { 
  Activity, 
  Briefcase, 
  Users, 
  MessageCircle, 
  CreditCard,
  Shield
} from 'lucide-react';
import { Projects } from './Projects';
import { Invoices } from './Invoices';
import { AdminPartners } from './AdminPartners';
import { PartnerDashboard } from './PartnerDashboard';
import { AdminOverview } from './AdminOverview';
import { AdminMessages } from './AdminMessages';

interface DashboardProps {
  currentUser: User;
  projects: Project[];
  invoices: Invoice[];
  allUsers: User[];
  onChangeView: (view: any, params?: any) => void;
  // Actions for Admin Integration
  onApprove?: (userId: string) => void;
  onReject?: (userId: string) => void;
  onUpdateUserStatus?: (userId: string, status: UserStatus) => void;
  onUpdateInvoiceStatus?: (invoiceId: string, status: InvoiceStatus) => void;
  // Actions for Projects Integration
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  applications?: Application[];
  onApply?: (projectId: string, message: string, quote: number) => void;
  onHire?: (projectId: string, applicationId: string, userId: string) => void;
  onCreateProject?: (project: Partial<Project>) => void;
  messages?: Message[];
  onSendMessage?: (projectId: string, content: string, file?: File) => void;
  // New: DM Action
  onSendDirectMessage?: (receiverId: string, content: string, file?: File) => void;
  onMarkAsRead?: (senderId: string, receiverId: string) => void;
  onMarkProjectAsRead?: (projectId: string) => void; // New
  // New: Project Completion
  onCompleteProject?: (projectId: string, review: { score: number, comment: string }) => void;
  // New: Navigate to Profile from Dashboard with Context
  onViewProfile?: (userId: string, context?: any) => void;
  onUpdateProfile?: (userId: string, data: Partial<User>) => void;
  initialTab?: 'OVERVIEW' | 'PARTNERS' | 'FINANCE' | 'PROJECTS' | 'MESSAGES';
  initialProjectId?: string;
  initialSelectedChatUserId?: string;
  notifications?: Notification[];
  onMarkNotificationAsRead?: (id: string) => void;
}

// --- Dashboard Component ---
export const Dashboard: React.FC<DashboardProps> = ({ 
  currentUser, projects, invoices, allUsers, onChangeView,
  onApprove, onReject, onUpdateUserStatus, onUpdateInvoiceStatus,
  setProjects, applications, onApply, onHire, onCreateProject, messages, onSendMessage,
  onSendDirectMessage, onMarkAsRead, onMarkProjectAsRead, onCompleteProject, onViewProfile, onUpdateProfile, initialTab, initialProjectId, initialSelectedChatUserId,
  notifications, onMarkNotificationAsRead
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PARTNERS' | 'FINANCE' | 'PROJECTS' | 'MESSAGES'>(initialTab || 'OVERVIEW');
  const [dashboardChatUserId, setDashboardChatUserId] = useState<string | null>(initialSelectedChatUserId || null);
  
  // Sync initialSelectedChatUserId from props to state (for back navigation etc)
  useEffect(() => {
    if (initialSelectedChatUserId) {
        setDashboardChatUserId(initialSelectedChatUserId);
    }
  }, [initialSelectedChatUserId]);

  // Calculate specific metrics for admin tab badges
  // jobPortalEnabled が true のユーザー、または role が PARTNER のユーザーをパートナーとして扱う
  const partners = allUsers.filter(u => u.jobPortalEnabled === true || u.role === UserRole.PARTNER);
  // FIX: Only count pending PARTNERS (exclude Admin if status is pending)
  const pendingPartners = partners.filter(u => u.status === UserStatus.PENDING).length;

  const getUnreadCount = (senderId: string) => {
    return messages ? messages.filter(m => !m.projectId && m.senderId === senderId && m.receiverId === currentUser.id && !m.isRead).length : 0;
  };
  
  // Badge Calculations
  const partnersBadgeCount = pendingPartners;
  const totalUnreadMessages = partners.reduce((acc, partner) => acc + getUnreadCount(partner.id), 0);
  const unreadProjectMessages = messages ? messages.filter(m => m.projectId && m.senderId !== currentUser.id && !m.isRead).length : 0;
  const newApplications = applications ? applications.filter(a => a.status === ApplicationStatus.APPLIED && !a.isRead).length : 0;
  const projectsBadgeCount = unreadProjectMessages + newApplications;
  
  // FIX: Count invoices strictly with BILLED status
  const financeBadgeCount = invoices ? invoices.filter(i => i.status === InvoiceStatus.BILLED).length : 0;

  const TabButton = ({ id, label, icon: Icon, badgeCount }: { id: typeof activeTab, label: string, icon: any, badgeCount?: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all font-bold text-sm ${
        activeTab === id 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <div className="relative">
         <Icon size={18} />
      </div>
      <span>{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center shadow-sm">
            {badgeCount}
        </span>
      )}
    </button>
  );

  // --- Partner View ---
  if (!isAdmin) {
    return (
       <PartnerDashboard 
          currentUser={currentUser}
          projects={projects}
          invoices={invoices}
          applications={applications}
          messages={messages}
          notifications={notifications}
          onChangeView={onChangeView}
          onMarkNotificationAsRead={onMarkNotificationAsRead}
          onMarkProjectAsRead={onMarkProjectAsRead}
       />
    );
  }

  // --- Admin View ---
  return (
    <div className="bg-slate-900 min-h-screen -m-4 md:-m-8 p-4 md:p-8 text-slate-200 font-sans">
      {/* Header & Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="bg-blue-600 p-1.5 rounded-lg"><Shield size={20} className="text-white"/></span>
            全社統括ダッシュボード
          </h1>
          <p className="text-slate-400 text-sm mt-1">リアルタイム モニタリング & 管理コンソール</p>
        </div>
        
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex flex-wrap gap-1">
          <TabButton id="OVERVIEW" label="概要" icon={Activity} />
          <TabButton id="PROJECTS" label="案件管理" icon={Briefcase} badgeCount={projectsBadgeCount} />
          <TabButton id="PARTNERS" label="パートナー管理" icon={Users} badgeCount={partnersBadgeCount} />
          <TabButton id="MESSAGES" label="メッセージ" icon={MessageCircle} badgeCount={totalUnreadMessages} />
          <TabButton id="FINANCE" label="財務管理" icon={CreditCard} badgeCount={financeBadgeCount} />
        </div>
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === 'OVERVIEW' && (
        <AdminOverview
            currentUser={currentUser}
            invoices={invoices}
            allUsers={allUsers}
            projects={projects}
            messages={messages}
            applications={applications}
            onChangeView={onChangeView}
            onMarkProjectAsRead={onMarkProjectAsRead}
            onViewProfile={onViewProfile}
        />
      )}

      {/* === PROJECTS TAB (INTEGRATED) === */}
      {activeTab === 'PROJECTS' && (
        <div className="animate-in fade-in duration-500">
           {/* Wrap Projects Component */}
           <Projects
              currentUser={currentUser}
              projects={projects}
              setProjects={setProjects || (() => {})} // Safe fallback
              applications={applications || []}
              onApply={onApply || (() => console.warn('onApply missing'))} 
              onHire={onHire || ((projectId, appId, userId) => console.warn('onHire missing or not passed to Dashboard'))}
              onCreateProject={onCreateProject || (() => {})}
              messages={messages || []}
              onSendMessage={onSendMessage || (() => {})}
              users={allUsers}
              onCompleteProject={onCompleteProject}
              onViewProfile={(userId, context) => onViewProfile && onViewProfile(userId, { ...context, tab: activeTab })}
              onUpdateProfile={onUpdateProfile}
              initialProjectId={initialProjectId}
              onMarkProjectAsRead={onMarkProjectAsRead} // Pass down
           />
        </div>
      )}

      {/* === PARTNERS TAB === */}
      {activeTab === 'PARTNERS' && (
        <div className="animate-in fade-in duration-500">
            <AdminPartners 
                users={allUsers}
                invoices={invoices}
                projects={projects}
                onApprove={(userId) => onApprove && onApprove(userId)}
                onReject={(userId) => onReject && onReject(userId)}
                onUpdateStatus={(userId, status) => onUpdateUserStatus && onUpdateUserStatus(userId, status)}
                onViewProfile={(userId) => onViewProfile && onViewProfile(userId, { tab: activeTab })}
                onStartChat={(userId) => {
                    setDashboardChatUserId(userId);
                    setActiveTab('MESSAGES');
                }}
            />
        </div>
      )}

      {/* === MESSAGES TAB (INTEGRATED) === */}
      {activeTab === 'MESSAGES' && (
        <AdminMessages 
            currentUser={currentUser}
            allUsers={allUsers}
            messages={messages || []}
            onSendMessage={onSendDirectMessage}
            onMarkAsRead={onMarkAsRead}
            onViewProfile={onViewProfile}
            initialSelectedChatUserId={dashboardChatUserId}
        />
      )}

      {/* === FINANCE TAB (INTEGRATED) === */}
      {activeTab === 'FINANCE' && (
        <div className="animate-in fade-in duration-500 space-y-6">
           {/* Wrap Invoices Component inside a styled container matching admin theme */}
           <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
               <Invoices 
                  currentUser={currentUser}
                  invoices={invoices}
                  projects={projects}
                  users={allUsers}
                  onUpdateStatus={onUpdateInvoiceStatus}
                  onCreateInvoice={async () => {}} // Admin doesn't create invoices usually, but kept for interface compat
               />
           </div>
        </div>
      )}
    </div>
  );
};
