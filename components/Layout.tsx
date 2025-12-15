import React, { useState } from 'react';
import { User, UserRole, Notification, NotificationType, UserStatus } from '../types';
import { Toast, ToastProps } from './Toast';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  LogOut, 
  Menu, 
  Bell,
  Shield,
  MessageCircle,
  User as UserIcon,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Check,
  Home,
  Search
} from 'lucide-react';

interface LayoutProps {
  currentUser: User;
  currentView: string;
  onChangeView: (view: any) => void;
  onLogout: () => void;
  children: React.ReactNode;
  notifications?: Notification[];
  activeToasts?: ToastProps[]; // New prop for toasts
  onCloseToast?: (id: string) => void; // New handler
  onMarkAllAsRead?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  currentUser, 
  currentView, 
  onChangeView, 
  onLogout, 
  children,
  notifications = [],
  activeToasts = [],
  onCloseToast,
  onMarkAllAsRead
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const isAdmin = currentUser.role === UserRole.ADMIN;
  // Check if partner is restricted (Pending or Rejected)
  const isRestrictedPartner = !isAdmin && currentUser.status !== UserStatus.ACTIVE;

  // Filter notifications for current user
  const myNotifications = notifications.filter(n => n.userId === currentUser.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unreadCount = myNotifications.filter(n => !n.isRead).length;

  // Theme Config based on Role
  const theme = {
    bg: isAdmin ? 'bg-slate-900' : 'bg-bg-light',
    sidebar: isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100',
    sidebarHeader: isAdmin ? 'bg-slate-900 border-slate-700' : 'bg-pantheon-navy border-gray-100',
    sidebarText: isAdmin ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100',
    sidebarActive: isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-pantheon-navy text-white shadow-md',
    header: isAdmin ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200',
    headerIcon: isAdmin ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-600',
    userSection: isAdmin ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-100 text-gray-800',
    logout: isAdmin ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-red-600 hover:bg-red-50',
    mainText: isAdmin ? 'text-slate-200' : 'text-text-main',
    popoverBg: isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
    popoverText: isAdmin ? 'text-slate-200' : 'text-gray-800'
  };

  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => {
          onChangeView(view);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive 
            ? theme.sidebarActive
            : theme.sidebarText
        }`}
      >
        <Icon size={20} className={isActive ? (isAdmin ? 'text-white' : 'text-n8n-orange') : (isAdmin ? 'text-slate-500' : 'text-gray-500')} />
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  // Mobile Bottom Nav Item
  const BottomNavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => {
    const isActive = currentView === view;
    return (
      <button 
        onClick={() => onChangeView(view)}
        className={`flex flex-col items-center justify-center p-2 flex-1 transition-colors ${isActive ? 'text-pantheon-navy' : 'text-gray-400'}`}
      >
        <Icon size={24} className={isActive ? 'text-n8n-orange' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">{label}</span>
      </button>
    );
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch(type) {
      case NotificationType.SUCCESS: return <CheckCircle size={18} className="text-green-500" />;
      case NotificationType.WARNING: return <AlertTriangle size={18} className="text-yellow-500" />;
      case NotificationType.ERROR: return <XCircle size={18} className="text-red-500" />;
      case NotificationType.MESSAGE: return <MessageCircle size={18} className="text-purple-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.mainText} flex font-sans transition-colors duration-300 relative`}>
      {/* Sidebar - Only for Partner */}
      {!isAdmin && (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out flex flex-col ${theme.sidebar} border-r hidden md:flex`}>
            <div className={`h-20 flex items-center justify-center border-b shrink-0 ${theme.sidebarHeader}`}>
              <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 bg-n8n-orange rounded-md flex items-center justify-center text-white font-bold">P</div>
                 <span className="text-xl font-bold tracking-tight text-white">Pantheon</span>
              </div>
            </div>

            <div className="p-4 space-y-2 mt-4 flex-1 overflow-y-auto">
              {!isRestrictedPartner && (
                <>
                  <NavItem view="DASHBOARD" icon={LayoutDashboard} label="ダッシュボード" />
                  <NavItem view="PROJECTS_LIST" icon={Briefcase} label="案件を探す" />
                  <NavItem view="INVOICES" icon={FileText} label="売上・請求書" />
                </>
              )}
              <NavItem view="PROFILE" icon={UserIcon} label="プロフィール" />
              {!isRestrictedPartner && (
                <div className="pt-4 mt-4 border-t border-gray-100">
                   <NavItem view="DIRECT_MESSAGES" icon={MessageCircle} label="メッセージ" />
                </div>
              )}
            </div>

            <div className={`p-4 border-t shrink-0 ${theme.userSection}`}>
              <div className="flex items-center space-x-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <UserIcon size={20} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                  <p className="text-xs text-gray-500">
                    {currentUser.status === UserStatus.PENDING ? '承認待ち' : 
                     currentUser.status === UserStatus.REJECTED ? '利用停止' : 'パートナー'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className={`w-full flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-colors ${theme.logout}`}
              >
                <LogOut size={16} />
                <span>ログアウト</span>
              </button>
            </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* Header */}
        <header className={`h-16 border-b flex items-center justify-between px-4 md:px-8 shrink-0 ${theme.header} relative`}>
          <div className="flex items-center">
             {/* Logo for mobile partner view */}
             {!isAdmin && (
               <div className="md:hidden flex items-center space-x-2">
                 <div className="w-8 h-8 bg-n8n-orange rounded-md flex items-center justify-center text-white font-bold">P</div>
                 <span className="font-bold text-gray-800">Pantheon</span>
               </div>
             )}

            {/* Admin Logo in Header (Always visible for Admin since sidebar is gone) */}
            {isAdmin && (
               <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/50">
                    <Shield size={18} />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-white">
                    Admin
                  </span>
               </div>
            )}
            
            {/* Restricted Status Banner */}
            {isRestrictedPartner && (
              <div className="ml-4 flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200">
                <AlertTriangle size={14} className="mr-1" />
                {currentUser.status === UserStatus.PENDING ? '承認待ち: プロフィールを充実させてお待ちください' : 'アカウント制限中: 管理者へお問い合わせください'}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-6 ml-auto">
            {/* Notification Bell */}
            {!isRestrictedPartner && (
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 ${theme.headerIcon} ${showNotifications ? 'bg-slate-800 text-white' : ''} hover:bg-slate-700/50 rounded-full transition-colors`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-n8n-orange rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className={`absolute right-0 mt-2 w-80 ${theme.popoverBg} rounded-xl shadow-2xl border overflow-hidden z-20`}>
                     <div className={`p-3 border-b ${isAdmin ? 'border-slate-700' : 'border-gray-100'} flex justify-between items-center`}>
                        <h3 className={`font-bold text-sm ${theme.popoverText}`}>通知</h3>
                        {unreadCount > 0 && (
                           <button 
                             onClick={onMarkAllAsRead}
                             className="text-xs text-blue-500 hover:text-blue-600 flex items-center"
                           >
                             <Check size={12} className="mr-1" /> すべて既読
                           </button>
                        )}
                     </div>
                     <div className="max-h-80 overflow-y-auto">
                        {myNotifications.length === 0 ? (
                           <div className={`p-8 text-center text-sm ${isAdmin ? 'text-slate-500' : 'text-gray-400'}`}>
                             通知はありません
                           </div>
                        ) : (
                           myNotifications.map(notification => (
                             <div 
                               key={notification.id} 
                               className={`p-3 border-b ${isAdmin ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-50 hover:bg-gray-50'} transition-colors relative ${!notification.isRead ? (isAdmin ? 'bg-slate-800' : 'bg-blue-50/30') : ''}`}
                             >
                                <div className="flex items-start gap-3">
                                   <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                                   <div className="flex-1">
                                      <p className={`text-sm font-medium ${theme.popoverText}`}>{notification.title}</p>
                                      <p className={`text-xs mt-1 ${isAdmin ? 'text-slate-400' : 'text-gray-500'}`}>{notification.message}</p>
                                      <p className="text-[10px] text-gray-400 mt-2 text-right">{notification.createdAt}</p>
                                   </div>
                                </div>
                                {!notification.isRead && (
                                   <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                             </div>
                           ))
                        )}
                     </div>
                  </div>
                </>
              )}
            </div>
            )}

