
import React, { useState, useEffect, useRef } from 'react';
import { Project, User, ProjectStatus, ProjectCategory, Message, UserRole, Application, ApplicationStatus } from '../types';
import { EXPERIENCE_TAGS } from '../constants';
import { Search, Filter, Briefcase, ChevronRight, MessageSquare, Paperclip, Send, Calendar, DollarSign, Tag, Plus, X, UserCheck, Trash2, Star, CheckCircle, ListFilter, LayoutList, LayoutGrid, CheckSquare, Trophy, XCircle, Info, ExternalLink, Loader2, AlertTriangle, User as UserIcon, FileText, Download, File as FileIcon, HelpCircle, Edit2 } from 'lucide-react';

interface ProjectsProps {
  currentUser: User;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  applications: Application[];
  onApply: (projectId: string, message: string, quote: number) => void;
  onHire: (projectId: string, applicationId: string, userId: string) => void;
  onCreateProject: (project: Partial<Project>) => void;
  onUpdateProject?: (projectId: string, data: Partial<Project>) => void;
  onDeleteProject?: (projectId: string) => void;
  messages: Message[];
  onSendMessage: (projectId: string, content: string, file?: File) => void;
  onMarkProjectAsRead?: (projectId: string) => void; // New prop
  users?: User[];
  onCompleteProject?: (projectId: string, review: { score: number, comment: string }) => void;
  initialTab?: 'FIND' | 'MANAGE';
  initialProjectId?: string;
  onViewProfile?: (userId: string, context?: any) => void;
  onUpdateProfile?: (userId: string, data: Partial<User>) => void;
}

const categoryMap: Record<string, string> = {
  LECTURER: '講師',
  DX_CONSULTING: 'DXコンサル',
  DEVELOPMENT: '開発',
  ALL: '全てのカテゴリー'
};

const statusMap: Record<string, string> = {
  DRAFT: '下書き',
  RECRUITING: '募集中',
  IN_PROGRESS: '進行中',
  COMPLETED: '完了',
  CANCELLED: 'キャンセル'
};

const appStatusMap: Record<string, string> = {
  APPLIED: '応募済み',
  REJECTED: '不採用',
  HIRED: '採用'
};

// Skeleton Component
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// Circular Progress Component
const MatchRing = ({ percentage }: { percentage: number }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 80 ? 'text-n8n-orange' : percentage >= 50 ? 'text-yellow-500' : 'text-gray-300';
  
    return (
      <div className="relative flex items-center justify-center w-12 h-12">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle
            className="text-gray-100"
            strokeWidth="3"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="24"
            cy="24"
          />
          <circle
            className={color}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="24"
            cy="24"
          />
        </svg>
        <span className={`absolute text-[10px] font-bold ${color}`}>{percentage}%</span>
      </div>
    );
};

