import React, { useState, useMemo } from 'react';
import { User, Project, Invoice, InvoiceStatus, UserRole, UserStatus, ProjectStatus, Application, ApplicationStatus, Message } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie,
  ComposedChart, Line, Legend
} from 'recharts';
import { 
  DollarSign, Users, Briefcase, TrendingUp, ArrowUpRight, BarChart2, Layers, Trophy, Medal
} from 'lucide-react';

interface AdminOverviewProps {
  currentUser: User;
  invoices: Invoice[];
  allUsers: User[];
  projects: Project[];
  messages?: Message[];
  applications?: Application[];
  onChangeView: (view: any, params?: any) => void;
  onMarkProjectAsRead?: (projectId: string) => void;
  onViewProfile?: (userId: string, context?: any) => void;
}

// Helper functions (duplicated for isolation)
const formatYen = (val: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(val);
};

const statusMap: Record<string, string> = {
  DRAFT: '下書き',
  RECRUITING: '募集中',
  IN_PROGRESS: '進行中',
  COMPLETED: '完了',
  CANCELLED: 'キャンセル'
};

const categoryMap: Record<string, string> = {
  LECTURER: '講師',
  DX_CONSULTING: 'DXコンサル',
  DEVELOPMENT: '開発'
};

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  currentUser,
  invoices,
  allUsers,
  projects,
  messages,
  applications,
  onChangeView,
  onMarkProjectAsRead,
  onViewProfile
}) => {
  // Chart State
  const [chartTimeRange, setChartTimeRange] = useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [chartMetric, setChartMetric] = useState<'REVENUE' | 'COUNT' | 'ALL'>('REVENUE');
  
  // Ranking Time Range State
  const [rankingTimeRange, setRankingTimeRange] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL'>('ALL');

  // KPI Calculations
  const totalRevenue = invoices.filter(i => i.status === InvoiceStatus.PAID).reduce((acc, curr) => acc + curr.amount, 0);
  // jobPortalEnabled が true のユーザー、または role が PARTNER のユーザーをパートナーとして扱う
  const allPartners = allUsers.filter(u => u.jobPortalEnabled === true || u.role === UserRole.PARTNER);
  const activePartners = allPartners.filter(u => u.status === UserStatus.ACTIVE).length;
  const pendingPartners = allPartners.filter(u => u.status === UserStatus.PENDING).length;
  const activeProjects = projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length;
  const totalProjects = projects.length;

  const partners = allPartners;

  // Admin Chart Data Generation
  const adminChartData = useMemo(() => {
    const data: {name: string, revenue: number, count: number}[] = [];
    const now = new Date();
    const paidInvoices = invoices.filter(i => i.status === InvoiceStatus.PAID);
    
    if (chartTimeRange === 'DAILY') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const relevant = paidInvoices.filter(inv => inv.issueDate === key);
            data.push({
                name: label,
                revenue: relevant.reduce((acc, c) => acc + c.amount, 0),
                count: relevant.length
            });
        }
    } else if (chartTimeRange === 'MONTHLY') {
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${d.getMonth() + 1}月`;
            
            const relevant = paidInvoices.filter(inv => inv.issueDate.startsWith(key));
            data.push({ 
                name: label, 
                revenue: relevant.reduce((acc, c) => acc + c.amount, 0),
                count: relevant.length
            });
        }
    } else {
        // Yearly
         for (let i = 2; i >= 0; i--) {
            const year = now.getFullYear() - i;
            const label = `${year}年`;
            const relevant = paidInvoices.filter(inv => inv.issueDate.startsWith(`${year}`));
            data.push({
               name: label,
               revenue: relevant.reduce((acc, c) => acc + c.amount, 0),
               count: relevant.length
            });
         }
    }
    return data;
  }, [invoices, chartTimeRange]);

  const currentChartColor = chartMetric === 'REVENUE' ? '#3B82F6' : '#10B981'; 

  const categoryData = [
    { name: 'DXコンサル', value: 45 },
    { name: '開発', value: 30 },
    { name: '講師', value: 25 },
  ];
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

  // Ranking Logic
  const partnerStats = useMemo(() => {
    return partners.filter(u => u.status !== UserStatus.PENDING).map(user => {
        // --- Ranking Time Range Filter ---
        const now = new Date();
        let startDate = new Date(0); // Default ALL
        
        if (rankingTimeRange === 'WEEKLY') {
            startDate = new Date(now.setDate(now.getDate() - 7));
        } else if (rankingTimeRange === 'MONTHLY') {
             startDate = new Date(now.setMonth(now.getMonth() - 1));
        } else if (rankingTimeRange === 'YEARLY') {
             startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        }
        
        // Revenue (Base)
        const userInvoices = invoices.filter(i => i.userId === user.id && i.status === InvoiceStatus.PAID);
        const filteredInvoices = userInvoices.filter(i => new Date(i.issueDate) >= startDate);
        const revenue = filteredInvoices.reduce((acc, curr) => acc + curr.amount, 0);

        // Order Count (Projects Assigned within period)
        const userProjects = projects.filter(p => p.assignedToUserId === user.id);
        const filteredProjects = userProjects.filter(p => new Date(p.createdAt) >= startDate);
        const orderCount = filteredProjects.length;

        return { ...user, revenue, orderCount };
    });
  }, [partners, invoices, projects, rankingTimeRange]);

  // Ranking Data for Overview
  const topRevenuePartners = useMemo(() => {
    return [...partnerStats].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [partnerStats]);

  const topOrderPartners = useMemo(() => {
    return [...partnerStats].sort((a, b) => b.orderCount - a.orderCount).slice(0, 5);
  }, [partnerStats]);

  const getRankStyle = (index: number) => {
    switch(index) {
        case 0: return { color: 'text-yellow-400', icon: Trophy };
        case 1: return { color: 'text-slate-300', icon: Medal };
        case 2: return { color: 'text-amber-600', icon: Medal };
        default: return { color: 'text-slate-500', icon: null };
    }
  };

  const RankingTimeSelector = () => (
      <div className="flex gap-1 bg-slate-700/50 p-1 rounded-lg">
          {(['WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'] as const).map(range => (
              <button
                  key={range}
                  onClick={() => setRankingTimeRange(range)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                      rankingTimeRange === range 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
              >
                  {range === 'WEEKLY' ? '週次' : range === 'MONTHLY' ? '月次' : range === 'YEARLY' ? '年次' : '累計'}
              </button>
          ))}
      </div>
  );

  return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* KPI Cards */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign size={64} className="text-emerald-400" />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">総流通額 (GMV)</p>
            <h3 className="text-2xl font-bold text-white mt-1 tracking-tight truncate" title={formatYen(totalRevenue)}>{formatYen(totalRevenue)}</h3>
            <div className="flex items-center mt-2 text-emerald-400 text-sm font-medium">
              <ArrowUpRight size={16} className="mr-1" />
              <span>+12.5%</span>
              <span className="text-slate-500 ml-2 text-xs">先月比</span>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={64} className="text-blue-400" />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">稼働パートナー数</p>
            <h3 className="text-2xl font-bold text-white mt-1 tracking-tight truncate">{activePartners} <span className="text-sm font-normal text-slate-500">名</span></h3>
            <div className="flex items-center mt-2 text-blue-400 text-sm font-medium">
              <span className="bg-blue-900/50 px-2 py-0.5 rounded text-xs border border-blue-800">承認待ち: {pendingPartners}名</span>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Briefcase size={64} className="text-indigo-400" />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">進行中案件</p>
            <h3 className="text-2xl font-bold text-white mt-1 tracking-tight truncate">{activeProjects} <span className="text-sm font-normal text-slate-500">件</span></h3>
            <div className="flex items-center mt-2 text-slate-400 text-sm">
              <span>全案件: {totalProjects}件</span>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={64} className="text-orange-400" />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">コンバージョン率</p>
            <h3 className="text-2xl font-bold text-white mt-1 tracking-tight truncate">100.0<span className="text-sm font-normal text-slate-500">%</span></h3>
            <div className="flex items-center mt-2 text-orange-400 text-sm font-medium">
              <ArrowUpRight size={16} className="mr-1" />
              <span>安定推移</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div className="flex items-center gap-4">
                      <h3 className="font-bold text-slate-200 flex items-center gap-2">
                          <TrendingUp size={18} className={chartMetric === 'REVENUE' ? "text-blue-500" : chartMetric === 'COUNT' ? "text-emerald-500" : "text-purple-400"}/> 
                          {chartMetric === 'REVENUE' ? '売上推移' : chartMetric === 'COUNT' ? '受注数推移' : '売上・受注分析 (一括)'}
                      </h3>
                      <div className="bg-slate-700 p-1 rounded-lg flex text-xs font-medium">
                          <button onClick={() => setChartMetric('REVENUE')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'REVENUE' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><DollarSign size={12} /> 売上</button>
                          <button onClick={() => setChartMetric('COUNT')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'COUNT' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><BarChart2 size={12} /> 受注数</button>
                          <button onClick={() => setChartMetric('ALL')} className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${chartMetric === 'ALL' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Layers size={12} /> 一括表示</button>
                      </div>
                  </div>
                  <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
                      <button onClick={() => setChartTimeRange('DAILY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'DAILY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>日次</button>
                      <button onClick={() => setChartTimeRange('MONTHLY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'MONTHLY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>月次</button>
                      <button onClick={() => setChartTimeRange('YEARLY')} className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${chartTimeRange === 'YEARLY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>年次</button>
                  </div>
              </div>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      {chartMetric === 'ALL' ? (
                          <ComposedChart data={adminChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <defs>
                                  <linearGradient id="colorRevMixed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <YAxis yAxisId="left" width={90} orientation="left" axisLine={false} tickLine={false} tick={{fill: '#3B82F6', fontSize: 12, fontWeight: 500}} tickFormatter={(val) => `¥${val.toLocaleString()}`} />
                              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#10B981', fontSize: 12, fontWeight: 500}} tickFormatter={(val) => `${val}件`}/>
                              <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} 
                                  formatter={(value: any, name: any) => { 
                                      if (name === '売上') return [formatYen(Number(value)), name]; 
                                      if (name === '受注数') return [`${value} 件`, name]; 
                                      return [value, name]; 
                                  }} 
                              />
                              <Legend verticalAlign="top" height={36} iconType="circle" />
                              <Area yAxisId="left" type="monotone" dataKey="revenue" name="売上" stroke="#3B82F6" fillOpacity={1} fill="url(#colorRevMixed)" dot={{ r: 4, fill: '#1e293b', stroke: '#3B82F6', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                              <Line yAxisId="right" type="monotone" dataKey="count" name="受注数" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', stroke: '#10B981', strokeWidth: 2 }} />
                          </ComposedChart>
                      ) : (
                          <AreaChart data={adminChartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                              <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={currentChartColor} stopOpacity={0.3}/><stop offset="95%" stopColor={currentChartColor} stopOpacity={0}/></linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <YAxis width={90} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => chartMetric === 'REVENUE' ? `¥${val.toLocaleString()}` : val} />
                              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} formatter={(value: number) => [chartMetric === 'REVENUE' ? formatYen(value) : `${value} 件`, chartMetric === 'REVENUE' ? '売上' : '受注数']} cursor={{stroke: '#475569'}} />
                              <Area type="monotone" dataKey={chartMetric === 'REVENUE' ? 'revenue' : 'count'} stroke={currentChartColor} strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" animationDuration={800} dot={{ r: 4, fill: '#1e293b', stroke: currentChartColor, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          </AreaChart>
                      )}
                  </ResponsiveContainer>
              </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <h3 className="font-bold text-slate-200 mb-6 flex items-center gap-2">
              <Briefcase size={18} className="text-orange-500"/> カテゴリー別構成比
            </h3>
            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">{totalProjects}</span>
                  <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                    <span className="text-slate-300">{entry.name}</span>
                  </div>
                  <span className="text-slate-400 font-mono">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2"><DollarSign size={18} className="text-emerald-500"/> 売上ランキング (Top 5)</h3>
                  <RankingTimeSelector />
              </div>
              <div className="space-y-4">
                  {topRevenuePartners.map((user, index) => {
                      const rankStyle = getRankStyle(index);
                      const RankIcon = rankStyle.icon;
                      return (
                          <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-700">
                              <div className="flex items-center gap-4">
                                  <div className={`w-6 flex justify-center font-bold ${rankStyle.color}`}>{RankIcon ? <RankIcon size={20} /> : <span className="text-sm">#{index + 1}</span>}</div>
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile && onViewProfile(user.id, { tab: 'OVERVIEW' })}>
                                      <img src={user.avatarUrl} className="w-10 h-10 rounded-full border border-slate-600 object-cover" alt="" />
                                      <div><p className="font-bold text-white text-sm">{user.name}</p><p className="text-[10px] text-slate-400">{user.email}</p></div>
                                  </div>
                              </div>
                              <div className="text-right"><p className="font-bold text-emerald-400 font-mono">{formatYen(user.revenue)}</p></div>
                          </div>
                      );
                  })}
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                  {/* Changed from Active Project Ranking to Order Count Ranking */}
                  <h3 className="font-bold text-slate-200 flex items-center gap-2"><Briefcase size={18} className="text-blue-500"/> 受注数ランキング (Top 5)</h3>
                  <RankingTimeSelector />
              </div>
              <div className="space-y-4">
                  {topOrderPartners.map((user, index) => {
                      const rankStyle = getRankStyle(index);
                      const RankIcon = rankStyle.icon;
                      return (
                          <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-700">
                              <div className="flex items-center gap-4">
                                  <div className={`w-6 flex justify-center font-bold ${rankStyle.color}`}>{RankIcon ? <RankIcon size={20} /> : <span className="text-sm">#{index + 1}</span>}</div>
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile && onViewProfile(user.id, { tab: 'OVERVIEW' })}>
                                      <img src={user.avatarUrl} className="w-10 h-10 rounded-full border border-slate-600 object-cover" alt="" />
                                      <div><p className="font-bold text-white text-sm">{user.name}</p><p className="text-[10px] text-slate-400">{user.email}</p></div>
                                  </div>
                              </div>
                              <div className="text-right"><p className="font-bold text-blue-400 text-lg">{user.orderCount} <span className="text-xs text-slate-500 font-normal">件</span></p></div>
                          </div>
                      );
                  })}
              </div>
            </div>
        </div>
        
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-200 flex items-center gap-2"><Briefcase size={18} className="text-blue-500"/> 最新案件リスト</h3>
              <button onClick={() => onChangeView('PROJECTS')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">詳細管理 &rarr;</button>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900/50 text-xs uppercase font-medium"><tr><th className="p-3">案件名</th><th className="p-3">カテゴリー</th><th className="p-3">予算</th><th className="p-3 text-right">ステータス</th></tr></thead>
                <tbody className="divide-y divide-slate-700">
                  {projects.slice(0, 5).map(p => {
                    const unreadMsgs = messages ? messages.filter(m => m.projectId === p.id && !m.isRead && m.senderId !== currentUser.id).length : 0;
                    const newApps = applications ? applications.filter(a => a.projectId === p.id && a.status === ApplicationStatus.APPLIED && !a.isRead).length : 0;
                    const hasAction = unreadMsgs > 0 || newApps > 0;
                    
                    return (
                    <tr key={p.id} className="hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={() => {
                      if(onMarkProjectAsRead) onMarkProjectAsRead(p.id);
                      onChangeView('PROJECT_DETAIL', { projectId: p.id });
                    }}>
                      <td className="p-3 text-slate-200 font-medium truncate max-w-[200px] flex items-center gap-2">
                        {p.title}
                        {hasAction && (
                          <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              {unreadMsgs + newApps}
                          </span>
                        )}
                      </td>
                      <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{categoryMap[p.category] || p.category}</span></td>
                      <td className="p-3 font-mono">¥{p.budget.toLocaleString()}</td>
                      <td className="p-3 text-right"><span className={`text-xs px-2 py-0.5 rounded border ${p.status === ProjectStatus.RECRUITING ? 'bg-blue-900/30 border-blue-800 text-blue-400' : p.status === ProjectStatus.IN_PROGRESS ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{statusMap[p.status]}</span></td>
                    </tr>
                  )})}
                </tbody>
              </table>
          </div>
        </div>
      </div>
  );
};