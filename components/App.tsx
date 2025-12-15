
import React, { useState, useEffect } from 'react';
import { 
  User, Project, Application, Invoice, Message, Notification,
  ViewState, UserRole, UserStatus, ApplicationStatus, ProjectStatus, InvoiceStatus, NotificationType 
} from './types';
import { N8N_INVOICE_WEBHOOK_URL } from './constants';
import { Layout } from './components/Layout';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Projects } from './components/Projects';
import { Invoices } from './components/Invoices';
import { AdminPartners } from './components/AdminPartners';
import { DirectMessages } from './components/DirectMessages';
import { Profile } from './components/Profile';
import { ToastProps } from './components/Toast';
import { createDocument, updateDocument, subscribeToCollection, subscribeToNotifications } from './services';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface HistoryItem {
  view: ViewState;
  viewParams: any;
  selectedUserProfileId: string | null;
}

const App: React.FC = () => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [viewParams, setViewParams] = useState<any>(null); // Navigation parameters
  const [history, setHistory] = useState<HistoryItem[]>([]); // Navigation History
  
  // Data State (Real DB)
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Toast State
  const [activeToasts, setActiveToasts] = useState<ToastProps[]>([]);

  // Profile Viewing State (for Admin viewing others)
  const [selectedUserProfileId, setSelectedUserProfileId] = useState<string | null>(null);

  // Data Subscriptions
  useEffect(() => {
    // Subscribe to collections
    const unsubUsers = subscribeToCollection('users', (data) => setUsers(data as User[]));
    const unsubProjects = subscribeToCollection('projects', (data) => setProjects(data as Project[]));
    const unsubApplications = subscribeToCollection('applications', (data) => setApplications(data as Application[]));
    const unsubInvoices = subscribeToCollection('invoices', (data) => setInvoices(data as Invoice[]));
    const unsubMessages = subscribeToCollection('messages', (data) => setMessages(data as Message[]));

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubProjects) unsubProjects();
      if (unsubApplications) unsubApplications();
      if (unsubInvoices) unsubInvoices();
      if (unsubMessages) unsubMessages();
    };
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // Fetch user details from Firestore with retry logic to handle registration race condition
            try {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                let userDoc = await getDoc(userDocRef);
                
                // Retry loop: Wait up to 2 seconds for the document to be created (by signUp service)
                if (!userDoc.exists()) {
                    for (let i = 0; i < 4; i++) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        userDoc = await getDoc(userDocRef);
                        if (userDoc.exists()) break;
                    }
                }
                
                if (userDoc.exists()) {
                    const userData = userDoc.data() as User;
                    setCurrentUser(userData);
                } else {
                    // Fallback: Create default user profile if still missing (Self-healing)
                    console.warn("User profile missing after retries. Creating default profile for:", firebaseUser.uid);
                    const newUser: User = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || 'Unknown User',
                        email: firebaseUser.email || '',
                        role: UserRole.PARTNER,
                        status: UserStatus.PENDING,
                        avatarUrl: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.email?.charAt(0)}&background=random`,
                        phoneNumber: '',
                        postalCode: '',
                        address: ''
                    };
                    await setDoc(userDocRef, newUser);
                    setCurrentUser(newUser);
                }

                // If we are on LOGIN/REGISTER, go to DASHBOARD
                if (view === 'LOGIN' || view === 'REGISTER') {
                        setView('DASHBOARD');
                        // Show Welcome Toast only once
                        if (!currentUser) { // Simple check to avoid double toast on re-renders
                            showToast(NotificationType.INFO, `ようこそ`, 'ダッシュボードへログインしました。');
                        }
                }
            } catch (e) {
                console.error("Error fetching or creating user data:", e);
                // Force logout if critical error
                auth.signOut();
                setCurrentUser(null);
                setView('LOGIN');
            }
        } else {
            setCurrentUser(null);
            setView('LOGIN');
        }
    });
    return () => unsubscribe();
  }, [view]);

  // Notifications Subscription
  useEffect(() => {
    if (currentUser) {
      const unsub = subscribeToNotifications(currentUser.id, (data) => setNotifications(data));
      return () => { if(unsub) unsub(); };
    } else {
      setNotifications([]);
    }
  }, [currentUser]);

  // Helper: Add Notification & Show Toast
  const addNotification = (userId: string, type: NotificationType, title: string, message: string, link?: string) => {
    // 1. Add to Firestore (subscriptions will update UI)
    const newNotification: Notification = {
      id: `n${Date.now()}`,
      userId,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }),
      link
    };
    // Use Firestore createDocument for notifications
    createDocument('notifications', newNotification).catch(console.error);

    // 2. Show Toast (Only if the notification belongs to the current user)
    if (currentUser && userId === currentUser.id) {
        showToast(type, title, message);
    }
  };

  const showToast = (type: NotificationType, title: string, message: string) => {
      const id = `t${Date.now()}`;
      setActiveToasts(prev => [...prev, { id, type, title, message, onClose: handleCloseToast }]);
  };

  const handleCloseToast = (id: string) => {
      setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper: Mark all notifications as read for current user
  const handleMarkAllNotificationsRead = () => {
    if (!currentUser) return;
    notifications.forEach(n => {
        if (!n.isRead && n.userId === currentUser.id) {
             updateDocument('notifications', n.id, { isRead: true });
        }
    });
  };

  const handleMarkNotificationAsRead = (id: string) => {
    updateDocument('notifications', id, { isRead: true });
  };

  // Auth Handlers
  const handleLogin = (userId: string, role: UserRole) => {
    // 共有テストアカウント用のログイン処理
    if (userId === 'shared-admin' && role === UserRole.ADMIN) {
      const adminUser: User = {
        id: 'shared-admin',
        name: 'Pantheon Admin',
        email: 'admin@pantheon.inc',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=1a1a2e&color=fff',
        phoneNumber: '',
        postalCode: '',
        address: ''
      };
      setCurrentUser(adminUser);
      setView('DASHBOARD');
      showToast(NotificationType.INFO, 'ようこそ', '管理者としてログインしました。');
      return;
    }
    console.log("Login requested for:", userId);
  };

  const handleRegister = (data: Partial<User>) => {
    // Legacy handler: Auth is handled by onAuthStateChanged
    console.log("Register requested for:", data.email);
  };

  const handleLogout = () => {
    auth.signOut();
    setCurrentUser(null);
    setView('LOGIN');
    setViewParams(null);
    setSelectedUserProfileId(null);
    setHistory([]);
    setActiveToasts([]);
  };

  // Navigation Helper
  const handleChangeView = (newView: ViewState, params?: any) => {
    setView(newView);
    setViewParams(params); 
    if (newView !== 'PROFILE') {
      setSelectedUserProfileId(null); 
    }
  };

  // Back Button Logic
  const handleBack = () => {
    if (history.length === 0) {
        // Fallback
        handleChangeView('DASHBOARD');
        return;
    }

    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);
    
    setHistory(newHistory);
    setView(previousState.view);
    setViewParams(previousState.viewParams);
    setSelectedUserProfileId(previousState.selectedUserProfileId);
  };

  // Actions
  const handleApply = async (projectId: string, message: string, quoteAmount: number) => {
    if (!currentUser) return;
    const newApp: Application = {
      id: `a${Date.now()}`,
      projectId,
      userId: currentUser.id,
      status: ApplicationStatus.APPLIED,
      message,
      quoteAmount,
      availableStartDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      isRead: false
    };
    
    await createDocument('applications', newApp);

    // Show Toast for Current User
    showToast(NotificationType.SUCCESS, '応募完了', '案件への応募が完了しました。');

    // Notify Admin
    const project = projects.find(p => p.id === projectId);
    const admin = users.find(u => u.role === UserRole.ADMIN);
    if (admin && project) {
        addNotification(admin.id, NotificationType.INFO, '案件への応募', `${currentUser.name} さんが「${project.title}」に応募しました。`, `PROJECT:${projectId}`);
    }
  };

  // Handle Project Chat
  const handleSendMessage = async (projectId: string, content: string, file?: File) => {
    if (!currentUser) return;

    // Mock File Upload logic (In real app, upload to Storage)
    const attachmentUrl = file ? URL.createObjectURL(file) : undefined;
    const attachmentType = file ? (file.type.startsWith('image/') ? 'image' : 'file') : undefined;
    const attachmentSize = file ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : undefined;

    const newMsg: Message = {
      id: `m${Date.now()}`,
      projectId,
      senderId: currentUser.id,
      content,
      attachmentUrl,
      attachmentName: file?.name,
      attachmentType: attachmentType as 'image' | 'file',
      attachmentSize,
      createdAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };
    
    await createDocument('messages', newMsg);

    // Notify Counterpart
    const project = projects.find(p => p.id === projectId);
    if (project) {
        let receiverId = '';
        if (currentUser.role === UserRole.ADMIN) {
             receiverId = project.assignedToUserId || '';
        } else {
            // If partner is sending, notify admin
            const admin = users.find(u => u.role === UserRole.ADMIN);
            receiverId = admin?.id || '';
        }

        if (receiverId) {
             const notifMsg = content ? `案件「${project.title}」でメッセージが届きました。` : `案件「${project.title}」でファイルが共有されました。`;
             addNotification(receiverId, NotificationType.MESSAGE, '新着プロジェクトメッセージ', notifMsg, `PROJECT:${projectId}`);
        }
    }
  };

  // Handle Direct Message
  const handleSendDirectMessage = async (receiverId: string, content: string, file?: File) => {
    if (!currentUser) return;
    
    const attachmentUrl = file ? URL.createObjectURL(file) : undefined;
    const attachmentType = file ? (file.type.startsWith('image/') ? 'image' : 'file') : undefined;
    const attachmentSize = file ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : undefined;

    const newMsg: Message = {
      id: `dm${Date.now()}`,
      senderId: currentUser.id,
      receiverId: receiverId,
      content: content,
      attachmentUrl,
      attachmentName: file?.name,
      attachmentType: attachmentType as 'image' | 'file',
      attachmentSize,
      createdAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };
    
    await createDocument('messages', newMsg);
    
    // Notify Receiver
    const notifMsg = content ? `${currentUser.name} さんからメッセージが届きました。` : `${currentUser.name} さんからファイルが届きました。`;
    addNotification(receiverId, NotificationType.MESSAGE, '新着メッセージ', notifMsg, 'DM');
  };

  // Handle Read Receipt for DMs
  const handleMarkAsRead = (senderId: string, receiverId: string) => {
    // Find unread messages and update them
    messages.forEach(m => {
        if (m.senderId === senderId && m.receiverId === receiverId && !m.isRead) {
            updateDocument('messages', m.id, { isRead: true });
        }
    });
  };

  // Handle marking project related items (Messages/Applications) as read
  const handleMarkProjectAsRead = (projectId: string) => {
    if (!currentUser) return;

    // 1. Mark Project Messages as Read (sent by others)
    messages.forEach(m => {
        if (m.projectId === projectId && m.senderId !== currentUser.id && !m.isRead) {
            updateDocument('messages', m.id, { isRead: true });
        }
    });

    // 2. Mark Project Applications as Read (for Admin)
    if (currentUser.role === UserRole.ADMIN) {
        applications.forEach(a => {
            if (a.projectId === projectId && !a.isRead) {
                updateDocument('applications', a.id, { isRead: true });
            }
        });
    }
  };

  // Admin Actions
  const handleApprovePartner = (userId: string) => {
    updateDocument('users', userId, { status: UserStatus.ACTIVE });
    showToast(NotificationType.SUCCESS, '処理完了', 'パートナーを承認しました。');
    addNotification(userId, NotificationType.SUCCESS, '承認完了', 'パートナー申請が承認されました。案件への応募が可能になります。', 'PROFILE');
  };
  
  const handleRejectPartner = (userId: string) => {
    updateDocument('users', userId, { status: UserStatus.REJECTED });
    showToast(NotificationType.INFO, '処理完了', 'パートナー申請を否認しました。');
    addNotification(userId, NotificationType.ERROR, '申請否認', 'パートナー申請が否認されました。詳細は管理者へお問い合わせください。');
  };

  const handleUpdateUserStatus = (userId: string, status: UserStatus) => {
    updateDocument('users', userId, { status });
    if (status === UserStatus.ACTIVE) {
        showToast(NotificationType.SUCCESS, '更新完了', 'アカウントを有効化しました。');
        addNotification(userId, NotificationType.SUCCESS, 'アカウント有効化', 'アカウントが有効化されました。');
    } else if (status === UserStatus.REJECTED) {
        showToast(NotificationType.WARNING, '更新完了', 'アカウントを停止しました。');
        addNotification(userId, NotificationType.WARNING, 'アカウント停止', 'アカウントが停止されました。');
    }
  };

  const handleCreateProject = async (projectData: Partial<Project>) => {
      const newProject: Project = {
          id: `p${Date.now()}`,
          title: projectData.title!,
          description: projectData.description!,
          category: projectData.category!,
          budget: projectData.budget!,
          requiredSkills: projectData.requiredSkills || [],
          status: ProjectStatus.RECRUITING,
          createdAt: new Date().toISOString().split('T')[0]
      };
      
      await createDocument('projects', newProject);
      showToast(NotificationType.SUCCESS, '案件作成完了', `「${newProject.title}」を公開しました。`);
  };

  const handleHireApplicant = async (projectId: string, applicationId: string, userId: string) => {
      try {
        const projectToHire = projects.find(p => p.id === projectId);
        const applicationToHire = applications.find(a => a.id === applicationId);

        if (!projectToHire || !applicationToHire) {
            showToast(NotificationType.ERROR, 'エラー', 'データが見つかりませんでした。');
            return;
        }

        // 1. Update Project Status and Assigned User
        await updateDocument('projects', projectId, { 
            status: ProjectStatus.IN_PROGRESS, 
            assignedToUserId: userId 
        });

        // 2. Update Application Status
        await updateDocument('applications', applicationId, { 
            status: ApplicationStatus.HIRED 
        });

        // 3. Create initial empty invoice stub
        const quoteAmount = applicationToHire.quoteAmount || projectToHire.budget;
        const newInvoice: Invoice = {
            id: `inv${Date.now()}`,
            projectId: projectId,
            userId: userId,
            amount: quoteAmount,
            issueDate: '-',
            status: InvoiceStatus.UNBILLED
        };
        await createDocument('invoices', newInvoice);
        
        // Notify Partner
        addNotification(userId, NotificationType.SUCCESS, '採用決定', `案件「${projectToHire.title}」に採用されました！`, `PROJECT:${projectToHire.id}`);
        showToast(NotificationType.SUCCESS, '採用完了', `パートナーを採用し、案件を開始しました。`);
        
      } catch (error) {
        console.error('Error hiring applicant:', error);
        showToast(NotificationType.ERROR, 'システムエラー', '採用処理中にエラーが発生しました。');
      }
  };

  const handleUpdateInvoiceStatus = (invoiceId: string, status: InvoiceStatus) => {
      const invoice = invoices.find(i => i.id === invoiceId);
      const updateData: any = { status };
      
      if (status === InvoiceStatus.BILLED) {
          updateData.issueDate = new Date().toISOString().split('T')[0];
      }

      updateDocument('invoices', invoiceId, updateData);
      
      showToast(NotificationType.INFO, 'ステータス更新', '請求ステータスを更新しました。');

      if (invoice) {
        if (status === InvoiceStatus.PAID) {
            addNotification(invoice.userId, NotificationType.SUCCESS, '入金確認', `案件の報酬（¥${invoice.amount.toLocaleString()}）の入金が確認されました。`, 'INVOICES');
        }
      }
  };

  const handleCreateInvoice = async (projectId: string, amount: number, invoiceId?: string): Promise<void> => {
      if (!currentUser) return;
      
      const project = projects.find(p => p.id === projectId);
      if (!project) {
          showToast(NotificationType.ERROR, 'エラー', '案件情報が見つかりません。');
          return;
      }

      const currentInvoiceId = invoiceId || `inv${Date.now()}`;
      const issueDate = new Date().toISOString().split('T')[0];
      const today = new Date();
      const nextMonthLastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      const paymentDeadline = nextMonthLastDay.toISOString().split('T')[0];

      const clientInfo = {
          name: "Pantheon株式会社",
          postalCode: "103-0027",
          address: "東京都中央区日本橋2-10-3 エグゼトゥール日本橋10階",
          phoneNumber: "03-6281-8871",
          contactPerson: "山本"
      };

      let partnerBankInfo = null;
      try {
          if (currentUser.bankAccountInfo) {
              partnerBankInfo = JSON.parse(currentUser.bankAccountInfo);
          }
      } catch (e) {
          console.warn('Failed to parse bank info', e);
      }

      const payload = {
          invoiceId: currentInvoiceId,
          issueDate: issueDate,
          paymentDeadline: paymentDeadline,
          partner: {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              postalCode: currentUser.postalCode || '',
              address: currentUser.address || '',
              phoneNumber: currentUser.phoneNumber || '',
              invoiceNumber: currentUser.invoiceNumber || 'T_PENDING',
              bankAccountInfo: partnerBankInfo || currentUser.bankAccountInfo || ''
          },
          client: clientInfo,
          items: [{ name: project.title, quantity: 1, unitPrice: amount, taxRate: 0.10 }],
          totalAmount: Math.floor(amount * 1.1),
          taxAmount: Math.floor(amount * 0.1),
          subTotal: amount
      };

      try {
          const response = await fetch(N8N_INVOICE_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!response.ok) throw new Error(`n8n connection failed: ${response.status}`);

          const blob = await response.blob();
          const pdfUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = `invoice_${currentInvoiceId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          if (invoiceId) {
               // Update existing
               const updateData = {
                  amount: amount,
                  issueDate: issueDate,
                  status: InvoiceStatus.BILLED,
                  pdfUrl: pdfUrl
              };
              await updateDocument('invoices', invoiceId, updateData);
              showToast(NotificationType.SUCCESS, '請求書更新完了', '請求書を更新し、ダウンロードしました。');
              
              const admin = users.find(u => u.role === UserRole.ADMIN);
              if (admin) addNotification(admin.id, NotificationType.INFO, '請求書更新', `${currentUser.name} さんが請求書を更新・発行しました。`, 'INVOICES');

          } else {
              // Create new
              const newInvoice: Invoice = {
                  id: currentInvoiceId,
                  projectId: projectId,
                  userId: currentUser.id,
                  amount: amount,
                  issueDate: issueDate,
                  status: InvoiceStatus.BILLED,
                  pdfUrl: pdfUrl
              };
              await createDocument('invoices', newInvoice);
              showToast(NotificationType.SUCCESS, '請求書発行完了', '請求書を作成し、ダウンロードしました。');
              
              const admin = users.find(u => u.role === UserRole.ADMIN);
              if (admin) addNotification(admin.id, NotificationType.INFO, '請求書発行', `${currentUser.name} さんから新しい請求書が発行されました。`, 'INVOICES');
          }

      } catch (error) {
          console.error('Failed to create invoice:', error);
          showToast(NotificationType.ERROR, '発行失敗', 'n8nワークフローの呼び出しに失敗しました。後ほど再試行してください。');
          throw error;
      }
  };

  const handleCompleteProject = async (projectId: string, review: { score: number, comment: string }) => {
    let assignedUserId: string | undefined;
    
    // Find project to get assigned user
    const p = projects.find(proj => proj.id === projectId);
    assignedUserId = p?.assignedToUserId;

    await updateDocument('projects', projectId, {
        status: ProjectStatus.COMPLETED,
        review: {
            ...review,
            createdAt: new Date().toISOString().split('T')[0]
        }
    });
    
    showToast(NotificationType.SUCCESS, '完了処理', '案件を完了し、評価を送信しました。');

    if (assignedUserId) {
        addNotification(assignedUserId, NotificationType.SUCCESS, '案件完了', `案件が完了としてマークされ、評価が登録されました。`, `PROJECT:${projectId}`);
    }
  };

  const handleUpdateProfile = (userId: string, data: Partial<User>) => {
    updateDocument('users', userId, data);
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({ ...currentUser, ...data });
    }
    showToast(NotificationType.SUCCESS, '保存完了', 'プロフィール情報を更新しました。');
  };

  const handleViewProfile = (userId: string, context?: any) => {
    setHistory(prev => [
        ...prev, 
        { 
            view, 
            viewParams: { ...viewParams, ...context },
            selectedUserProfileId 
        }
    ]);
    setSelectedUserProfileId(userId);
    setView('PROFILE');
    setViewParams(null);
  };

  const renderContent = () => {
    if (!currentUser) return null;

    switch (view) {
      case 'DASHBOARD':
        return <Dashboard 
                  currentUser={currentUser} 
                  projects={projects} 
                  invoices={invoices} 
                  allUsers={users}
                  onChangeView={handleChangeView}
                  onApprove={handleApprovePartner}
                  onReject={handleRejectPartner}
                  onUpdateUserStatus={handleUpdateUserStatus}
                  onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                  setProjects={setProjects}
                  applications={applications}
                  onApply={handleApply}
                  onHire={handleHireApplicant}
                  onCreateProject={handleCreateProject}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onSendDirectMessage={handleSendDirectMessage}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkProjectAsRead={handleMarkProjectAsRead}
                  onCompleteProject={handleCompleteProject}
                  onViewProfile={handleViewProfile}
                  initialTab={viewParams?.tab}
                  initialProjectId={viewParams?.projectId}
                  initialSelectedChatUserId={viewParams?.selectedChatUserId}
                  onUpdateProfile={handleUpdateProfile}
                  notifications={notifications}
                  onMarkNotificationAsRead={handleMarkNotificationAsRead}
               />;
      case 'PROJECTS_LIST':
      case 'PROJECT_DETAIL':
        return <Projects 
                  currentUser={currentUser}
                  projects={projects}
                  setProjects={setProjects}
                  applications={applications}
                  onApply={handleApply}
                  onHire={handleHireApplicant}
                  onCreateProject={handleCreateProject}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onMarkProjectAsRead={handleMarkProjectAsRead}
                  users={users}
                  onCompleteProject={handleCompleteProject}
                  initialTab={viewParams?.tab}
                  initialProjectId={viewParams?.projectId}
                  onViewProfile={handleViewProfile}
                  onUpdateProfile={handleUpdateProfile}
               />;
      case 'INVOICES':
        return <Invoices 
                  currentUser={currentUser}
                  invoices={invoices}
                  projects={projects}
                  users={users}
                  onUpdateStatus={handleUpdateInvoiceStatus}
                  onCreateInvoice={handleCreateInvoice}
               />;
      case 'DIRECT_MESSAGES': 
        return <DirectMessages 
                  currentUser={currentUser}
                  messages={messages}
                  onSendMessage={handleSendDirectMessage}
                  users={users}
                  onMarkAsRead={handleMarkAsRead}
               />;
      case 'PROFILE':
        const targetUser = selectedUserProfileId 
          ? users.find(u => u.id === selectedUserProfileId) 
          : currentUser;
        
        if (!targetUser) return <div>User not found</div>;

        return <Profile 
                  targetUser={targetUser}
                  currentUser={currentUser}
                  projects={projects}
                  onUpdateProfile={handleUpdateProfile}
                  onBack={handleBack}
               />;
      case 'ADMIN_PARTNERS':
        return <AdminPartners 
                  users={users}
                  onApprove={handleApprovePartner}
                  onReject={handleRejectPartner}
                  onUpdateStatus={handleUpdateUserStatus}
               />;
      default:
        return <Dashboard 
                currentUser={currentUser} 
                projects={projects} 
                invoices={invoices} 
                allUsers={users}
                onChangeView={handleChangeView}
                onApprove={handleApprovePartner}
                onReject={handleRejectPartner}
                onUpdateUserStatus={handleUpdateUserStatus}
                onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                initialTab={viewParams?.tab}
                initialProjectId={viewParams?.projectId}
                notifications={notifications}
                onMarkNotificationAsRead={handleMarkNotificationAsRead}
            />;
    }
  };

  if (view === 'LOGIN' || view === 'REGISTER') {
    return <Auth onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <Layout 
      currentUser={currentUser!} 
      currentView={view} 
      onChangeView={handleChangeView}
      onLogout={handleLogout}
      notifications={notifications}
      activeToasts={activeToasts}
      onCloseToast={handleCloseToast}
      onMarkAllAsRead={handleMarkAllNotificationsRead}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