export const Projects: React.FC<ProjectsProps> = ({
  currentUser,
  projects,
  applications,
  onApply,
  onHire,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  messages,
  onSendMessage,
  onMarkProjectAsRead,
  users = [],
  onCompleteProject,
  initialTab,
  initialProjectId,
  onViewProfile,
  onUpdateProfile
}) => {
  // STATE MANAGEMENT REFACTOR: 
  // Store ID only, derive object from props. This ensures immediate UI updates when parent props change.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  
  // Derived State
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Partner Tab State
  const [partnerTab, setPartnerTab] = useState<'FIND' | 'MANAGE'>(initialTab || 'FIND');

  // Application Form State
  const [applyMsg, setApplyMsg] = useState('');
  const [applyQuote, setApplyQuote] = useState<number>(0);
  const [isApplying, setIsApplying] = useState(false);

  // Create Project State
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    title: '',
    description: '',
    budget: 0,
    category: ProjectCategory.DX_CONSULTING,
    requiredSkills: []
  });

  // Edit Project State
  const [isEditing, setIsEditing] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Completion/Review State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Hiring State
  const [hiringApplication, setHiringApplication] = useState<Application | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatTab, setChatTab] = useState<'CHAT' | 'FILES'>('CHAT'); // New: Chat Tab State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hover & Pin Profile State
  const [hoveredApplicantId, setHoveredApplicantId] = useState<string | null>(null);
  const [pinnedApplicantId, setPinnedApplicantId] = useState<string | null>(null);

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Simulate loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [partnerTab, filterStatus, filterCategory]); // Re-trigger on major filter changes

  // Sync tab if initialTab changes (e.g. navigation from dashboard)
  useEffect(() => {
    if (initialTab) {
      setPartnerTab(initialTab);
    }
  }, [initialTab]);

  // Sync initialProjectId if it changes (e.g. navigation from back button)
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
      // Mark as read immediately if loaded directly (e.g. from Dashboard)
      if(onMarkProjectAsRead) onMarkProjectAsRead(initialProjectId);
    } else {
      // FIX: Reset selection when navigating away to list view
      setSelectedProjectId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  // THEME CONFIG
  const theme = {
    cardBg: isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100',
    cardHover: isAdmin ? 'hover:bg-slate-750' : 'hover:shadow-lg hover:-translate-y-1',
    textMain: isAdmin ? 'text-slate-200' : 'text-gray-900',
    textSub: isAdmin ? 'text-slate-400' : 'text-gray-500',
    border: isAdmin ? 'border-slate-700' : 'border-gray-100',
    inputBg: isAdmin ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-200',
    modalBg: isAdmin ? 'bg-slate-800' : 'bg-white',
    sectionBg: isAdmin ? 'bg-slate-900' : 'bg-gray-50',
    highlight: isAdmin ? 'text-blue-400' : 'text-pantheon-navy',
    badgeNeutral: isAdmin ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600',
  };

  // Filtering Logic
  const filteredProjects = projects.filter(p => {
    const matchesText = p.title.toLowerCase().includes(filterText.toLowerCase()) || 
                        p.description.toLowerCase().includes(filterText.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || p.category === filterCategory;
    
    // Status Logic depends on Role and Tab
    let matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    
    // Role & Tab Logic
    let matchesRoleTab = true;
    if (isAdmin) {
        matchesRoleTab = true;
    } else {
        if (partnerTab === 'FIND') {
            matchesRoleTab = p.status === ProjectStatus.RECRUITING;
            if (filterStatus !== 'ALL') matchesStatus = p.status === filterStatus;
        } else {
            matchesRoleTab = p.assignedToUserId === currentUser.id;
        }
    }

    return matchesText && matchesCat && matchesStatus && matchesRoleTab;
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    onApply(selectedProject.id, applyMsg, applyQuote);
    setIsApplying(false);
    setApplyMsg('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateProject(newProject);
    setIsCreating(false);
    setNewProject({
        title: '',
        description: '',
        budget: 0,
        category: ProjectCategory.DX_CONSULTING,
        requiredSkills: []
    });
  };

  // --- HIRE LOGIC ---
  const handleHireClick = (e: React.MouseEvent, app: Application) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedProject) return;
    
    // Check Status Validity
    if (selectedProject.status !== ProjectStatus.RECRUITING) {
        alert('この案件は募集中ではないため、採用操作はできません。画面をリロードしてください。');
        return;
    }
    
    // Open Confirmation Modal
    setHiringApplication(app);
  };

  const confirmHire = async () => {
    if (!selectedProject || !hiringApplication) return;
    
    setIsProcessingAction(true);
    
    // Artificial delay to show processing state for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        await onHire(selectedProject.id, hiringApplication.id, hiringApplication.userId);
    } catch (error) {
        console.error("Error hiring:", error);
        alert('処理中にエラーが発生しました。');
    } finally {
        setIsProcessingAction(false);
        setHiringApplication(null);
    }
  };

  // --- COMPLETION LOGIC ---
  const handleCompleteClick = () => {
      setShowCompleteModal(true);
  };

  const confirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && onCompleteProject) {
        setIsProcessingAction(true);
        // Artificial delay
        await new Promise(resolve => setTimeout(resolve, 800));

        onCompleteProject(selectedProject.id, {
          score: reviewScore,
          comment: reviewComment
        });
        
        setIsProcessingAction(false);
        setShowCompleteModal(false);
        setReviewComment('');
        setReviewScore(5);
    }
  };

  const toggleSkill = (skill: string) => {
    const currentSkills = newProject.requiredSkills || [];
    if (currentSkills.includes(skill)) {
        setNewProject({ ...newProject, requiredSkills: currentSkills.filter(s => s !== skill) });
    } else {
        setNewProject({ ...newProject, requiredSkills: [...currentSkills, skill] });
    }
  };

  const toggleEditSkill = (skill: string) => {
    if (!editingProject) return;
    const currentSkills = editingProject.requiredSkills || [];
    if (currentSkills.includes(skill)) {
        setEditingProject({ ...editingProject, requiredSkills: currentSkills.filter(s => s !== skill) });
    } else {
        setEditingProject({ ...editingProject, requiredSkills: [...currentSkills, skill] });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !onUpdateProject) return;
    onUpdateProject(editingProject.id, {
      title: editingProject.title,
      description: editingProject.description,
      budget: editingProject.budget,
      category: editingProject.category,
      requiredSkills: editingProject.requiredSkills,
      status: editingProject.status
    });
    setIsEditing(false);
    setEditingProject(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingProjectId || !onDeleteProject) return;
    onDeleteProject(deletingProjectId);
    setShowDeleteConfirm(false);
    setDeletingProjectId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || (!chatInput.trim() && !selectedFile)) return;
    onSendMessage(selectedProject.id, chatInput, selectedFile || undefined);
    setChatInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const existingApp = selectedProject ? applications.find(a => a.projectId === selectedProject.id && a.userId === currentUser.id) : null;
  const projectMessages = selectedProject ? messages.filter(m => m.projectId === selectedProject.id) : [];
  const projectFiles = projectMessages.filter(m => m.attachmentUrl);
  
  const projectApplications = selectedProject && isAdmin 
    ? applications.filter(a => a.projectId === selectedProject.id)
    : [];

  const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
      const hasApplied = applications.some(a => a.projectId === project.id && a.userId === currentUser.id);
      
      // Calculate Badges (for Admin primarily, but logic works for filtering)
      const unreadMsgsCount = messages.filter(m => m.projectId === project.id && !m.isRead && m.senderId !== currentUser.id).length;
      // UPDATED: Filter out applications that are already read
      const newAppsCount = applications.filter(a => a.projectId === project.id && a.status === ApplicationStatus.APPLIED && !a.isRead).length;

      // Match Logic
      const matchedSkills = project.requiredSkills.filter(skill => currentUser.experienceTags?.includes(skill));
      const matchPercentage = project.requiredSkills.length > 0 
        ? Math.round((matchedSkills.length / project.requiredSkills.length) * 100)
        : 0;
      
      return (
        <div 
            onClick={() => {
              if (onMarkProjectAsRead) onMarkProjectAsRead(project.id);
              setSelectedProjectId(project.id);
            }}
            className={`${theme.cardBg} rounded-xl shadow-sm border p-6 ${theme.cardHover} transition-all duration-300 cursor-pointer relative group flex flex-col h-full`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${isAdmin ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-pantheon-navy'}`}>{categoryMap[project.category]}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                        project.status === ProjectStatus.RECRUITING ? 'bg-green-100 text-green-700' :
                        project.status === ProjectStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                        project.status === ProjectStatus.COMPLETED ? 'bg-purple-100 text-purple-700' : theme.badgeNeutral
                        }`}>{statusMap[project.status]}</span>
                </div>

                {/* Admin Edit/Delete Buttons */}
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setIsEditing(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                      title="編集"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProjectId(project.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {/* Match Ring (Only for Partner finding jobs) */}
                {!isAdmin && partnerTab === 'FIND' && matchPercentage > 0 && (
                   <div className="group/ring relative">
                       <MatchRing percentage={matchPercentage} />
                       <div className="absolute top-12 right-0 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover/ring:opacity-100 transition-opacity z-10 pointer-events-none">
                           <p className="font-bold mb-1">マッチング詳細:</p>
                           <p>必須スキル {project.requiredSkills.length}個中 {matchedSkills.length}個が一致</p>
                           <p className="text-gray-400 mt-1">({matchedSkills.join(', ')})</p>
                       </div>
                   </div>
                )}
            </div>
            
            <h3 className={`text-xl font-bold ${theme.textMain} mb-2 group-hover:${theme.highlight} transition-colors flex items-center gap-2`}>
                {project.title}
            </h3>
            
            <div className="flex items-baseline gap-1 mb-3">
                 <span className={`text-lg font-bold ${theme.textMain}`}>¥{project.budget.toLocaleString()}</span>
                 {project.status === ProjectStatus.RECRUITING && <span className="text-xs text-gray-400">/ 想定予算</span>}
            </div>

            {/* Notification Badges */}
            <div className="flex gap-2 mb-3">
                {unreadMsgsCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center shadow-sm animate-pulse">
                        <MessageSquare size={10} className="mr-1" /> {unreadMsgsCount} 新着メッセージ
                    </span>
                )}
                {newAppsCount > 0 && isAdmin && (
                    <span className="text-[10px] font-bold bg-n8n-orange text-white px-2 py-0.5 rounded-full flex items-center shadow-sm animate-pulse">
                        <UserCheck size={10} className="mr-1" /> {newAppsCount} 新規応募
                    </span>
                )}
            </div>
            
            <div className="relative flex-1">
                <p className={`${theme.textSub} text-sm mb-4 line-clamp-3 leading-relaxed`}>{project.description}</p>
                {/* Fade out effect for non-admin cards */}
                {!isAdmin && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>}
            </div>
            
            <div className={`flex items-center justify-between border-t ${isAdmin ? 'border-slate-700 pt-4' : 'border-gray-50 pt-4'} mt-auto`}>
                <div className="flex gap-2 overflow-hidden">
                    {project.requiredSkills.slice(0, 3).map(skill => (
                        <span key={skill} className={`text-[10px] px-2 py-1 rounded ${theme.badgeNeutral} whitespace-nowrap`}>{skill}</span>
                    ))}
                    {project.requiredSkills.length > 3 && <span className={`text-[10px] px-2 py-1 rounded ${theme.badgeNeutral}`}>+{project.requiredSkills.length - 3}</span>}
                </div>
                <div className={`flex items-center text-sm font-medium ${theme.highlight} whitespace-nowrap ml-2`}>
                    {hasApplied && partnerTab === 'FIND' ? <span className="text-green-600 flex items-center mr-2"><div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>応募済み</span> : null}
                    詳細 <ChevronRight size={16} className="ml-1" />
                </div>
            </div>
        </div>
      );
  };

  const MessageBubble: React.FC<{ msg: Message, isMe: boolean }> = ({ msg, isMe }) => (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
            isMe 
            ? 'bg-blue-600 text-white rounded-br-none' 
            : `${isAdmin ? 'bg-slate-700 text-slate-200' : 'bg-white text-gray-900'} border ${theme.border} rounded-bl-none`
        }`}>
            {msg.attachmentUrl && (
                <div className="mb-2">
                    {msg.attachmentType === 'image' ? (
                        <div className="rounded-lg overflow-hidden border border-gray-200/20 bg-black/5 relative group">
                             <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                                <img src={msg.attachmentUrl} alt={msg.attachmentName} className="max-w-full max-h-60 object-cover hover:opacity-90 transition-opacity" />
                             </a>
                             <a 
                                href={msg.attachmentUrl} 
                                download={msg.attachmentName || 'image'}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                title="ダウンロード"
                             >
                                <Download size={14} />
                             </a>
                        </div>
                    ) : (
                         <div className={`flex items-center p-3 rounded-lg border ${isMe ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`p-2 rounded-lg mr-3 ${isMe ? 'bg-white/20' : 'bg-white border border-gray-100'}`}>
                                <FileText size={24} className={isMe ? 'text-white' : 'text-blue-600'} />
                            </div>
                            <div className="flex-1 min-w-0 mr-4">
                                <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-gray-800'}`}>{msg.attachmentName}</p>
                                <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>{msg.attachmentSize || 'Unknown size'}</p>
                            </div>
                            <a 
                                href={msg.attachmentUrl} 
                                download={msg.attachmentName || 'file'}
                                target="_blank" 
                                rel="noreferrer" 
                                className={`p-2 rounded-full ${isMe ? 'hover:bg-white/20' : 'hover:bg-gray-200 text-gray-500'} transition-colors`}
                                title="ダウンロード"
                            >
                                <Download size={18} />
                            </a>
                        </div>
                    )}
                </div>
            )}
            
            {msg.content && <p className="text-sm whitespace-pre-wrap px-1">{msg.content}</p>}
            
            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : theme.textSub}`}>
                {msg.createdAt}
            </p>
        </div>
    </div>
  );

  // --- RENDER ---
  if (selectedProject) {
    return (
      <div className="flex flex-col md:flex-row gap-6 relative items-start pb-20 md:pb-0">
        <div className={`flex-1 ${theme.cardBg} rounded-xl shadow-sm border ${((existingApp && existingApp.status === 'HIRED') || isAdmin) ? 'md:w-1/2' : 'w-full'}`}>
          <div className={`p-6 border-b ${theme.border} flex justify-between items-start sticky top-0 z-10 ${isAdmin ? 'bg-slate-800' : 'bg-white'}`}>
            <button onClick={() => setSelectedProjectId(null)} className={`text-sm ${theme.textSub} hover:${theme.highlight} mb-2 flex items-center transition-colors`}>
              &larr; 一覧に戻る
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              selectedProject.status === ProjectStatus.RECRUITING ? 'bg-green-100 text-green-700' : 
              selectedProject.status === ProjectStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 
              selectedProject.status === ProjectStatus.COMPLETED ? 'bg-purple-100 text-purple-700' :
              theme.badgeNeutral
            }`}>
              {statusMap[selectedProject.status]}
            </span>
          </div>
          
          <div className="p-8">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-xs font-bold text-white bg-pantheon-navy px-2 py-1 rounded uppercase">{categoryMap[selectedProject.category]}</span>
              <span className={`text-xs ${theme.textSub}`}>作成日: {selectedProject.createdAt}</span>
            </div>
            
            <h1 className={`text-3xl font-bold ${theme.textMain} mb-6`}>{selectedProject.title}</h1>
            
            <div className="flex flex-wrap gap-4 mb-8">
              <div className={`flex items-center ${theme.textMain} ${isAdmin ? 'bg-slate-700' : 'bg-gray-50'} px-4 py-2 rounded-lg`}>
                <DollarSign size={18} className="mr-2 text-n8n-orange" />
                <span className="font-bold">予算: ¥{selectedProject.budget.toLocaleString()}</span>
              </div>
              <div className={`flex items-center ${theme.textMain} ${isAdmin ? 'bg-slate-700' : 'bg-gray-50'} px-4 py-2 rounded-lg`}>
                <Calendar size={18} className="mr-2 text-blue-500" />
                <span className="font-bold">開始: 即日可能</span>
              </div>
            </div>

            <div className="mb-8">
              <h3 className={`text-lg font-bold ${theme.textMain} mb-3 flex items-center`}><Briefcase size={20} className="mr-2 opacity-50"/> 案件詳細</h3>
              <div className={`whitespace-pre-wrap leading-relaxed ${theme.textSub} ${isAdmin ? 'bg-slate-700/50' : 'bg-white'} p-4 rounded-lg border ${theme.border}`}>
                {selectedProject.description}
              </div>
            </div>

            <div className="mb-8">
              <h3 className={`text-lg font-bold ${theme.textMain} mb-3 flex items-center`}><CheckSquare size={20} className="mr-2 opacity-50"/> 必須スキル・要件</h3>
              <div className="flex flex-wrap gap-2">
                {selectedProject.requiredSkills.map(skill => (
                  <span key={skill} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${theme.badgeNeutral}`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-10 pt-8 border-t border-slate-700">
                <h3 className="font-bold text-white mb-6 flex items-center">
                  <UserCheck className="mr-2 text-blue-400" />
                  応募パートナー ({projectApplications.length})
                </h3>
                {projectApplications.length === 0 ? (
                  <div className="text-slate-500 bg-slate-800 p-6 rounded-lg text-center border border-slate-700">
                    まだ応募はありません。
                  </div>
                ) : (
                  <div className="space-y-4">
                    {projectApplications.map(app => {
                      const applicant = users.find(u => u.id === app.userId);
                      const isHired = app.status === ApplicationStatus.HIRED;
                      const isRejectedImplicitly = selectedProject.status !== ProjectStatus.RECRUITING && !isHired;
                      const isPinned = pinnedApplicantId === applicant?.id;
                      const isHovered = hoveredApplicantId === applicant?.id;
                      const showPopup = isPinned || (isHovered && !pinnedApplicantId);
                      
                      if (!applicant) return null;
                      
                      return (
                        <div key={app.id} className={`rounded-lg p-4 border transition-all ${
                          isHired 
                            ? 'bg-emerald-900/10 border-emerald-500/50 shadow-lg shadow-emerald-900/10' 
                            : isRejectedImplicitly 
                              ? 'bg-slate-800 border-slate-700 opacity-60' 
                              : 'bg-slate-700 border-slate-600'
                        }`}>
                          <div className="flex justify-between items-start mb-3">
                            <div 
                              className="relative flex items-center gap-3 cursor-pointer group"
                              onMouseEnter={() => !pinnedApplicantId && setHoveredApplicantId(applicant.id)}
                              onMouseLeave={() => !pinnedApplicantId && setHoveredApplicantId(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPinned) {
                                    setPinnedApplicantId(null);
                                } else {
                                    setPinnedApplicantId(applicant.id);
                                    setHoveredApplicantId(null);
                                }
                              }}
                            >
                              <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white transition-all ${isPinned ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-700' : 'group-hover:ring-2 ring-slate-500'}`}><UserIcon size={20} /></div>
                              <div>
                                <p className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1">
                                  {applicant.name} <Info size={12} className="opacity-50" />
                                  {isHired && <span className="ml-2 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold animate-pulse">採用</span>}
                                </p>
                                <p className="text-xs text-slate-400">{applicant.email}</p>
                              </div>

                              {showPopup && (
                                <div 
                                  className="absolute top-10 left-0 w-80 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 cursor-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                   {isPinned && (
                                       <button 
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             setPinnedApplicantId(null);
                                         }}
                                         className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white bg-slate-800 rounded-full border border-slate-600 hover:bg-slate-700 transition-colors"
                                         title="閉じる"
                                       >
                                           <X size={14} />
                                       </button>
                                   )}
                                   <div className="flex items-center gap-3 mb-3 border-b border-slate-700 pb-2 mr-6">
                                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white border border-slate-600"><UserIcon size={24} /></div>
                                      <div>
                                         <p className="font-bold text-white text-base leading-tight">{applicant.name}</p>
                                         <p className="text-xs text-slate-400">{applicant.email}</p>
                                      </div>
                                   </div>
                                   <div className="space-y-3">
                                      <div>
                                          <p className="text-[10px] font-bold text-slate-500 uppercase">自己紹介</p>
                                          <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mt-0.5">
                                            {applicant.selfIntroduction || '自己紹介はありません。'}
                                          </p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-bold text-slate-500 uppercase">スキル・経験</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {applicant.experienceTags?.map(tag => (
                                                <span key={tag} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">{tag}</span>
                                            ))}
                                            {!applicant.experienceTags?.length && <span className="text-xs text-slate-500">登録なし</span>}
                                          </div>
                                      </div>
                                      <div className="pt-2 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                                          {applicant.n8nProfileUrl ? (
                                             <span className="text-n8n-orange font-bold">n8n Profile 有り</span>
                                          ) : <span className="text-slate-600">n8n Profile 未登録</span>}
                                          {applicant.portfolioUrl ? (
                                             <span className="text-blue-400 font-bold">Portfolio 有り</span>
                                          ) : <span className="text-slate-600">Portfolio 未登録</span>}
                                      </div>
                                      {onViewProfile && (
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onViewProfile(applicant.id, { tab: partnerTab, projectId: selectedProject?.id });
                                            }}
                                            className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold rounded border border-slate-700 transition-colors flex items-center justify-center"
                                         >
                                            詳細プロフィールを見る <ExternalLink size={12} className="ml-1" />
                                         </button>
                                      )}
                                   </div>
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="font-bold text-emerald-400 text-lg">¥{app.quoteAmount.toLocaleString()}</p>
                              <p className="text-xs text-slate-400">希望開始日: {app.availableStartDate}</p>
                            </div>
                          </div>
                          <div className={`p-3 rounded text-sm mb-4 ${isHired ? 'bg-emerald-900/20 text-emerald-100' : 'bg-slate-800 text-slate-300'}`}>
                             "{app.message}"
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            {isHired ? (
                              <div className="flex items-center text-emerald-400 font-bold px-4 py-2 bg-emerald-900/30 rounded-lg border border-emerald-900/50 animate-in fade-in zoom-in shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                <CheckCircle size={18} className="mr-2 fill-emerald-400 text-slate-900" /> 採用済み
                              </div>
                            ) : isRejectedImplicitly ? (
                              <div className="flex items-center text-slate-500 font-bold px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 opacity-70">
                                <XCircle size={18} className="mr-2" /> 不採用
                              </div>
                            ) : (
                              <button 
                                type="button"
                                onClick={(e) => handleHireClick(e, app)}
                                className={`bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 shadow-lg shadow-blue-900/30 flex items-center group/btn`}
                                title="このパートナーを採用します"
                              >
                                <UserCheck size={18} className="mr-2 group-hover/btn:scale-110 transition-transform" /> 採用する
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!isAdmin && partnerTab === 'FIND' && selectedProject.status === ProjectStatus.RECRUITING && (
              // ... (Same as before)
              <div className="mt-10 pt-8 border-t border-gray-200">
                {!existingApp ? (
                  !isApplying ? (
                    <div className="text-center bg-gray-50 p-8 rounded-xl border border-gray-200">
                       <h3 className="text-lg font-bold text-gray-800 mb-2">この案件に興味がありますか？</h3>
                       <p className="text-gray-500 mb-6">あなたのスキルを活かして、プロジェクトに参加しましょう。</p>
                       <button onClick={() => setIsApplying(true)} className="bg-pantheon-navy text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-pantheon-light transition-transform hover:scale-105 shadow-xl">応募する</button>
                       {/* Mobile Sticky Button Placeholder for spacing */}
                       <div className="h-16 md:hidden"></div>
                       {/* Mobile Sticky Button */}
                       <div className="md:hidden fixed bottom-16 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-30">
                          <button onClick={() => setIsApplying(true)} className="w-full bg-n8n-orange text-white py-3 rounded-lg font-bold text-lg shadow-lg">応募する</button>
                       </div>
                    </div>
                  ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg animate-in fade-in slide-in-from-bottom-4 mb-20 md:mb-0">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Send className="mr-2 text-pantheon-navy" size={20}/> 応募フォーム</h3>
                      <form onSubmit={handleApply} className="space-y-4">
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">見積もり金額 (円)</label><input type="number" required min="1000" value={applyQuote} onChange={e => setApplyQuote(Number(e.target.value))} className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pantheon-navy outline-none" placeholder="例: 150000" /></div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">メッセージ / アピール</label><textarea required value={applyMsg} onChange={e => setApplyMsg(e.target.value)} className="w-full h-32 bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pantheon-navy outline-none resize-none" placeholder="過去の実績や、どのように貢献できるかをご記入ください。" /></div>
                        <div className="flex gap-3 justify-end pt-2"><button type="button" onClick={() => setIsApplying(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium">キャンセル</button><button type="submit" className="bg-n8n-orange text-white px-6 py-2 rounded-lg font-bold hover:bg-red-500 shadow-md transition-colors">応募を送信</button></div>
                      </form>
                    </div>
                  )
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                     <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
                     <h3 className="text-xl font-bold text-green-800 mb-2">応募済みです</h3>
                     <p className="text-green-700 mb-4">クライアントからの連絡をお待ちください。</p>
                     <div className="inline-block bg-white px-4 py-2 rounded border border-green-200 text-sm text-green-800">提示額: ¥{existingApp.quoteAmount.toLocaleString()}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {((existingApp && existingApp.status === 'HIRED') || isAdmin) && (
          <div className={`md:w-1/2 flex flex-col ${theme.cardBg} rounded-xl shadow-sm border overflow-hidden sticky top-4 h-[calc(100vh-100px)]`}>
             <div className={`p-4 border-b ${theme.border} ${theme.sectionBg} flex flex-col md:flex-row justify-between items-center gap-3 shrink-0`}>
                <div className="flex items-center">
                    <h3 className={`font-bold ${theme.textMain} flex items-center mr-2`}><MessageSquare className="mr-2" size={18}/> プロジェクトチャット</h3>
                    {selectedProject.status === ProjectStatus.IN_PROGRESS && <div className="flex items-center text-xs text-green-500 font-bold px-2 py-1 bg-green-500/10 rounded"><span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span> 進行中</div>}
                </div>
                
                {/* Chat Tabs */}
                <div className={`flex p-1 rounded-lg border ${isAdmin ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <button 
                       onClick={() => setChatTab('CHAT')}
                       className={`px-3 py-1 rounded text-xs font-bold transition-all ${chatTab === 'CHAT' ? 'bg-blue-600 text-white' : `${theme.textSub} hover:${theme.textMain}`}`}
                    >
                        チャット
                    </button>
                    <button 
                       onClick={() => setChatTab('FILES')}
                       className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center ${chatTab === 'FILES' ? 'bg-blue-600 text-white' : `${theme.textSub} hover:${theme.textMain}`}`}
                    >
                        ファイル一覧
                    </button>
                </div>
             </div>

             {chatTab === 'CHAT' ? (
                <>
                    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isAdmin ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                        {projectMessages.length === 0 && <div className={`text-center py-10 ${theme.textSub}`}><p>メッセージはまだありません。</p><p className="text-xs mt-2">プロジェクトの進行について話し合いましょう。</p></div>}
                        {projectMessages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === currentUser.id} />
                        ))}
                    </div>
                    <div className={`p-4 border-t ${theme.border} ${theme.cardBg} shrink-0`}>
                        {selectedProject.status === ProjectStatus.IN_PROGRESS ? (
                        <>
                          {selectedFile && (
                            <div className={`flex items-center justify-between p-2 mb-2 rounded-lg border ${isAdmin ? 'bg-slate-700 border-slate-600' : 'bg-gray-100 border-gray-200'}`}>
                              <div className="flex items-center text-xs overflow-hidden">
                                <FileIcon size={14} className={`mr-2 ${theme.textSub}`} />
                                <span className={`truncate max-w-[200px] ${theme.textMain}`}>{selectedFile.name}</span>
                                <span className={`text-[10px] ${theme.textSub} ml-2`}>
                                  {(selectedFile.size / 1024 < 1024) 
                                    ? (selectedFile.size / 1024).toFixed(1) + ' KB' 
                                    : (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB'}
                                </span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setSelectedFile(null);
                                  if(fileInputRef.current) fileInputRef.current.value = '';
                                }} 
                                className={`${theme.textSub} hover:text-red-500`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                          <form onSubmit={handleSendChat} className="flex gap-2">
                             <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileChange} 
                             />
                             <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-2 rounded-full ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                                <Paperclip size={20} />
                             </button>
                             <input 
                                type="text" 
                                value={chatInput} 
                                onChange={e => setChatInput(e.target.value)} 
                                className={`flex-1 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.inputBg}`} 
                                placeholder="メッセージを入力..." 
                             />
                             <button 
                                type="submit" 
                                disabled={!chatInput.trim() && !selectedFile} 
                                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                             >
                                <Send size={18} />
                             </button>
                          </form>
                        </>
                        ) : selectedProject.status === ProjectStatus.COMPLETED && selectedProject.review ? (
                        <div className="text-center py-4"><div className="flex items-center justify-center gap-2 mb-2 text-yellow-500"><Trophy size={20} /><span className="font-bold">案件完了・評価済み</span></div><div className="flex justify-center mb-2">{[...Array(5)].map((_, i) => <Star key={i} size={18} className={i < (selectedProject.review?.score || 0) ? "text-yellow-400 fill-current" : "text-gray-300"} />)}</div><p className={`text-sm ${theme.textSub} italic`}>"{selectedProject.review.comment}"</p></div>
                        ) : <div className={`text-center text-sm ${theme.textSub} py-2`}>このプロジェクトは{statusMap[selectedProject.status]}のため、メッセージは送信できません。</div>}
                    </div>
                </>
             ) : (
                /* Files Tab Content */
                <div className={`flex-1 overflow-y-auto p-4 ${isAdmin ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                    {projectFiles.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center h-full ${theme.textSub}`}>
                            <FileText size={48} className="mb-2 opacity-20" />
                            <p>共有されたファイルはありません</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {projectFiles.map(file => (
                                <div key={file.id} className={`${isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group`}>
                                    <div className={`aspect-video ${isAdmin ? 'bg-slate-900' : 'bg-gray-100'} flex items-center justify-center relative overflow-hidden`}>
                                        {file.attachmentType === 'image' ? (
                                            <img src={file.attachmentUrl} alt={file.attachmentName} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileText size={32} className={theme.textSub} />
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a 
                                                href={file.attachmentUrl} 
                                                download={file.attachmentName || 'file'}
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="p-2 bg-white rounded-full text-gray-800 hover:bg-pantheon-navy hover:text-white transition-colors"
                                                title="ダウンロード"
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className={`text-xs font-bold truncate ${theme.textMain}`} title={file.attachmentName}>{file.attachmentName}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className={`text-[10px] ${theme.textSub}`}>{file.attachmentSize || 'Unknown'}</p>
                                            <p className={`text-[10px] ${theme.textSub}`}>{file.createdAt}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             )}

             {isAdmin && selectedProject.status === ProjectStatus.IN_PROGRESS && (
               <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0">
                  <button onClick={handleCompleteClick} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center"><CheckCircle size={18} className="mr-2" /> 案件を完了・評価する</button>
               </div>
             )}
          </div>
        )}

        {/* Hire Confirmation Modal - Displayed on top of Detail View */}
        {hiringApplication && (() => {
            const applicant = users.find(u => u.id === hiringApplication.userId);
            if (!applicant) return null;
            return (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                 <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">
                     <div className="p-6 border-b border-slate-700">
                         <h3 className="text-xl font-bold text-white flex items-center"><UserCheck className="mr-2 text-blue-500" /> 採用の確認</h3>
                     </div>
                     <div className="p-6 space-y-6">
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                             <div className="flex items-center space-x-4 mb-4">
                                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white border border-slate-600"><UserIcon size={24} /></div>
                                 <div>
                                     <p className="font-bold text-lg text-white">{applicant.name}</p>
                                     <p className="text-sm text-slate-400">{applicant.email}</p>
                                 </div>
                             </div>
                             <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-700/50">
                                 <span className="text-slate-400">契約金額</span>
                                 <span className="font-bold text-emerald-400 text-lg">¥{hiringApplication.quoteAmount.toLocaleString()}</span>
                             </div>
                         </div>
                         
                         <div className="flex items-start bg-blue-900/20 p-3 rounded-lg border border-blue-900/50">
                             <Info className="text-blue-400 mr-2 shrink-0 mt-0.5" size={16} />
                             <p className="text-xs text-blue-300 leading-relaxed">
                                 採用を確定すると、案件ステータスが「進行中」に切り替わり、他の応募者は自動的に「不採用」となります。この操作は取り消せません。
                             </p>
                         </div>
                     </div>
                     <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                         <button 
                           onClick={() => setHiringApplication(null)}
                           disabled={isProcessingAction}
                           className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                         >
                           キャンセル
                         </button>
                         <button 
                           onClick={confirmHire}
                           disabled={isProcessingAction}
                           className={`px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center ${isProcessingAction ? 'opacity-75 cursor-wait' : ''}`}
                         >
                           {isProcessingAction ? (
                             <>
                               <Loader2 size={18} className="mr-2 animate-spin" /> 処理中...
                             </>
                           ) : (
                             <>
                               <CheckCircle size={18} className="mr-2" /> 採用を確定する
                             </>
                           )}
                         </button>
                     </div>
                 </div>
              </div>
            );
        })()}

        {/* Complete Project / Review Modal - Displayed on top of Detail View */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
             <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700 overflow-hidden">
                 <div className="p-6 border-b border-slate-700">
                     <h3 className="text-xl font-bold text-white flex items-center"><Trophy className="mr-2 text-yellow-500" /> プロジェクトの完了・評価</h3>
                 </div>
                 <form onSubmit={confirmCompletion}>
                     <div className="p-6 space-y-6">
                         <p className="text-sm text-slate-300">
                           プロジェクトお疲れ様でした。パートナーの評価を入力して、案件を完了させてください。
                         </p>
                         
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-3">総合評価</label>
                             <div className="flex justify-center gap-4 py-2 bg-slate-900 rounded-xl border border-slate-700">
                                 {[1, 2, 3, 4, 5].map(score => (
                                   <button 
                                     key={score} 
                                     type="button" 
                                     onClick={() => setReviewScore(score)} 
                                     className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                   >
                                     <Star 
                                       size={32} 
                                       className={`${score <= reviewScore ? "text-yellow-400 fill-current" : "text-slate-700"} transition-colors`} 
                                     />
                                   </button>
                                 ))}
                             </div>
                             <p className="text-center text-sm font-bold text-yellow-500 mt-2">{reviewScore}.0 / 5.0</p>
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">評価コメント</label>
                             <textarea 
                               required 
                               value={reviewComment} 
                               onChange={e => setReviewComment(e.target.value)} 
                               className="w-full bg-slate-900 border border-slate-600 rounded-lg text-white p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" 
                               placeholder="パートナーの働きぶりや成果物へのフィードバックを入力してください" 
                               rows={4} 
                             />
                         </div>
                     </div>
                     <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
                         <button 
                           type="button"
                           onClick={() => setShowCompleteModal(false)}
                           disabled={isProcessingAction}
                           className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                         >
                           キャンセル
                         </button>
                         <button 
                           type="submit"
                           disabled={isProcessingAction}
                           className={`px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center ${isProcessingAction ? 'opacity-75 cursor-wait' : ''}`}
                         >
                           {isProcessingAction ? (
                             <>
                               <Loader2 size={18} className="mr-2 animate-spin" /> 送信中...
                             </>
                           ) : (
                             <>
                               <CheckCircle size={18} className="mr-2" /> 完了して評価を送る
                             </>
                           )}
                         </button>
                     </div>
                 </form>
             </div>
          </div>
        )}
      </div>
    );
  }

  // --- PROJECT LIST VIEW ---
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className={`text-2xl font-bold ${theme.textMain}`}>
             {isAdmin ? '案件管理' : (partnerTab === 'FIND' ? '案件を探す' : '案件管理')}
           </h1>
           <p className={theme.textSub}>
             {isAdmin 
               ? '全てのプロジェクト状況を一元管理します。' 
               : (partnerTab === 'FIND' ? 'あなたのスキルに合った案件を見つけましょう。' : '担当している案件の進捗管理ができます。')
             }
           </p>
        </div>
        
        <div className="flex items-center gap-2">
           {isAdmin && (
             <button 
               onClick={() => setIsCreating(true)}
               className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-500 transition-colors flex items-center"
             >
                <Plus size={18} className="mr-2" /> 新規案件作成
             </button>
           )}
        </div>
      </div>

      {/* Partner Tabs */}
      {!isAdmin && (
         <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-fit">
            <button onClick={() => setPartnerTab('FIND')} className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${partnerTab === 'FIND' ? 'bg-pantheon-navy text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><Search size={16} className="mr-2" /> 案件を探す</button>
            <button onClick={() => setPartnerTab('MANAGE')} className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${partnerTab === 'MANAGE' ? 'bg-pantheon-navy text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><Briefcase size={16} className="mr-2" /> 案件管理 (受注済)</button>
         </div>
      )}

      {/* Filters */}
      <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center`}>
         <div className="relative flex-1 min-w-[200px]"><Search className={`absolute left-3 top-2.5 ${theme.textSub}`} size={20} /><input type="text" placeholder="キーワード検索..." value={filterText} onChange={e => setFilterText(e.target.value)} className={`w-full pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${theme.inputBg}`} /></div>
         <div className="flex items-center gap-2 overflow-x-auto">
            <Filter size={20} className={theme.textSub} />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={`px-4 py-2 rounded-lg outline-none cursor-pointer ${theme.inputBg}`}>{Object.keys(categoryMap).map(key => <option key={key} value={key}>{categoryMap[key]}</option>)}</select>
            {isAdmin && <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`px-4 py-2 rounded-lg outline-none cursor-pointer ${theme.inputBg}`}><option value="ALL">全てのステータス</option>{Object.keys(statusMap).map(key => <option key={key} value={key}>{statusMap[key]}</option>)}</select>}
         </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {isLoading ? (
             // Skeletons
             [...Array(6)].map((_, i) => (
                 <div key={i} className={`${theme.cardBg} rounded-xl shadow-sm border p-6 h-64 flex flex-col justify-between`}>
                     <div className="space-y-3">
                         <div className="flex justify-between">
                            <Skeleton className="w-16 h-6" />
                            <Skeleton className="w-16 h-6" />
                         </div>
                         <Skeleton className="w-32 h-8" />
                         <Skeleton className="w-full h-4" />
                         <Skeleton className="w-full h-4" />
                     </div>
                     <div className="flex justify-between mt-6">
                         <Skeleton className="w-20 h-6" />
                         <Skeleton className="w-24 h-6" />
                     </div>
                 </div>
             ))
         ) : filteredProjects.length > 0 ? (
           filteredProjects.map(project => (
             <ProjectCard key={project.id} project={project} />
           ))
         ) : (
           // Empty State
           <div className={`col-span-full py-20 text-center ${theme.textSub}`}>
               <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search size={48} className="text-gray-300" />
               </div>
               <h3 className="text-lg font-bold mb-2">条件に一致する案件が見つかりませんでした</h3>
               <p className="text-sm mb-6 max-w-sm mx-auto">検索条件を変更するか、新しい案件が公開されるのをお待ちください。</p>
               <button 
                  onClick={() => { setFilterText(''); setFilterCategory('ALL'); }}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors"
               >
                   検索条件をクリア
               </button>
           </div>
         )}
      </div>

      {/* MODALS */}

      {/* Create Project Modal (Admin Only) */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
           <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl text-slate-200 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 z-10"><h3 className="text-xl font-bold text-white">新規案件の作成</h3><button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
              <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
                 <div><label className="block text-sm font-bold text-slate-400 mb-2">案件タイトル</label><input type="text" required value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: kintone連携による在庫管理システム構築" /></div>
                 <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-400 mb-2">カテゴリー</label><select value={newProject.category} onChange={e => setNewProject({...newProject, category: e.target.value as ProjectCategory})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none">{Object.keys(ProjectCategory).map(cat => <option key={cat} value={cat}>{categoryMap[cat]}</option>)}</select></div><div><label className="block text-sm font-bold text-slate-400 mb-2">予算 (円)</label><input type="number" required min="1" value={newProject.budget || ''} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="300000" /></div></div>
                 <div><label className="block text-sm font-bold text-slate-400 mb-2">案件詳細</label><textarea required value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="具体的な要件や背景などを記入してください" /></div>
                 <div><label className="block text-sm font-bold text-slate-400 mb-2">必須スキル (タグ選択)</label><div className="flex flex-wrap gap-2 bg-slate-900 p-4 rounded-lg border border-slate-600">{EXPERIENCE_TAGS.map(tag => <button key={tag} type="button" onClick={() => toggleSkill(tag)} className={`px-3 py-1.5 rounded text-sm transition-colors ${newProject.requiredSkills?.includes(tag) ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{tag}</button>)}</div></div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-700"><button type="button" onClick={() => setIsCreating(false)} className="px-6 py-2 rounded-lg text-slate-400 hover:bg-slate-700 font-bold">キャンセル</button><button type="submit" className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg">公開する</button></div>
              </form>
           </div>
        </div>
      )}

      {/* Edit Project Modal (Admin Only) */}
      {isEditing && editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
           <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl text-slate-200 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 z-10">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Edit2 size={20} className="mr-2 text-blue-400" /> 案件を編集
                </h3>
                <button onClick={() => { setIsEditing(false); setEditingProject(null); }} className="text-slate-400 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
                 <div>
                   <label className="block text-sm font-bold text-slate-400 mb-2">案件タイトル</label>
                   <input
                     type="text"
                     required
                     value={editingProject.title}
                     onChange={e => setEditingProject({...editingProject, title: e.target.value})}
                     className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-bold text-slate-400 mb-2">カテゴリー</label>
                     <select
                       value={editingProject.category}
                       onChange={e => setEditingProject({...editingProject, category: e.target.value as ProjectCategory})}
                       className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                     >
                       {Object.keys(ProjectCategory).map(cat => <option key={cat} value={cat}>{categoryMap[cat]}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-400 mb-2">予算 (円)</label>
                     <input
                       type="number"
                       required
                       min="1"
                       value={editingProject.budget || ''}
                       onChange={e => setEditingProject({...editingProject, budget: Number(e.target.value)})}
                       className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-400 mb-2">ステータス</label>
                   <select
                     value={editingProject.status}
                     onChange={e => setEditingProject({...editingProject, status: e.target.value as ProjectStatus})}
                     className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                   >
                     {Object.keys(ProjectStatus).map(status => <option key={status} value={status}>{statusMap[status]}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-400 mb-2">案件詳細</label>
                   <textarea
                     required
                     value={editingProject.description}
                     onChange={e => setEditingProject({...editingProject, description: e.target.value})}
                     className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-400 mb-2">必須スキル (タグ選択)</label>
                   <div className="flex flex-wrap gap-2 bg-slate-900 p-4 rounded-lg border border-slate-600">
                     {EXPERIENCE_TAGS.map(tag => (
                       <button
                         key={tag}
                         type="button"
                         onClick={() => toggleEditSkill(tag)}
                         className={`px-3 py-1.5 rounded text-sm transition-colors ${editingProject.requiredSkills?.includes(tag) ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                       >
                         {tag}
                       </button>
                     ))}
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                   <button type="button" onClick={() => { setIsEditing(false); setEditingProject(null); }} className="px-6 py-2 rounded-lg text-slate-400 hover:bg-slate-700 font-bold">キャンセル</button>
                   <button type="submit" className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg flex items-center">
                     <CheckCircle size={18} className="mr-2" /> 保存する
                   </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingProjectId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <AlertTriangle className="mr-2 text-red-500" /> 削除の確認
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                この案件を削除してもよろしいですか？
              </p>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <p className="font-bold text-white">
                  {projects.find(p => p.id === deletingProjectId)?.title}
                </p>
              </div>
              <div className="flex items-start bg-red-900/20 p-3 rounded-lg border border-red-900/50">
                <AlertTriangle className="text-red-400 mr-2 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-red-300 leading-relaxed">
                  この操作は取り消せません。関連する応募やメッセージも削除されます。
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletingProjectId(null); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center"
              >
                <Trash2 size={18} className="mr-2" /> 削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
