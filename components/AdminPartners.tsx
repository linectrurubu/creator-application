import React, { useState, useMemo } from 'react';
import { User, UserRole, UserStatus, Invoice, InvoiceStatus, Project } from '../types';
import { CheckCircle, XCircle, ExternalLink, Shield, Users, Search, AlertTriangle, ArrowUpDown, Star, MessageCircle, Briefcase } from 'lucide-react';

interface AdminPartnersProps {
  users: User[];
  invoices?: Invoice[]; // Added for revenue calculation
  projects: Project[]; // Added for order count calculation
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  onUpdateStatus: (userId: string, status: UserStatus) => void;
  onViewProfile?: (userId: string) => void;
  onStartChat: (userId: string) => void; // Added: Chat trigger
}

export const AdminPartners: React.FC<AdminPartnersProps> = ({ 
  users, 
  invoices = [], 
  projects = [],
  onApprove, 
  onReject, 
  onUpdateStatus,
  onViewProfile,
  onStartChat
}) => {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'NAME' | 'REVENUE' | 'ORDER_COUNT'>('REVENUE');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // jobPortalEnabled が true のユーザー、または role が PARTNER のユーザーをパートナーとして扱う
  const partners = users.filter(u => u.jobPortalEnabled === true || u.role === UserRole.PARTNER);
  
  // 承認待ちのユーザー
  const pending = partners.filter(u => u.status === UserStatus.PENDING);
  
  // 管理対象ユーザー（承認済み または 停止/否認済み） - 承認待ち以外
  const managedPartners = useMemo(() => {
    let list = partners.filter(u => u.status !== UserStatus.PENDING).map(user => {
        // Calculate Revenue
        const userRevenue = invoices
            .filter(i => i.userId === user.id && i.status === InvoiceStatus.PAID)
            .reduce((acc, curr) => acc + curr.amount, 0);
        
        // Calculate Order Count (Projects Assigned)
        const orderCount = projects.filter(p => p.assignedToUserId === user.id).length;

        return { ...user, revenue: userRevenue, orderCount };
    });

    if (searchText) {
        const lower = searchText.toLowerCase();
        list = list.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
    }

    return list.sort((a, b) => {
        let valA: any = a.revenue;
        let valB: any = b.revenue;

        if (sortBy === 'NAME') {
            valA = a.name;
            valB = b.name;
        } else if (sortBy === 'ORDER_COUNT') {
            valA = a.orderCount;
            valB = b.orderCount;
        }
        
        if (sortOrder === 'ASC') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });
  }, [partners, invoices, projects, searchText, sortBy, sortOrder]);

  const formatYen = (val: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(val);
  };

  return (
    <div className="space-y-8 text-slate-200 animate-in fade-in duration-500">
      
      {/* Pending Approvals */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center">
            <span className="w-1.5 h-6 bg-n8n-orange rounded mr-3"></span>
            承認待ちパートナー ({pending.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pending.map(user => (
              <div key={user.id} className="bg-slate-800 border-l-4 border-n8n-orange rounded-r-xl border border-slate-700 shadow-lg p-6 relative group">
                 <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onViewProfile && onViewProfile(user.id)}>
                        <img src={user.avatarUrl} className="w-12 h-12 rounded-full bg-slate-700 object-cover border border-slate-600" alt="" />
                        <div>
                            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{user.name}</h3>
                            <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                    </div>
                 </div>
                 
                 <div className="mb-4 space-y-2">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">n8n 公認プロフィール</p>
                        {user.n8nProfileUrl ? (
                            <a href={user.n8nProfileUrl} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center break-all">
                                {user.n8nProfileUrl} <ExternalLink size={12} className="ml-1" />
                            </a>
                        ) : <span className="text-xs text-slate-500">未登録</span>}
                    </div>
                    {user.selfIntroduction && (
                        <div className="bg-slate-700/50 p-2 rounded text-xs text-slate-300 border border-slate-700/50 line-clamp-3">
                            {user.selfIntroduction}
                        </div>
                    )}
                 </div>

                 <div className="flex space-x-2 mt-4">
                    <button 
                        onClick={() => onApprove(user.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center transition-colors shadow-sm"
                    >
                        <CheckCircle size={16} className="mr-1" /> 承認
                    </button>
                    <button 
                        onClick={() => onReject(user.id)}
                        className="flex-1 bg-slate-700 hover:bg-red-900/40 text-red-400 py-2 rounded-lg font-bold text-sm flex items-center justify-center border border-transparent hover:border-red-800 transition-colors"
                    >
                        <XCircle size={16} className="mr-1" /> 否認
                    </button>
                 </div>
                 {onViewProfile && (
                     <button 
                        onClick={() => onViewProfile(user.id)}
                        className="w-full mt-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                     >
                        詳細プロフィールを確認
                     </button>
                 )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Managed Partner List (Active & Rejected) */}
      <section>
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
             <h2 className="text-lg font-bold text-slate-200 flex items-center">
                <span className="w-1.5 h-6 bg-blue-500 rounded mr-3"></span>
                パートナー管理一覧
             </h2>
             <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                   type="text" 
                   placeholder="名前・メールで検索..." 
                   value={searchText}
                   onChange={e => setSearchText(e.target.value)}
                   className="bg-slate-800 text-white pl-9 pr-4 py-2 rounded-lg text-sm border border-slate-700 focus:outline-none focus:border-blue-500 w-full md:w-64"
                />
             </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-700">
                        <tr>
                            <th className="p-4 cursor-pointer hover:text-white" onClick={() => { setSortBy('NAME'); setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC'); }}>
                                氏名 <ArrowUpDown size={12} className="inline ml-1"/>
                            </th>
                            <th className="p-4">スキルタグ</th>
                            <th className="p-4 cursor-pointer hover:text-white" onClick={() => { setSortBy('REVENUE'); setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC'); }}>
                                累計報酬 <ArrowUpDown size={12} className="inline ml-1"/>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white" onClick={() => { setSortBy('ORDER_COUNT'); setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC'); }}>
                                累計受注数 <ArrowUpDown size={12} className="inline ml-1"/>
                            </th>
                            <th className="p-4">T番号 (インボイス)</th>
                            <th className="p-4">操作・ステータス</th>
                            <th className="p-4 text-center">詳細</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {managedPartners.map(user => (
                            <tr key={user.id} className={`${user.status === UserStatus.REJECTED ? 'opacity-60 bg-red-900/5' : 'hover:bg-slate-700/50'} transition-colors group`}>
                                <td className="p-4 font-medium text-white">
                                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onViewProfile && onViewProfile(user.id)}>
                                        <img src={user.avatarUrl} className="w-8 h-8 rounded-full object-cover border border-slate-600" alt=""/>
                                        <div>
                                            <p className="group-hover:text-blue-400 transition-colors">{user.name}</p>
                                            <p className="text-xs text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400">
                                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                                        {user.experienceTags && user.experienceTags.length > 0 ? (
                                            user.experienceTags.slice(0,3).map(tag => (
                                                <span key={tag} className="text-xs bg-slate-700 px-2 py-0.5 rounded border border-slate-600">{tag}</span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-600">-</span>
                                        )}
                                        {user.experienceTags && user.experienceTags.length > 3 && (
                                            <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded border border-slate-600">+{user.experienceTags.length - 3}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-emerald-400 font-bold">
                                    {formatYen(user.revenue)}
                                </td>
                                <td className="p-4 font-mono text-blue-400 font-bold">
                                    {user.orderCount} <span className="text-xs text-slate-500 font-normal">件</span>
                                </td>
                                <td className="p-4">
                                    {user.invoiceNumber ? (
                                        <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded text-slate-300">{user.invoiceNumber}</span>
                                    ) : (
                                        <span className="text-xs text-red-400 flex items-center"><AlertTriangle size={12} className="mr-1"/> 未登録</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => onUpdateStatus(user.id, UserStatus.ACTIVE)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-l-lg border transition-colors ${
                                                user.status === UserStatus.ACTIVE
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : 'bg-slate-800 text-slate-500 border-slate-600 hover:bg-slate-700'
                                            }`}
                                        >
                                            有効
                                        </button>
                                        <button
                                            onClick={() => onUpdateStatus(user.id, UserStatus.REJECTED)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-r-lg border-t border-r border-b transition-colors ${
                                                user.status === UserStatus.REJECTED
                                                ? 'bg-red-600 text-white border-red-600'
                                                : 'bg-slate-800 text-slate-500 border-slate-600 hover:bg-slate-700'
                                            }`}
                                        >
                                            停止
                                        </button>
                                        <button
                                            onClick={() => onStartChat(user.id)}
                                            className="ml-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 border border-slate-600 rounded-lg transition-colors"
                                            title="個別チャット"
                                        >
                                            <MessageCircle size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    {onViewProfile && (
                                        <button 
                                            onClick={() => onViewProfile(user.id)}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                                            title="詳細プロフィール"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {managedPartners.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-500">
                                    {searchText ? '検索条件に一致するパートナーがいません。' : '表示できるパートナーがいません。'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
             </div>
          </div>
      </section>
    </div>
  );
};