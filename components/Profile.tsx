import React, { useState, useEffect } from 'react';
import { User, Project, ProjectCategory, UserRole, ProjectStatus } from '../types';
import { EXPERIENCE_TAGS } from '../constants';
import { User as UserIcon, Mail, Link as LinkIcon, Edit2, Save, X, Star, Briefcase, Award, ExternalLink, Tag, Shield, CreditCard, Building2, Phone, MapPin, Eye, EyeOff } from 'lucide-react';

interface ProfileProps {
  targetUser: User;
  currentUser: User;
  projects: Project[];
  onUpdateProfile?: (userId: string, data: Partial<User>) => void;
  onBack?: () => void;
}

const categoryMap: Record<string, string> = {
  LECTURER: '講師',
  DX_CONSULTING: 'DXコンサル',
  DEVELOPMENT: '開発'
};

// Skill Categorization
const SKILL_CATEGORIES = {
  TOOLS: ['n8n', 'kintone', 'Shopify', 'freee', 'Slack', 'HubSpot', 'Salesforce', 'Notion', 'Zapier', 'Make'],
  ROLES: ['Teaching', 'Management', 'Consulting']
};

export const Profile: React.FC<ProfileProps> = ({ targetUser, currentUser, projects, onUpdateProfile, onBack }) => {
  const isOwner = currentUser.id === targetUser.id;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const [isEditing, setIsEditing] = useState(false);
  const [showBankInfo, setShowBankInfo] = useState(false);

  // Initialize Form Data
  const [formData, setFormData] = useState({
      selfIntroduction: '',
      experienceTags: [] as string[],
      availableCategories: [] as ProjectCategory[],
      portfolioUrl: '',
      n8nProfileUrl: '',
      invoiceNumber: '',
      phoneNumber: '',
      postalCode: '',
      address: '',
      bankName: '',
      branchName: '',
      accountType: '普通',
      accountNumber: '',
      accountHolder: ''
  });

  // Sync state with props when targetUser changes (e.g. via real-time update)
  useEffect(() => {
    let bankData = { bankName: '', branchName: '', accountType: '普通', accountNumber: '', accountHolder: '' };
    try {
        if (targetUser.bankAccountInfo) {
            const parsed = JSON.parse(targetUser.bankAccountInfo);
            bankData = { ...bankData, ...parsed };
        }
    } catch (e) {
        console.error("Failed to parse bank info", e);
    }

    setFormData({
      selfIntroduction: targetUser.selfIntroduction || '',
      experienceTags: targetUser.experienceTags || [],
      availableCategories: targetUser.availableCategories || [],
      portfolioUrl: targetUser.portfolioUrl || '',
      n8nProfileUrl: targetUser.n8nProfileUrl || '',
      invoiceNumber: targetUser.invoiceNumber || '',
      phoneNumber: targetUser.phoneNumber || '',
      postalCode: targetUser.postalCode || '',
      address: targetUser.address || '',
      ...bankData
    });
  }, [targetUser]);

  // Calculate Stats
  const completedProjects = projects.filter(p => p.assignedToUserId === targetUser.id && p.status === ProjectStatus.COMPLETED);
  const reviews = completedProjects.filter(p => p.review).map(p => ({ ...p.review!, projectTitle: p.title }));
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length).toFixed(1) 
    : '-';

  const theme = {
    bg: isAdmin ? 'bg-slate-900' : 'bg-gray-50',
    card: isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
    textMain: isAdmin ? 'text-white' : 'text-gray-900',
    textSub: isAdmin ? 'text-slate-400' : 'text-gray-500',
    input: isAdmin ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-300',
    tag: isAdmin ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700',
    tagActive: 'bg-n8n-orange text-white'
  };

  const handleSave = () => {
    if (onUpdateProfile) {
      // Re-structure Bank Info JSON
      const bankAccountInfo = JSON.stringify({
          bankName: formData.bankName,
          branchName: formData.branchName,
          accountType: formData.accountType,
          accountNumber: formData.accountNumber,
          accountHolder: formData.accountHolder
      });

      // Construct the update object (Partial<User>)
      const updateData: Partial<User> = {
          selfIntroduction: formData.selfIntroduction,
          experienceTags: formData.experienceTags,
          availableCategories: formData.availableCategories,
          portfolioUrl: formData.portfolioUrl,
          n8nProfileUrl: formData.n8nProfileUrl,
          invoiceNumber: formData.invoiceNumber,
          phoneNumber: formData.phoneNumber,
          postalCode: formData.postalCode,
          address: formData.address,
          bankAccountInfo: bankAccountInfo
      };

      onUpdateProfile(targetUser.id, updateData);
    }
    setIsEditing(false);
  };

  const toggleTag = (tag: string) => {
    const current = formData.experienceTags;
    if (current.includes(tag)) {
      setFormData({ ...formData, experienceTags: current.filter(t => t !== tag) });
    } else {
      setFormData({ ...formData, experienceTags: [...current, tag] });
    }
  };

  const toggleCategory = (cat: ProjectCategory) => {
    const current = formData.availableCategories;
    if (current.includes(cat)) {
      setFormData({ ...formData, availableCategories: current.filter(c => c !== cat) });
    } else {
      setFormData({ ...formData, availableCategories: [...current, cat] });
    }
  };

  return (
    <div className={`min-h-full ${theme.bg} ${theme.textMain}`}>
      {/* Header */}
      <div className={`${theme.card} border-b p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className={`${theme.textSub} hover:underline text-sm mr-2`}>
              &larr; 戻る
            </button>
          )}
          <img 
            src={targetUser.avatarUrl} 
            alt={targetUser.name} 
            className="w-20 h-20 rounded-full border-4 border-slate-200 object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {targetUser.name}
              {isAdmin && <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Partner</span>}
            </h1>
            <div className={`flex items-center gap-4 mt-1 ${theme.textSub} text-sm`}>
              <span className="flex items-center gap-1"><Mail size={14} /> {targetUser.email}</span>
              {targetUser.n8nProfileUrl && (
                <a href={targetUser.n8nProfileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-n8n-orange hover:underline">
                  <ExternalLink size={14} /> n8n Profile
                </a>
              )}
            </div>
          </div>
        </div>
        
        {isOwner && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-pantheon-navy text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
          >
            <Edit2 size={16} /> プロフィール編集
          </button>
        )}
        {isOwner && isEditing && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditing(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${isAdmin ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
            >
              <X size={16} /> キャンセル
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-n8n-orange text-white px-4 py-2 rounded-lg hover:bg-red-500 transition-colors shadow-lg"
            >
              <Save size={16} /> 保存
            </button>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Basic Info & Stats */}
        <div className="space-y-6">
           {/* Stats Card */}
           <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
              <h3 className="font-bold mb-4 flex items-center gap-2"><Award size={18} className="text-n8n-orange"/> 実績サマリー</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                 <div className={`p-3 rounded-lg ${isAdmin ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-xs ${theme.textSub}`}>完了案件数</p>
                    <p className="text-2xl font-bold">{completedProjects.length}</p>
                 </div>
                 <div className={`p-3 rounded-lg ${isAdmin ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-xs ${theme.textSub}`}>平均評価</p>
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold text-yellow-500">
                       {averageRating} <Star size={20} fill="currentColor" />
                    </div>
                 </div>
              </div>
           </div>

           {/* Skills & Categories */}
           <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
              <h3 className="font-bold mb-4 flex items-center gap-2"><Tag size={18} className="text-blue-500"/> 対応スキル・分野</h3>
              
              <div className="mb-6">
                 <p className={`text-xs font-bold uppercase mb-2 ${theme.textSub}`}>カテゴリー</p>
                 {isEditing ? (
                   <div className="flex flex-col gap-2">
                      {Object.values(ProjectCategory).map(cat => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.availableCategories.includes(cat)}
                            onChange={() => toggleCategory(cat)}
                            className="rounded text-n8n-orange focus:ring-n8n-orange"
                          />
                          <span className="text-sm">{categoryMap[cat]}</span>
                        </label>
                      ))}
                   </div>
                 ) : (
                   <div className="flex flex-wrap gap-2">
                      {formData.availableCategories.length > 0 ? formData.availableCategories.map(cat => (
                        <span key={cat} className={`text-xs px-2 py-1 rounded border ${theme.tag}`}>
                          {categoryMap[cat]}
                        </span>
                      )) : <span className={`text-sm ${theme.textSub}`}>未設定</span>}
                   </div>
                 )}
              </div>

              <div>
                 <p className={`text-xs font-bold uppercase mb-2 ${theme.textSub}`}>経験ツール & スキル</p>
                 {isEditing ? (
                   <div className="flex flex-wrap gap-2">
                      {EXPERIENCE_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            formData.experienceTags.includes(tag) 
                              ? theme.tagActive 
                              : theme.tag
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                   </div>
                 ) : (
                   <div className="space-y-3">
                      {/* Categorized Display */}
                      <div>
                         <span className="text-[10px] text-gray-400 block mb-1">ツール / SaaS</span>
                         <div className="flex flex-wrap gap-2">
                            {formData.experienceTags.filter(t => SKILL_CATEGORIES.TOOLS.includes(t)).length > 0 ? 
                               formData.experienceTags.filter(t => SKILL_CATEGORIES.TOOLS.includes(t)).map(tag => (
                                <span key={tag} className={`text-xs px-2 py-1 rounded ${theme.tag}`}>{tag}</span>
                               )) : <span className="text-xs text-gray-400">-</span>
                            }
                         </div>
                      </div>
                      <div>
                         <span className="text-[10px] text-gray-400 block mb-1">業務 / その他</span>
                         <div className="flex flex-wrap gap-2">
                            {formData.experienceTags.filter(t => !SKILL_CATEGORIES.TOOLS.includes(t)).length > 0 ? 
                               formData.experienceTags.filter(t => !SKILL_CATEGORIES.TOOLS.includes(t)).map(tag => (
                                <span key={tag} className={`text-xs px-2 py-1 rounded ${theme.tag}`}>{tag}</span>
                               )) : <span className="text-xs text-gray-400">-</span>
                            }
                         </div>
                      </div>
                   </div>
                 )}
              </div>
           </div>

           {/* Portfolio */}
           <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
              <h3 className="font-bold mb-4 flex items-center gap-2"><LinkIcon size={18} className="text-purple-500"/> ポートフォリオ</h3>
              {isEditing ? (
                <div className="space-y-2">
                   <label className={`text-xs ${theme.textSub}`}>ポートフォリオURL</label>
                   <input 
                     type="url"
                     value={formData.portfolioUrl}
                     onChange={e => setFormData({...formData, portfolioUrl: e.target.value})}
                     className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                     placeholder="https://..."
                   />
                </div>
              ) : (
                formData.portfolioUrl ? (
                  <a href={formData.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-500 hover:underline break-all">
                    <ExternalLink size={14} /> {formData.portfolioUrl}
                  </a>
                ) : (
                  <p className={`text-sm ${theme.textSub}`}>登録なし</p>
                )
              )}
           </div>

           {/* Basic Registration Info (Phone, Address) - Visible to Owner & Admin */}
           {(isOwner || isAdmin) && (
              <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
                  <h3 className="font-bold mb-4 flex items-center gap-2"><UserIcon size={18} className="text-blue-500"/> 基本登録情報</h3>
                  {isEditing ? (
                     <div className="space-y-4">
                        <div>
                           <label className={`text-xs font-bold ${theme.textSub} block mb-1`}>電話番号</label>
                           <input 
                             type="tel"
                             value={formData.phoneNumber}
                             onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                             className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                             placeholder="090-1234-5678"
                           />
                        </div>
                        <div>
                           <label className={`text-xs font-bold ${theme.textSub} block mb-1`}>郵便番号</label>
                           <input 
                             type="text"
                             value={formData.postalCode}
                             onChange={e => setFormData({...formData, postalCode: e.target.value})}
                             className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                             placeholder="123-4567"
                           />
                        </div>
                        <div>
                           <label className={`text-xs font-bold ${theme.textSub} block mb-1`}>住所</label>
                           <input 
                             type="text"
                             value={formData.address}
                             onChange={e => setFormData({...formData, address: e.target.value})}
                             className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                             placeholder="都道府県 市区町村..."
                           />
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-2">
                           <Phone size={16} className={`${theme.textSub} mt-0.5 shrink-0`} />
                           <div>
                              <p className={`text-xs ${theme.textSub}`}>電話番号</p>
                              <p>{formData.phoneNumber || '未登録'}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-2 border-t pt-2 border-slate-700/20">
                           <MapPin size={16} className={`${theme.textSub} mt-0.5 shrink-0`} />
                           <div>
                              <p className={`text-xs ${theme.textSub}`}>住所</p>
                              <p className="text-xs mb-0.5 font-mono">{formData.postalCode && `〒${formData.postalCode}`}</p>
                              <p>{formData.address || '未登録'}</p>
                           </div>
                        </div>
                     </div>
                  )}
              </div>
           )}

           {/* Bank & Invoice Info (Visible to Owner & Admin) */}
           {(isOwner || isAdmin) && (
             <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold flex items-center gap-2"><CreditCard size={18} className="text-emerald-500"/> 請求・口座情報</h3>
                   {!isEditing && (
                     <button 
                       onClick={() => setShowBankInfo(!showBankInfo)} 
                       className={`text-xs flex items-center gap-1 ${theme.textSub} hover:text-emerald-500`}
                     >
                       {showBankInfo ? <EyeOff size={14} /> : <Eye size={14} />} {showBankInfo ? '隠す' : '表示する'}
                     </button>
                   )}
                </div>
                
                {isEditing ? (
                   <div className="space-y-4">
                      {/* Invoice */}
                      <div>
                         <label className={`text-xs font-bold ${theme.textSub} block mb-1`}>インボイス登録番号</label>
                         <input 
                           type="text"
                           value={formData.invoiceNumber}
                           onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                           className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                           placeholder="T1234567890123"
                         />
                      </div>
                      
                      {/* Bank Info */}
                      <div className={`pt-4 border-t ${isAdmin ? 'border-slate-700' : 'border-gray-200'} space-y-3`}>
                         <label className={`text-xs font-bold ${theme.textSub} block mb-1 flex items-center gap-1`}><Building2 size={12}/> 銀行口座</label>
                         <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text"
                              value={formData.bankName}
                              onChange={e => setFormData({...formData, bankName: e.target.value})}
                              className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                              placeholder="銀行名"
                            />
                            <input 
                              type="text"
                              value={formData.branchName}
                              onChange={e => setFormData({...formData, branchName: e.target.value})}
                              className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                              placeholder="支店名"
                            />
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                             <select 
                               value={formData.accountType}
                               onChange={e => setFormData({...formData, accountType: e.target.value})}
                               className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                             >
                                <option value="普通">普通</option>
                                <option value="当座">当座</option>
                             </select>
                             <input 
                              type="text"
                              value={formData.accountNumber}
                              onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                              className={`col-span-2 w-full px-3 py-2 rounded-lg ${theme.input}`}
                              placeholder="口座番号"
                            />
                         </div>
                         <input 
                              type="text"
                              value={formData.accountHolder}
                              onChange={e => setFormData({...formData, accountHolder: e.target.value})}
                              className={`w-full px-3 py-2 rounded-lg ${theme.input}`}
                              placeholder="口座名義 (カナ)"
                            />
                      </div>
                   </div>
                ) : (
                   <div className="space-y-4 text-sm">
                      <div>
                         <p className={`text-xs ${theme.textSub}`}>インボイス番号</p>
                         <p className="font-mono">{formData.invoiceNumber || '未登録'}</p>
                      </div>
                      <div className={`pt-3 border-t ${isAdmin ? 'border-slate-700' : 'border-gray-100'}`}>
                         <p className={`text-xs ${theme.textSub} mb-1`}>銀行口座</p>
                         {formData.bankName ? (
                            <div className={`${isAdmin ? 'bg-slate-700' : 'bg-gray-100'} p-3 rounded-lg space-y-1`}>
                               <p className="font-bold">{formData.bankName} <span className="font-normal">{formData.branchName}</span></p>
                               <div className="flex items-center gap-2">
                                  <span>{formData.accountType}</span>
                                  {/* Masked Info */}
                                  <span className="font-mono">
                                    {showBankInfo ? formData.accountNumber : '*******'}
                                  </span>
                               </div>
                               <p className="text-xs">
                                 {showBankInfo ? formData.accountHolder : '*******'}
                               </p>
                            </div>
                         ) : (
                            <p className={theme.textSub}>口座情報未登録</p>
                         )}
                      </div>
                   </div>
                )}
             </div>
           )}
        </div>

        {/* Right Column: Bio & History */}
        <div className="lg:col-span-2 space-y-6">
           {/* Self Introduction */}
           <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
              <h3 className="font-bold mb-4 flex items-center gap-2"><UserIcon size={18} className="text-n8n-orange"/> 自己紹介・PR</h3>
              {isEditing ? (
                <textarea 
                  value={formData.selfIntroduction}
                  onChange={e => setFormData({...formData, selfIntroduction: e.target.value})}
                  className={`w-full h-40 p-4 rounded-lg resize-none ${theme.input} focus:ring-2 focus:ring-n8n-orange outline-none`}
                  placeholder="経歴、得意領域、アピールポイントなどを自由にご記入ください。"
                />
              ) : (
                <div className={`whitespace-pre-wrap text-sm leading-relaxed ${theme.textSub}`}>
                  {formData.selfIntroduction || '自己紹介がまだ入力されていません。'}
                </div>
              )}
           </div>

           {/* Reviews / History */}
           <div className={`${theme.card} p-6 rounded-xl shadow-sm border`}>
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Shield size={18} className="text-emerald-500"/> 実績・評価リスト
              </h3>
              
              <div className="space-y-6">
                 {reviews.length > 0 ? reviews.map((rev, idx) => (
                   <div key={idx} className={`pb-6 border-b ${isAdmin ? 'border-slate-700' : 'border-gray-100'} last:border-0 last:pb-0`}>
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold">{rev.projectTitle}</h4>
                         <span className={`text-xs ${theme.textSub}`}>{rev.createdAt}</span>
                      </div>
                      <div className="flex items-center mb-3">
                         {[...Array(5)].map((_, i) => (
                           <Star key={i} size={16} className={i < rev.score ? "text-yellow-400 fill-current" : "text-gray-300"} />
                         ))}
                         <span className="ml-2 font-bold text-yellow-500">{rev.score}.0</span>
                      </div>
                      <div className={`p-4 rounded-lg text-sm ${isAdmin ? 'bg-slate-700/30 text-slate-300' : 'bg-gray-50 text-gray-700'}`}>
                        "{rev.comment}"
                      </div>
                   </div>
                 )) : (
                   <div className={`text-center py-8 ${theme.textSub}`}>
                      <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                      <p>まだ実績評価はありません。</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};