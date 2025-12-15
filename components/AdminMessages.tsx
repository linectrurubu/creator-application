
import React, { useState, useRef, useEffect } from 'react';
import { User, Message, UserStatus } from '../types';
import { Search, MessageCircle, FileText, Download, X, Paperclip, Send, User as UserIcon } from 'lucide-react';

interface AdminMessagesProps {
  currentUser: User;
  allUsers: User[]; // partners
  messages: Message[];
  onSendMessage?: (receiverId: string, content: string, file?: File) => void;
  onMarkAsRead?: (senderId: string, receiverId: string) => void;
  onViewProfile?: (userId: string, context?: any) => void;
  initialSelectedChatUserId?: string | null;
}

export const AdminMessages: React.FC<AdminMessagesProps> = ({
  currentUser,
  allUsers,
  messages,
  onSendMessage,
  onMarkAsRead,
  onViewProfile,
  initialSelectedChatUserId
}) => {
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(initialSelectedChatUserId || null);
  const [chatInput, setChatInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatTab, setChatTab] = useState<'CHAT' | 'FILES'>('CHAT');

  // jobPortalEnabled が true のユーザー、または role が PARTNER のユーザーをパートナーとして扱う
  const partners = allUsers.filter(u => u.jobPortalEnabled === true || u.role === 'PARTNER');

  const getUnreadCount = (senderId: string) => {
    return messages ? messages.filter(m => !m.projectId && m.senderId === senderId && m.receiverId === currentUser.id && !m.isRead).length : 0;
  };

  const currentChatUnreadCount = selectedChatUserId 
    ? messages?.filter(m => !m.projectId && m.senderId === selectedChatUserId && m.receiverId === currentUser.id && !m.isRead).length
    : 0;

  useEffect(() => {
    if (selectedChatUserId && onMarkAsRead && currentChatUnreadCount && currentChatUnreadCount > 0) {
        onMarkAsRead(selectedChatUserId, currentUser.id);
    }
  }, [selectedChatUserId, currentChatUnreadCount, onMarkAsRead, currentUser.id]);

  const handleAdminSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !selectedFile) || !selectedChatUserId || !onSendMessage) return;
    onSendMessage(selectedChatUserId, chatInput, selectedFile || undefined);
    setChatInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
    }
  };

  const selectedChatUser = allUsers.find(u => u.id === selectedChatUserId);
  const activeMessages = selectedChatUserId && messages 
    ? messages.filter(m => !m.projectId && (
        (m.senderId === currentUser.id && m.receiverId === selectedChatUserId) ||
        (m.senderId === selectedChatUserId && m.receiverId === currentUser.id)
      ))
    : [];
  
  const activeFiles = activeMessages.filter(m => m.attachmentUrl);

  return (
      <div className="h-[calc(100vh-200px)] grid grid-cols-12 gap-4 animate-in fade-in duration-500">
          {/* Sidebar: Chat List */}
          <div className="col-span-4 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-900">
                <h3 className="font-bold text-white mb-2">メッセージ一覧</h3>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                    <input type="text" placeholder="パートナーを検索..." className="w-full bg-slate-800 text-white pl-9 pr-3 py-2 rounded-lg text-sm border border-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {partners.map(user => {
                    const unread = getUnreadCount(user.id);
                    // Get last message snippet
                    const lastMsg = messages ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).find(m => !m.projectId && (m.senderId === user.id || m.receiverId === user.id)) : null;
                    
                    return (
                        <div 
                            key={user.id} 
                            onClick={() => { setSelectedChatUserId(user.id); if(unread > 0 && onMarkAsRead) onMarkAsRead(user.id, currentUser.id); }}
                            className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors ${selectedChatUserId === user.id ? 'bg-slate-700' : ''}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                          <UserIcon size={20} />
                                        </div>
                                        {user.status === UserStatus.ACTIVE && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-800"></div>}
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${unread > 0 ? 'text-white' : 'text-slate-300'}`}>{user.name}</p>
                                        <p className="text-xs text-slate-500 truncate w-32">{lastMsg ? lastMsg.content : '履歴なし'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500">{lastMsg ? lastMsg.createdAt : ''}</p>
                                    {unread > 0 && <span className="inline-block bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1">{unread}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
          
          {/* Main: Chat Area */}
          <div className="col-span-8 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col relative">
            {selectedChatUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center shadow-md z-10">
                      <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onViewProfile && onViewProfile(selectedChatUser.id, { tab: 'MESSAGES', selectedChatUserId })}>
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                            <UserIcon size={20} />
                          </div>
                          <div>
                              <h3 className="font-bold text-white flex items-center gap-2">
                                  {selectedChatUser.name}
                                  <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Partner</span>
                              </h3>
                              <p className="text-xs text-slate-400">{selectedChatUser.email}</p>
                          </div>
                      </div>
                      {/* Tabs */}
                      <div className="flex p-1 bg-slate-800 rounded-lg border border-slate-700">
                            <button 
                              onClick={() => setChatTab('CHAT')}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all ${chatTab === 'CHAT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                チャット
                            </button>
                            <button 
                              onClick={() => setChatTab('FILES')}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center ${chatTab === 'FILES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                ファイル一覧
                            </button>
                      </div>
                  </div>
                  
                  {chatTab === 'CHAT' ? (
                      <>
                          {/* Chat Messages */}
                          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-800/50">
                              {activeMessages.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                      <MessageCircle size={48} className="mb-2" />
                                      <p>メッセージ履歴はありません。</p>
                                  </div>
                              ) : (
                                  activeMessages.map(msg => {
                                      const isMe = msg.senderId === currentUser.id;
                                      return (
                                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                              <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 border border-slate-600 rounded-bl-none'}`}>
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
                                                                        <Download size={16} />
                                                                    </a>
                                                              </div>
                                                          ) : (
                                                                <div className={`flex items-center p-3 rounded-lg border ${isMe ? 'bg-white/10 border-white/20' : 'bg-slate-800 border-slate-600'}`}>
                                                                  <div className={`p-2 rounded-lg mr-3 ${isMe ? 'bg-white/20' : 'bg-slate-700 border border-slate-600'}`}>
                                                                      <FileText size={24} className={isMe ? 'text-white' : 'text-blue-400'} />
                                                                  </div>
                                                                  <div className="flex-1 min-w-0 mr-4">
                                                                      <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-slate-200'}`}>{msg.attachmentName}</p>
                                                                      <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>{msg.attachmentSize || 'Unknown size'}</p>
                                                                  </div>
                                                                  <a 
                                                                    href={msg.attachmentUrl} 
                                                                    download={msg.attachmentName || 'file'}
                                                                    target="_blank" 
                                                                    rel="noreferrer" 
                                                                    className={`p-2 rounded-full ${isMe ? 'hover:bg-white/20' : 'hover:bg-slate-700 text-slate-400'} transition-colors`}
                                                                    title="ダウンロード"
                                                                  >
                                                                      <Download size={18} />
                                                                  </a>
                                                              </div>
                                                          )}
                                                      </div>
                                                  )}
                                                  {msg.content && <p className="text-sm whitespace-pre-wrap px-1">{msg.content}</p>}
                                                  <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>{msg.createdAt}</p>
                                              </div>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                          
                          {/* Chat Input */}
                          <div className="p-4 bg-slate-900 border-t border-slate-700">
                              {selectedFile && (
                                  <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-600 mb-2">
                                      <div className="flex items-center text-xs text-slate-300">
                                          <FileText size={14} className="mr-2" /> {selectedFile.name}
                                      </div>
                                      <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X size={14} className="text-slate-400 hover:text-white" /></button>
                                  </div>
                              )}
                              <form onSubmit={handleAdminSend} className="flex items-center space-x-2">
                                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-full hover:bg-slate-800 ${selectedFile ? 'text-blue-400' : 'text-slate-400'}`}><Paperclip size={20} /></button>
                                  <input 
                                      type="text" 
                                      value={chatInput} 
                                      onChange={e => setChatInput(e.target.value)}
                                      placeholder="メッセージを入力..." 
                                      className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-full border border-slate-600 focus:outline-none focus:border-blue-500"
                                  />
                                  <button type="submit" disabled={!chatInput.trim() && !selectedFile} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Send size={18} /></button>
                              </form>
                          </div>
                      </>
                  ) : (
                      /* Files Tab Content */
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-800/50">
                          {activeFiles.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                  <FileText size={48} className="mb-2" />
                                  <p>共有されたファイルはありません</p>
                              </div>
                          ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {activeFiles.map(file => (
                                      <div key={file.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                          <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
                                              {file.attachmentType === 'image' ? (
                                                  <img src={file.attachmentUrl} alt={file.attachmentName} className="w-full h-full object-cover" />
                                              ) : (
                                                  <FileText size={40} className="text-slate-500" />
                                              )}
                                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <a 
                                                    href={file.attachmentUrl} 
                                                    download={file.attachmentName || 'file'}
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="p-2 bg-white rounded-full text-gray-800 hover:bg-blue-600 hover:text-white transition-colors"
                                                    title="ダウンロード"
                                                  >
                                                      <Download size={20} />
                                                  </a>
                                              </div>
                                          </div>
                                          <div className="p-2">
                                              <p className="text-xs font-bold text-slate-200 truncate" title={file.attachmentName}>{file.attachmentName}</p>
                                              <div className="flex justify-between items-center mt-1">
                                                  <p className="text-[10px] text-slate-500">{file.attachmentSize || 'Unknown'}</p>
                                                  <p className="text-[10px] text-slate-500">{file.createdAt}</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4"><MessageCircle size={32} /></div>
                    <p className="font-bold">メッセージを選択してください</p>
                    <p className="text-sm">左側のリストからパートナーを選択してチャットを開始します。</p>
                </div>
            )}
          </div>
      </div>
  );
};
