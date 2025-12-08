
import React, { useState } from 'react';
import { Invoice, InvoiceStatus, User, Project, UserRole, ProjectStatus } from '../types';
import { FileText, Download, AlertCircle, Printer, ChevronDown, ArrowUpDown, Building2, Search, Filter, X, Loader2 } from 'lucide-react';

interface InvoicesProps {
  currentUser: User;
  invoices: Invoice[];
  projects: Project[];
  users?: User[]; // For admin to see user names
  onUpdateStatus?: (invoiceId: string, status: InvoiceStatus) => void;
  onCreateInvoice?: (projectId: string, amount: number, invoiceId?: string) => Promise<void>;
}

const statusMap: Record<string, string> = {
  UNBILLED: '未請求',
  BILLED: '請求済',
  PAID: '支払済' 
};

// Helper to safely parse bank info
const getBankInfo = (user?: User) => {
    if (!user || !user.bankAccountInfo) return null;
    try {
        return JSON.parse(user.bankAccountInfo);
    } catch {
        return null;
    }
};

export const Invoices: React.FC<InvoicesProps> = ({ currentUser, invoices, projects, users = [], onUpdateStatus, onCreateInvoice }) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  
  // State for Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // State for Filtering
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // State for Bank Info Modal
  const [viewBankInfoUser, setViewBankInfoUser] = useState<User | null>(null);

  // State for tracking processing invoices (to show loading spinner)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Admin sees all, Partner sees theirs
  const visibleInvoices = isAdmin ? invoices : invoices.filter(i => i.userId === currentUser.id);

  const handleDownloadPdf = async (url: string, invoiceId: string) => {
    if (!url || url === '#' || (!url.startsWith('http') && !url.startsWith('blob:'))) {
        alert('PDFデータがありません（デモデータ）。');
        return;
    }
    
    try {
        // Blob URL (created locally)
        if (url.startsWith('blob:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${invoiceId}.pdf`; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        // Remote URL: Try to fetch to force download
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `invoice_${invoiceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.warn("Download failed, falling back to open:", e);
        // Fallback: open in new tab
        window.open(url, '_blank');
    }
  };

  const handlePrint = async (invoiceId: string) => {
    // Prevent double clicking
    if (processingIds.has(invoiceId)) return;

    const inv = invoices.find(i => i.id === invoiceId);
    
    // Partner: Issue Invoice Logic
    if (inv && inv.status === InvoiceStatus.UNBILLED && !isAdmin) {
        if (!onCreateInvoice) return;

        const project = projects.find(p => p.id === inv.projectId);
        if (project) {
            // Start loading
            setProcessingIds(prev => new Set(prev).add(invoiceId));
            
            try {
                // Execute immediately without confirmation dialog
                await onCreateInvoice(project.id, inv.amount, invoiceId);
                // Success is handled by App.tsx Toast
            } catch (error) {
                console.error(error);
                alert('発行処理中にエラーが発生しました。');
            } finally {
                // Stop loading
                setProcessingIds(prev => {
                    const next = new Set(prev);
                    next.delete(invoiceId);
                    return next;
                });
            }
        }
    } else {
        // Admin or Already Billed: Download logic
        if (inv?.pdfUrl && inv.pdfUrl !== '#') {
             handleDownloadPdf(inv.pdfUrl, inv.id);
        } else {
             alert(`請求書PDF #${invoiceId} をダウンロードします。`);
        }
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter Logic
  const filteredInvoices = visibleInvoices.filter(inv => {
    const project = projects.find(p => p.id === inv.projectId);
    const partner = users.find(u => u.id === inv.userId);
    
    const searchText = filterText.toLowerCase();
    const matchesText = 
      (inv.id || '').toLowerCase().includes(searchText) ||
      (project?.title || '').toLowerCase().includes(searchText) ||
      (partner?.name || '').toLowerCase().includes(searchText);

    const matchesStatus = filterStatus === 'ALL' || inv.status === filterStatus;

    return matchesText && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let valA: any = '';
    let valB: any = '';
    
    switch(sortConfig.key) {
        case 'id': valA = a.id; valB = b.id; break;
        case 'partner': 
            valA = users.find(u => u.id === a.userId)?.name || ''; 
            valB = users.find(u => u.id === b.userId)?.name || ''; 
            break;
        case 'project': 
            valA = projects.find(p => p.id === a.projectId)?.title || ''; 
            valB = projects.find(p => p.id === b.projectId)?.title || ''; 
            break;
        case 'date': valA = a.issueDate; valB = b.issueDate; break;
        case 'amount': valA = a.amount; valB = b.amount; break;
        case 'status': valA = a.status; valB = b.status; break;
        default: return 0;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Theme Helpers
  const theme = {
    title: isAdmin ? 'text-white' : 'text-pantheon-navy',
    cardBg: isAdmin ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100',
    headerBg: isAdmin ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-gray-50 border-gray-100 text-gray-500',
    rowHover: isAdmin ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50',
    textMain: isAdmin ? 'text-slate-200' : 'text-gray-800',
    textSub: isAdmin ? 'text-slate-400' : 'text-gray-600',
    amount: isAdmin ? 'text-white' : 'text-gray-900',
    border: isAdmin ? 'border-slate-700' : 'border-gray-100',
    emptyText: isAdmin ? 'text-slate-500' : 'text-gray-400',
    modalBg: isAdmin ? 'bg-slate-800 text-white' : 'bg-white text-gray-900',
    inputBg: isAdmin ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    optionClass: isAdmin ? 'bg-slate-800 text-slate-300' : 'bg-white text-gray-900'
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch(status) {
        case InvoiceStatus.PAID: return 'text-green-600 bg-green-50';
        case InvoiceStatus.BILLED: return 'text-blue-600 bg-blue-50';
        case InvoiceStatus.UNBILLED: return 'text-yellow-600 bg-yellow-50';
        default: return 'text-gray-600';
    }
  };

  const getStatusColorClass = (status: InvoiceStatus) => {
    switch(status) {
        case InvoiceStatus.PAID: return 'bg-green-900/30 text-green-400 border-green-900/50';
        case InvoiceStatus.BILLED: return 'bg-blue-900/30 text-blue-400 border-blue-900/50';
        case InvoiceStatus.UNBILLED: return 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50';
        default: return 'bg-slate-700 text-slate-400';
    }
  };

  const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
      <th 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors group select-none"
        onClick={() => handleSort(sortKey)}
      >
          <div className="flex items-center gap-1">
              {label}
              <ArrowUpDown size={14} className={`text-slate-500 ${sortConfig?.key === sortKey ? 'text-blue-400 opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
          </div>
      </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h1 className={`text-2xl font-bold ${theme.title}`}>{isAdmin ? '売上・入出金管理' : '売上・請求書管理'}</h1>
      </div>

      {/* Warning for T-Number (Partner only) */}
      {!isAdmin && !currentUser.invoiceNumber && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
           <AlertCircle className="text-red-500 mt-1 mr-3 flex-shrink-0" />
           <div>
               <h4 className="font-bold text-red-800">インボイス登録番号が未設定です</h4>
               <p className="text-sm text-red-700 mt-1">
                   適格請求書発行事業者登録番号（T番号）がプロフィールに登録されていません。
                   適格請求書を発行するには設定が必要です。
               </p>
           </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${theme.cardBg} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4`}>
        <div className="relative flex-1">
           <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSub}`} size={18} />
           <input 
             type="text" 
             placeholder="ID・案件名・パートナー名で検索..." 
             value={filterText}
             onChange={(e) => setFilterText(e.target.value)}
             className={`w-full pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme.inputBg}`}
           />
        </div>
        <div className="flex items-center gap-2">
           <div className={`flex items-center px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg}`}>
             <Filter size={18} className={`${theme.textSub} mr-2`} />
             <select 
               value={filterStatus}
               onChange={(e) => setFilterStatus(e.target.value)}
               className="bg-transparent outline-none cursor-pointer text-sm font-medium"
             >
               <option value="ALL" className={theme.optionClass}>全てのステータス</option>
               <option value="UNBILLED" className={theme.optionClass}>未請求</option>
               <option value="BILLED" className={theme.optionClass}>請求済</option>
               <option value="PAID" className={theme.optionClass}>支払済</option>
             </select>
           </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className={`${theme.cardBg} rounded-xl shadow-sm border overflow-hidden`}>
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className={`${theme.headerBg} border-b text-xs uppercase font-semibold tracking-wider`}>
                    <SortHeader label="ID" sortKey="id" />
                    {isAdmin && <SortHeader label="パートナー" sortKey="partner" />}
                    <SortHeader label="案件名" sortKey="project" />
                    <SortHeader label="日付" sortKey="date" />
                    <SortHeader label="金額 (円)" sortKey="amount" />
                    <SortHeader label="ステータス" sortKey="status" />
                    <th className="p-4 text-right">操作</th>
                </tr>
            </thead>
            <tbody className={`divide-y ${isAdmin ? 'divide-slate-700' : 'divide-gray-100'}`}>
                {sortedInvoices.length > 0 ? sortedInvoices.map(inv => {
                    const project = projects.find(p => p.id === inv.projectId);
                    const partner = users.find(u => u.id === inv.userId);
                    const isProcessing = processingIds.has(inv.id);

                    return (
                        <tr key={inv.id} className={`${theme.rowHover} transition-colors`}>
                            <td className={`p-4 font-mono text-sm ${theme.textSub}`}>#{inv.id}</td>
                            {isAdmin && <td className={`p-4 font-medium text-sm ${theme.textMain}`}>{partner?.name}</td>}
                            <td className={`p-4 font-medium ${theme.textMain} text-sm`}>{project?.title || '不明な案件'}</td>
                            <td className={`p-4 text-sm ${theme.textSub}`}>{inv.issueDate || '-'}</td>
                            <td className={`p-4 font-bold ${theme.amount}`}>¥{inv.amount.toLocaleString()}</td>
                            <td className="p-4">
                                {isAdmin ? (
                                    <div className="flex items-center gap-2">
                                        <div className="relative inline-block group">
                                            <select 
                                                value={inv.status}
                                                onChange={(e) => {
                                                    if (onUpdateStatus) {
                                                        onUpdateStatus(inv.id, e.target.value as InvoiceStatus);
                                                    }
                                                }}
                                                className={`appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors ${getStatusColorClass(inv.status)}`}
                                            >
                                                <option value="UNBILLED" className="bg-slate-800 text-slate-300">未請求</option>
                                                <option value="BILLED" className="bg-slate-800 text-slate-300">請求済</option>
                                                <option value="PAID" className="bg-slate-800 text-slate-300">支払済</option>
                                            </select>
                                            <ChevronDown size={12} className={`absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none opacity-70 group-hover:opacity-100 ${getStatusColorClass(inv.status).split(' ')[1]}`} />
                                        </div>
                                        <button 
                                            onClick={() => setViewBankInfoUser(partner || null)}
                                            className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
                                            title="振込先口座情報を確認"
                                        >
                                            <Building2 size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(inv.status)}`}>
                                        {statusMap[inv.status]}
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                    {isAdmin ? (
                                        <>
                                            {inv.pdfUrl && inv.pdfUrl !== '#' ? (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadPdf(inv.pdfUrl!, inv.id);
                                                    }}
                                                    className={`inline-flex items-center px-3 py-1.5 border ${theme.border} ${theme.textSub} text-xs font-bold rounded hover:bg-slate-700 transition-colors`}
                                                    title="PDFをダウンロード"
                                                >
                                                    <Download size={14} className="mr-1" /> PDF
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => alert('PDFデータがありません（デモデータ）')}
                                                    className={`inline-flex items-center px-3 py-1.5 border ${theme.border} ${theme.textSub} text-xs font-bold rounded hover:bg-slate-700 transition-colors opacity-50`}
                                                    title="PDFなし"
                                                >
                                                    <FileText size={14} className="mr-1" /> -
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        // Partner View
                                        inv.status === InvoiceStatus.UNBILLED ? (
                                            <button 
                                                onClick={() => handlePrint(inv.id)}
                                                disabled={isProcessing}
                                                className={`inline-flex items-center px-3 py-1.5 bg-pantheon-navy text-white text-xs font-bold rounded hover:bg-pantheon-light transition-colors ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
                                            >
                                                {isProcessing ? (
                                                   <>
                                                     <Loader2 size={14} className="mr-1 animate-spin" /> 発行中
                                                   </>
                                                ) : (
                                                   <>
                                                     <Printer size={14} className="mr-1" /> 発行
                                                   </>
                                                )}
                                            </button>
                                        ) : (
                                            inv.pdfUrl && inv.pdfUrl !== '#' ? (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadPdf(inv.pdfUrl!, inv.id);
                                                    }}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-bold rounded hover:bg-gray-50 transition-colors"
                                                    title="PDFをダウンロード"
                                                >
                                                    <Download size={14} className="mr-1" /> PDF
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => alert('デモ用データのためPDFはありません')}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-bold rounded hover:bg-gray-50 transition-colors"
                                                >
                                                    <Download size={14} className="mr-1" /> PDF
                                                </button>
                                            )
                                        )
                                    )}
                                </div>
                            </td>
                        </tr>
                    )
                }) : (
                    <tr>
                        <td colSpan={isAdmin ? 7 : 6} className={`p-8 text-center ${theme.emptyText}`}>
                            {filterText || filterStatus !== 'ALL' ? '検索条件に一致する請求書はありません。' : '請求書データはありません。'}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* Bank Info Modal */}
      {viewBankInfoUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm border border-slate-700">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Building2 size={18} className="text-emerald-500" /> 振込先口座情報
                    </h3>
                    <button onClick={() => setViewBankInfoUser(null)} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                        <img src={viewBankInfoUser.avatarUrl} className="w-10 h-10 rounded-full border border-slate-600" alt="" />
                        <div>
                            <p className="font-bold text-white">{viewBankInfoUser.name}</p>
                            <p className="text-xs text-slate-400">{viewBankInfoUser.email}</p>
                        </div>
                    </div>
                    
                    {(() => {
                        const bankInfo = getBankInfo(viewBankInfoUser);
                        return bankInfo ? (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase">銀行名</p>
                                      <p className="text-white font-medium text-lg">{bankInfo.bankName}</p>
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase">支店名</p>
                                      <p className="text-white font-medium text-lg">{bankInfo.branchName}</p>
                                  </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                  <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase">種別</p>
                                      <p className="text-white font-medium">{bankInfo.accountType}</p>
                                  </div>
                                  <div className="col-span-2">
                                      <p className="text-xs font-bold text-slate-500 uppercase">口座番号</p>
                                      <p className="text-white font-mono text-lg tracking-widest">{bankInfo.accountNumber}</p>
                                  </div>
                              </div>
                              <div>
                                  <p className="text-xs font-bold text-slate-500 uppercase">口座名義 (カナ)</p>
                                  <p className="text-white font-medium text-lg">{bankInfo.accountHolder}</p>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-8 text-slate-500">
                              <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                              <p>口座情報が登録されていません</p>
                          </div>
                      );
                    })()}
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end">
                    <button 
                        onClick={() => setViewBankInfoUser(null)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
