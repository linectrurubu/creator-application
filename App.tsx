
import React, { useState, useEffect, useRef } from 'react';
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
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  // Refs for auth listener (to avoid re-subscribing on state changes)
  const viewRef = useRef<ViewState>(view);
  const currentUserRef = useRef<User | null>(currentUser);

  // Keep refs in sync with state
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  
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

  // Auth Listener - 初回チェック完了フラグ
  const hasInitialAuthCheck = useRef(false);
  const isIntentionalLogout = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log("Auth state changed:", firebaseUser?.email || 'null', 'hasInitialCheck:', hasInitialAuthCheck.current);

        if (firebaseUser) {
            // Fetch user details from Firestore by email
            try {
                const email = firebaseUser.email;
                if (!email) {
                    console.error("No email found for Firebase user");
                    return; // Don't logout, just return
                }

                const q = query(collection(db, 'users'), where('email', '==', email));
                let snapshot = await getDocs(q);

                // Retry loop for new registrations
                if (snapshot.empty && !hasInitialAuthCheck.current) {
                    for (let i = 0; i < 8; i++) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        snapshot = await getDocs(q);
                        if (!snapshot.empty) break;
                    }
                }

                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    const userData = { id: userDoc.id, ...userDoc.data() } as User;

                    // 案件ポータルへのアクセス権チェック（初回のみ）
                    if (!userData.jobPortalEnabled && !hasInitialAuthCheck.current) {
                        console.warn("User does not have jobPortalEnabled:", email);
                        isIntentionalLogout.current = true;
                        auth.signOut();
                        setCurrentUser(null);
                        setView('LOGIN');
                        showToast(NotificationType.ERROR, 'アクセス権限なし', '案件ポータルへのアクセス権がありません。クリエイターポータルで認定を完了してください。');
                        return;
                    }

                    setCurrentUser(userData);
                    hasInitialAuthCheck.current = true;

                    // If we are on LOGIN/REGISTER, go to DASHBOARD
                    if (viewRef.current === 'LOGIN' || viewRef.current === 'REGISTER') {
                        setView('DASHBOARD');
                        if (!currentUserRef.current) {
                            showToast(NotificationType.INFO, `ようこそ`, 'ダッシュボードへログインしました。');
                        }
                    }
                } else {
                    // User not found in Firestore - only logout if this is initial check
                    console.error("User profile not found in Firestore for email:", email);
                    if (!hasInitialAuthCheck.current) {
                        isIntentionalLogout.current = true;
                        auth.signOut();
                        setCurrentUser(null);
                        setView('LOGIN');
                        showToast(NotificationType.ERROR, 'エラー', 'ユーザー情報が見つかりません。クリエイターポータルで登録してください。');
                    }
                }
            } catch (e) {
                console.error("Error fetching user data:", e);
                // エラー時はログアウトしない（既存ユーザーの場合）
                // 既にログイン済みの場合はそのまま維持
                if (!currentUserRef.current) {
                    // まだログインしていない場合のみログイン画面に戻す
                    setView('LOGIN');
                }
            }
        } else {
            // firebaseUser is null
            // 意図的なログアウトの場合のみログアウト処理
            if (isIntentionalLogout.current) {
                isIntentionalLogout.current = false;
                setCurrentUser(null);
                setView('LOGIN');
                return;
            }

            // 運営事務局（Pantheon Admin）の場合はログアウトしない
            if (currentUserRef.current?.id === 'WRIu0Aenv3H9FE092W53') {
                return;
            }

            // 既にユーザーがログイン済みの場合は、一時的なauth状態の変化として無視
            if (currentUserRef.current && hasInitialAuthCheck.current) {
                console.log("Ignoring transient auth state change - user already logged in");
                return;
            }

            // 初回チェック時のみログイン画面を表示
            if (!hasInitialAuthCheck.current) {
                hasInitialAuthCheck.current = true;
                setView('LOGIN');
            }
        }
    });
    return () => unsubscribe();
  }, []);

  // Enforce Status Restrictions (Pending/Rejected Partners can only see Profile)
  useEffect(() => {
    if (currentUser && currentUser.role === UserRole.PARTNER && currentUser.status !== UserStatus.ACTIVE) {
        if (view !== 'PROFILE') {
            setView('PROFILE');
            setViewParams(null);
            showToast(
                NotificationType.WARNING, 
                'アクセス制限', 
                currentUser.status === UserStatus.PENDING 
                    ? '承認待ちのため、プロフィール画面のみアクセス可能です。' 
                    : 'アカウントが停止されているため、機能が制限されています。'
            );
        }
    }
  }, [currentUser, view]);

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
  const handleLogin = (email: string, role: UserRole) => {
    // 運営事務局（Pantheon Admin）ログイン処理
    if (email === 'shared-admin') {
      const adminUser: User = {
        id: 'WRIu0Aenv3H9FE092W53', // FirestoreドキュメントIDと一致
        email: 'admin@pantheon.inc',
        name: 'Pantheon Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        jobPortalEnabled: true,
        avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=1a1a2e&color=fff',
      };
      setCurrentUser(adminUser);
      setView('DASHBOARD');
      showToast(NotificationType.INFO, 'ようこそ', '運営事務局としてログインしました。');
      return;
    }
    // Legacy handler: Auth is handled by onAuthStateChanged
    console.log("Login requested for:", email);
  };

  const handleRegister = (data: Partial<User>) => {
    // Legacy handler: Auth is handled by onAuthStateChanged
    console.log("Register requested for:", data.email);
  };

  const handleLogout = () => {
    isIntentionalLogout.current = true; // 意図的なログアウトをマーク
    hasInitialAuthCheck.current = false; // 次回ログイン時に再チェック
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
          
          // 1. Create local URL for immediate download (Partner UX)
          const localUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = localUrl;
          link.download = `invoice_${currentInvoiceId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // 2. Upload to Firebase Storage for persistence (Admin Access)
          let persistentUrl = localUrl; // Fallback to local if storage fails
          try {
              const storageRef = ref(storage, `invoices/${currentInvoiceId}.pdf`);
              await uploadBytes(storageRef, blob);
              persistentUrl = await getDownloadURL(storageRef);
          } catch (storageError) {
              console.warn("Storage upload failed, falling back to local Blob URL (Admin may not see PDF):", storageError);
          }

          if (invoiceId) {
               // Update existing invoice
               const updateData = {
                  amount: amount,
                  issueDate: issueDate,
                  status: InvoiceStatus.BILLED,
                  pdfUrl: persistentUrl // Use persistent URL
              };
              await updateDocument('invoices', invoiceId, updateData);
              showToast(NotificationType.SUCCESS, '請求書更新完了', '請求書を更新し、ダウンロードしました。');
              
              const admin = users.find(u => u.role === UserRole.ADMIN);
              if (admin) addNotification(admin.id, NotificationType.INFO, '請求書更新', `${currentUser.name} さんが請求書を更新・発行しました。`, 'INVOICES');

          } else {
              // Create new invoice
              const newInvoice: Invoice = {
                  id: currentInvoiceId,
                  projectId: projectId,
                  userId: currentUser.id,
                  amount: amount,
                  issueDate: issueDate,
                  status: InvoiceStatus.BILLED,
                  pdfUrl: persistentUrl // Use persistent URL
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
                  // Added newly required props
                  projects={projects}
                  invoices={invoices}
                  onViewProfile={handleViewProfile}
                  onStartChat={(userId) => {
                      // Redirect to dashboard messages tab
                      handleChangeView('DASHBOARD', { tab: 'MESSAGES', selectedChatUserId: userId });
                  }}
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
