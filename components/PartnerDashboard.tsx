
import React, { useMemo } from 'react';
import { User, Project, Invoice, ProjectStatus, InvoiceStatus, Application, ApplicationStatus, Notification, NotificationType, Message } from '../types';
import { 
  BarChart2, Layers, DollarSign, Activity, Bell, Zap, ChevronRight, Search, FileText, LayoutDashboard, Briefcase, CreditCard, MessageCircle, Star, ChevronDown
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Legend, Line
} from 'recharts';

interface PartnerDashboardProps {
  currentUser: User;
  projects: Project[];
  invoices: Invoice[];
  applications?: Application[];
  messages?: Message[];
  notifications?: Notification[];
  onChangeView: (view: any, params?: any) => void;
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkProjectAsRead?: (projectId: string) => void;
}

// Helper functions (duplicated to maintain isolation)
const formatYen = (val: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(val);
};

const categoryMap: Record<string, string> = {
  LECTURER: '講師',
  DX_CONSULTING: 'DXコンサル',
  DEVELOPMENT: '開発'
};

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  currentUser,
  projects,
  invoices,
  applications,
  messages,
  notifications,
  onChangeView,
  onMarkNotificationAsRead,
  onMarkProjectAsRead
}) => {
  // Chart State
  const [chartTimeRange, setChartTimeRange] = React.useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [chartMetric, setChartMetric] = React.useState<'REVENUE' | 'COUNT' | 'ALL'>('REVENUE');

  // Badge Calculations
  const partners = []; // Not used in partner view but keeping structure if needed
  const totalUnreadMessages = 0; // Calculated differently below

  // Calculate Stats
  const myInvoices = invoices.filter(i => i.userId === currentUser.id);
  const paidRevenue = myInvoices.filter(i => i.status === InvoiceStatus.PAID).reduce((acc, i) => acc + i.amount, 0);
  const pendingRevenue = myInvoices.filter(i => i.status !== InvoiceStatus.PAID).reduce((acc, i) => acc + i.amount, 0);
  
  const myProjects = projects.filter(p => p.assignedToUserId === currentUser.id);
  const activeProjectsList = myProjects.filter(p => p.status === ProjectStatus.IN_PROGRESS);
  const myApplications = applications ? applications.filter(a => a.userId === currentUser.id) : [];
  const totalProjects = projects.length; // For stats if needed

  // Message Stats
  const unreadProjectMessages = messages ? messages.filter(m => m.projectId && m.senderId !== currentUser.id && !m.isRead).length : 0;
  // Direct messages unread
  const unreadDirectMessages = messages ? messages.filter(m => !m.projectId && m.receiverId === currentUser.id && !m.isRead).length : 0;
  const totalUnread = unreadProjectMessages + unreadDirectMessages;

  // Notifications (New Info)
  const myNotifications = notifications 
    ? notifications.filter(n => n.userId === currentUser.id && !n.isRead)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : [];

  // Chart Data Generation (Dynamic)
  const partnerChartData = useMemo(() => {
      const data: {name: string, revenue: number, count: number}[] = [];
      const now = new Date();
      
      if (chartTimeRange === 'DAILY') {
          // Last 7 days
          for (let i = 6; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              const label = `${d.getMonth() + 1}/${d.getDate()}`;
              const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
              
              const relevantInvoices = myInvoices.filter(inv => inv.status === InvoiceStatus.PAID && inv.issueDate === key);
              data.push({
                  name: label,
                  revenue: relevantInvoices.reduce((acc, c) => acc + c.amount, 0),
                  count: relevantInvoices.length
              });
          }
      } else if (chartTimeRange === 'MONTHLY') {
          // Last 6 months
          for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const label = `${d.getMonth() + 1}月`;
              
              const relevantInvoices = myInvoices.filter(inv => inv.status === InvoiceStatus.PAID && inv.issueDate.startsWith(key));
              data.push({ 
                  name: label, 
                  revenue: relevantInvoices.reduce((acc, curr) => acc + curr.amount, 0),
                  count: relevantInvoices.length
              });
          }
      } else {
            // Yearly (Last 3 years)
            for (let i = 2; i >= 0; i--) {
              const year = now.getFullYear() - i;
              const label = `${year}年`;
              const relevantInvoices = myInvoices.filter(inv => inv.status === InvoiceStatus.PAID && inv.issueDate.startsWith(`${year}`));
              data.push({
                  name: label,
                  revenue: relevantInvoices.reduce((acc, c) => acc + c.amount, 0),
                  count: relevantInvoices.length
              });
            }
      }
      return data;
  }, [myInvoices, chartTimeRange]);

  // Action Center Logic
  const profileIncomplete = !currentUser.bankAccountInfo || !currentUser.invoiceNumber;
  const actionItems = [
    ...(totalUnread > 0 ? [{ 
        type: 'MESSAGE', 
        text: `未読メッセージが ${totalUnread} 件あります`, 
        action: () => onChangeView('DIRECT_MESSAGES'),
        btnText: '確認する'
    }] : []),
    ...(profileIncomplete ? [{
        type: 'PROFILE', 
        text: 'プロフィール情報を完成させましょう（口座・インボイス）', 
        action: () => onChangeView('PROFILE'),
        btnText: '編集する'
    }] : []),
    ...(myApplications.filter(a => a.status === ApplicationStatus.APPLIED).length > 0 ? [{
        type: 'APPLICATION',
        text: `応募中の案件が ${myApplications.filter(a => a.status === ApplicationStatus.APPLIED).length} 件あります`,
        action: () => onChangeView('PROJECTS_LIST', { tab: 'MANAGE' }),
        btnText: '確認する'
    }] : [])
  ];

  return (
      <div className="space-y-6 text-gray-800 animate-in fade-in duration-500">
        
        {/* Action Center */}
        {actionItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border-l-4 border-pantheon-navy overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Zap size={18} className="text-n8n-orange fill-current" /> アクションセンター
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm border border-gray-100">
                      {actionItems.length} 件のタスク
                  </span>
              </div>
              <div className="divide-y divide-gray-50">
                  {actionItems.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${item.type === 'MESSAGE' ? 'bg-purple-500' : item.type === 'PROFILE' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                              <span className="text-sm font-medium text-gray-700">{item.text}</span>
                          </div>
                          <button 
                              onClick={item.action} 
                              className="text-xs font-bold text-pantheon-navy hover:text-n8n-orange flex items-center transition-colors"
                          >
                              {item.btnText} <ChevronRight size={14} className="ml-1" />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
        )}

        {/* Header & Motivation */}
        <div className="bg-gradient-to-r from-pantheon-navy to-pantheon-light text-white p-6 rounded-xl shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-2xl font-bold flex items-center gap-3">
                  こんにちは、{currentUser.name} さん
              </h1>
              <div className="mt-4 flex gap-3">
                  <button onClick={() => onChangeView('PROJECTS_LIST')} className="bg-white text-pantheon-navy px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors shadow-sm flex items-center">
                        <Search size={16} className="mr-2" /> 案件を探す
                  </button>
                  <button onClick={() => onChangeView('INVOICES')} className="bg-pantheon-navy border border-white/30 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/10 transition-colors flex items-center">
                        <FileText size={16} className="mr-2" /> 請求書作成
                  </button>
              </div>
            </div>
            {/* Decorative Background Elements */}
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                <LayoutDashboard size={200} />
            </div>
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        </div>
        
        {/* KPI Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-pantheon-navy uppercase tracking-wider">受取済み報酬</p>
                      <h3 className="text-2xl font-bold text-pantheon-navy mt-1">{formatYen(paidRevenue)}</h3>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={20} /></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">請求中 / 未入金</p>
                      <h3 className="text-2xl font-bold text-gray-700 mt-1">{formatYen(pendingRevenue)}</h3>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CreditCard size={20} /></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">進行中プロジェクト</p>
                      <h3 className="text-2xl font-bold text-gray-700 mt-1">{activeProjectsList.length} <span className="text-sm font-normal text-gray-400">件</span></h3>
                  </div>
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Briefcase size={20} /></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">未読メッセージ</p>
                      <h3 className="text-2xl font-bold text-gray-700 mt-1">{totalUnread} <span className="text-sm font-normal text-gray-400">件</span></h3>
                  </div>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><MessageCircle size={20} /></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Revenue Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                      <div className="flex items-center gap-4">
                          <h3 className="font-bold text-gray-800 flex items-center"><BarChart2 size={18} className="mr-2 text-pantheon-navy"/> 報酬レポート</h3>
                          <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-medium border border-gray-200">
                              <button onClick={() => setChartMetric('REVENUE')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'REVENUE' ? 'bg-white text-pantheon-navy shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}><DollarSign size={12} /> 報酬</button>
                              <button onClick={() => setChartMetric('COUNT')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'COUNT' ? 'bg-white text-pantheon-navy shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}><BarChart2 size={12} /> 受注数</button>
                              <button onClick={() => setChartMetric('ALL')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'ALL' ? 'bg-white text-pantheon-navy shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}><Layers size={12} /> 一括</button>
                          </div>
                      </div>
                      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                          <button onClick={() => setChartTimeRange('DAILY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'DAILY' ? 'bg-pantheon-navy text-white shadow-sm' : 'text-gray-500 hover:bg-white'}`}>日次</button>
                          <button onClick={() => setChartTimeRange('MONTHLY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'MONTHLY' ? 'bg-pantheon-navy text-white shadow-sm' : 'text-gray-500 hover:bg-white'}`}>月次</button>
                          <button onClick={() => setChartTimeRange('YEARLY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'YEARLY' ? 'bg-pantheon-navy text-white shadow-sm' : 'text-gray-500 hover:bg-white'}`}>年次</button>
                      </div>
                  </div>
                  <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          {chartMetric === 'ALL' ? (
                              <ComposedChart data={partnerChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                  <defs>
                                      <linearGradient id="colorRevPartner" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0F2E53" stopOpacity={0.2}/><stop offset="95%" stopColor="#0F2E53" stopOpacity={0}/></linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                  <YAxis yAxisId="left" width={80} orientation="left" axisLine={false} tickLine={false} tick={{fill: '#0F2E53', fontSize: 12, fontWeight: 500}} tickFormatter={(val) => `¥${val.toLocaleString()}`} />
                                  <YAxis yAxisId="right" width={40} orientation="right" axisLine={false} tickLine={false} tick={{fill: '#FF6D5A', fontSize: 12, fontWeight: 500}} tickFormatter={(val) => `${val}件`}/>
                                  <Tooltip 
                                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: '#fff', color: '#1F2937' }}
                                      formatter={(value: any, name: any) => { 
                                          if (name === '報酬') return [formatYen(Number(value)), name]; 
                                          if (name === '受注数') return [`${value} 件`, name]; 
                                          return [value, name]; 
                                      }}
                                  />
                                  <Legend verticalAlign="top" height={36} iconType="circle" />
                                  <Area yAxisId="left" type="monotone" dataKey="revenue" name="報酬" stroke="#0F2E53" fillOpacity={1} fill="url(#colorRevPartner)" dot={{ r: 3, fill: '#fff', stroke: '#0F2E53', strokeWidth: 2 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                                  <Line yAxisId="right" type="monotone" dataKey="count" name="受注数" stroke="#FF6D5A" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#FF6D5A', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                              </ComposedChart>
                          ) : (
                              <AreaChart data={partnerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorValPartner" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={chartMetric === 'REVENUE' ? '#0F2E53' : '#FF6D5A'} stopOpacity={0.1}/>
                                          <stop offset="95%" stopColor={chartMetric === 'REVENUE' ? '#0F2E53' : '#FF6D5A'} stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                  <YAxis width={80} axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(val) => chartMetric === 'REVENUE' ? `¥${val.toLocaleString()}` : val} />
                                  <Tooltip 
                                      cursor={{ stroke: '#e5e7eb' }}
                                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: '#fff', color: '#1F2937' }}
                                      formatter={(value: number) => [chartMetric === 'REVENUE' ? formatYen(value) : `${value} 件`, chartMetric === 'REVENUE' ? '報酬' : '受注数']} 
                                  />
                                  <Area 
                                      type="monotone" 
                                      dataKey={chartMetric === 'REVENUE' ? 'revenue' : 'count'} 
                                      name={chartMetric === 'REVENUE' ? '報酬' : '受注数'}
                                      stroke={chartMetric === 'REVENUE' ? '#0F2E53' : '#FF6D5A'} 
                                      strokeWidth={2} 
                                      fillOpacity={1} 
                                      fill="url(#colorValPartner)" 
                                      animationDuration={800} 
                                      dot={{ r: 3, fill: '#fff', stroke: chartMetric === 'REVENUE' ? '#0F2E53' : '#FF6D5A', strokeWidth: 2 }} 
                                      activeDot={{ r: 5, strokeWidth: 0 }} 
                                  />
                              </AreaChart>
                          )}
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Active Projects List */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center"><Activity size={18} className="mr-2 text-green-500"/> 進行中の案件リスト</h3>
                      {activeProjectsList.length > 0 && <button onClick={() => onChangeView('PROJECTS_LIST', { tab: 'MANAGE' })} className="text-xs text-blue-600 font-bold hover:underline">すべて見る</button>}
                  </div>
                  <div className="divide-y divide-gray-100">
                      {activeProjectsList.length > 0 ? activeProjectsList.map(project => {
                          const unreadCount = messages ? messages.filter(m => m.projectId === project.id && !m.isRead && m.senderId !== currentUser.id).length : 0;
                          return (
                              <div 
                                  key={project.id} 
                                  onClick={() => {
                                      if(onMarkProjectAsRead) onMarkProjectAsRead(project.id);
                                      onChangeView('PROJECT_DETAIL', { projectId: project.id });
                                  }} 
                                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group flex items-center justify-between"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-xs shrink-0 border border-gray-200">
                                          {categoryMap[project.category].substring(0,2)}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className="font-bold text-gray-800 group-hover:text-pantheon-navy transition-colors">{project.title}</h4>
                                              {unreadCount > 0 && (
                                                  <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                                                      {unreadCount}
                                                  </span>
                                              )}
                                          </div>
                                          <div className="flex items-center gap-3 mt-1">
                                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">予算: {formatYen(project.budget)}</span>
                                              <span className="text-xs text-blue-600 font-medium">進行中</span>
                                          </div>
                                      </div>
                                  </div>
                                  <ChevronDown size={16} className="text-gray-300 -rotate-90 group-hover:text-pantheon-navy" />
                              </div>
                          );
                      }) : (
                          <div className="p-8 text-center">
                              <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                              <p className="text-gray-500 text-sm">現在進行中の案件はありません。</p>
                              <button onClick={() => onChangeView('PROJECTS_LIST')} className="text-xs text-blue-600 font-bold hover:underline mt-2">案件を探しに行く</button>
                          </div>
                      )}
                  </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Notifications / Messages -> What's New */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Bell size={18} className="text-n8n-orange"/> 新着情報
                  </h3>
                  <div className="space-y-3">
                      {myNotifications.length > 0 ? myNotifications.map(n => {
                          return (
                              <div 
                                  key={n.id} 
                                  className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer"
                                  onClick={() => {
                                      // Mark as read immediately on click
                                      if (onMarkNotificationAsRead) {
                                          onMarkNotificationAsRead(n.id);
                                      }

                                      // Navigate based on link content
                                      if (n.link) {
                                          if (n.link.startsWith('PROJECT:')) {
                                              const pid = n.link.split(':')[1];
                                              onChangeView('PROJECT_DETAIL', { projectId: pid });
                                          } else if (n.link === 'DM') {
                                              onChangeView('DIRECT_MESSAGES');
                                          } else if (n.link === 'INVOICES') {
                                              onChangeView('INVOICES');
                                          } else if (n.link === 'PROFILE') {
                                              onChangeView('PROFILE');
                                          }
                                      } else if (n.type === NotificationType.MESSAGE) {
                                          // Fallback for messages without link
                                          onChangeView('DIRECT_MESSAGES');
                                      }
                                  }}
                              >
                                  <div className="flex justify-between items-start mb-1">
                                      <div className="flex items-center gap-2">
                                          {!n.isRead && (
                                              <span className="w-2 h-2 rounded-full bg-n8n-orange shrink-0"></span>
                                          )}
                                          <span className={`text-xs font-bold ${n.isRead ? 'text-gray-600' : 'text-gray-800'}`}>
                                              {n.title}
                                          </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{n.createdAt}</span>
                                  </div>
                                  <p className={`text-xs ${n.isRead ? 'text-gray-500' : 'text-gray-700 font-medium'} line-clamp-2`}>{n.message}</p>
                              </div>
                          );
                      }) : (
                          <p className="text-xs text-gray-400 text-center py-4">新着情報はありません。</p>
                      )}
                  </div>
              </div>

              {/* Recommended Jobs */}
              <div className="bg-gradient-to-br from-pantheon-navy to-slate-800 p-6 rounded-xl shadow-md border border-slate-700 text-white relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                  <div className="relative z-10">
                      <h3 className="font-bold mb-2 flex items-center gap-2"><Star size={18} className="text-yellow-400 fill-current"/> おすすめ案件</h3>
                      <p className="text-xs text-blue-200 mb-4 leading-relaxed">
                          あなたのスキル「{currentUser.experienceTags?.[0]}」にマッチする案件が新着で届いています。
                      </p>
                      <button onClick={() => onChangeView('PROJECTS_LIST')} className="w-full bg-white text-pantheon-navy text-xs font-bold py-2.5 rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                          おすすめ案件を見る
                      </button>
                  </div>
                  <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>
              </div>
            </div>
        </div>
      </div>
  );
};