            {/* Admin User Profile & Logout in Header */}
            {isAdmin && (
              <div className="flex items-center space-x-4 pl-4 border-l border-slate-700">
                   <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white ring-2 ring-slate-800">
                        <UserIcon size={16} />
                      </div>
                      <div className="hidden md:block text-right">
                        <p className="text-sm font-bold text-slate-200 leading-none">{currentUser.name}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Administrator</p>
                      </div>
                   </div>
                   <button 
                      onClick={onLogout}
                      className={`p-2 rounded-lg transition-colors ${theme.logout}`}
                      title="ログアウト"
                   >
                      <LogOut size={20} />
                   </button>
              </div>
            )}
            
            {/* Mobile Logout for Partner (in Header) */}
            {!isAdmin && (
                <button onClick={onLogout} className="md:hidden text-gray-400 hover:text-red-500">
                    <LogOut size={20} />
                </button>
            )}
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide relative ${!isAdmin ? 'pb-24 md:pb-8' : ''}`}>
          <div className="max-w-7xl mx-auto pb-10">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation (Partner Only) */}
        {!isAdmin && (
           <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-safe">
              <div className="flex justify-around items-center h-16">
                 {!isRestrictedPartner && <BottomNavItem view="DASHBOARD" icon={Home} label="ホーム" />}
                 {!isRestrictedPartner && <BottomNavItem view="PROJECTS_LIST" icon={Search} label="探す" />}
                 {!isRestrictedPartner && <BottomNavItem view="DIRECT_MESSAGES" icon={MessageCircle} label="メッセージ" />}
                 <BottomNavItem view="PROFILE" icon={UserIcon} label="マイページ" />
              </div>
           </div>
        )}
      </div>

      {/* Toast Notifications Container */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {activeToasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={onCloseToast || (() => {})} />
          </div>
        ))}
      </div>
    </div>
  );
};