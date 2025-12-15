
import React, { useState, useRef, useEffect } from 'react';
import { User, Message } from '../types';
import { MessageCircle, Paperclip, Send, File as FileIcon, User as UserIcon, X, Image as ImageIcon, Download, FileText } from 'lucide-react';

interface DirectMessagesProps {
  currentUser: User;
  messages: Message[];
  onSendMessage: (receiverId: string, content: string, file?: File) => void;
  users: User[]; // to find admin
  onMarkAsRead?: (senderId: string, receiverId: string) => void;
}

export const DirectMessages: React.FC<DirectMessagesProps> = ({
  currentUser,
  messages,
  onSendMessage,
  users,
  onMarkAsRead
}) => {
  const [activeTab, setActiveTab] = useState<'CHAT' | 'FILES'>('CHAT');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Find Admin to chat with (In a real app, maybe list multiple admins)
  // UserRole.ADMIN = 'admin' (lowercase)
  const adminUser = users.find(u => u.role === 'admin' || u.role === 'ADMIN');
  
  // Filter messages between current user and admin (DM only, no project messages)
  const dms = messages.filter(m => 
    !m.projectId && 
    (
      (m.senderId === currentUser.id && m.receiverId === adminUser?.id) ||
      (m.senderId === adminUser?.id && m.receiverId === currentUser.id)
    )
  );

  // Files only
  const sharedFiles = dms.filter(m => m.attachmentUrl);

  // Calculate unread count specifically for this chat logic to prevent infinite loops
  const unreadFromAdminCount = adminUser ? messages.filter(m => 
    !m.projectId && 
    m.senderId === adminUser.id && 
    m.receiverId === currentUser.id && 
    !m.isRead
  ).length : 0;

  // Mark messages from Admin as read when viewing
  useEffect(() => {
    if (adminUser && onMarkAsRead && unreadFromAdminCount > 0) {
        onMarkAsRead(adminUser.id, currentUser.id);
    }
  }, [adminUser, unreadFromAdminCount, onMarkAsRead, currentUser.id]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !adminUser) return;

    onSendMessage(adminUser.id, inputText, selectedFile || undefined);
    
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  if (!adminUser) {
    return <div className="p-8 text-center text-gray-500">管理者が見つかりません。</div>;
  }

  // --- Render Components ---

  const MessageBubble: React.FC<{ msg: Message, isMe: boolean }> = ({ msg, isMe }) => (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
            isMe 
            ? 'bg-pantheon-navy text-white rounded-br-none' 
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
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
                                <Download size={16} />
                            </a>
                        </div>
                    ) : (
                         <div className={`flex items-center p-3 rounded-lg border ${isMe ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'}`}>
                            <div className={`p-2 rounded-lg mr-3 ${isMe ? 'bg-white/20' : 'bg-white border border-gray-100'}`}>
                                <FileText size={24} className={isMe ? 'text-white' : 'text-pantheon-navy'} />
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
            
            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                {msg.createdAt}
            </p>
        </div>
        {isMe && msg.isRead && (
            <div className="flex items-end pb-1 ml-1">
                <span className="text-[10px] text-gray-400">既読</span>
            </div>
        )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="p-2 bg-pantheon-navy text-white rounded-full">
                <UserIcon size={20} />
            </div>
            <div>
                <h2 className="font-bold text-gray-800">運営事務局 ({adminUser.name})</h2>
                <p className="text-xs text-gray-500">個別のお問い合わせ・連絡はこちら</p>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
             <button 
               onClick={() => setActiveTab('CHAT')} 
               className={`flex-1 md:flex-none flex items-center justify-center px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'CHAT' ? 'bg-pantheon-navy text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
             >
                 <MessageCircle size={16} className="mr-2" /> チャット
             </button>
             <button 
               onClick={() => setActiveTab('FILES')} 
               className={`flex-1 md:flex-none flex items-center justify-center px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'FILES' ? 'bg-pantheon-navy text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
             >
                 <FileText size={16} className="mr-2" /> ファイル一覧
             </button>
        </div>
      </div>

      {activeTab === 'CHAT' ? (
          <>
            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {dms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <MessageCircle size={48} className="mb-2 opacity-20" />
                        <p>メッセージ履歴はありません</p>
                        <p className="text-xs">ご質問やご連絡事項があればこちらからどうぞ</p>
                    </div>
                ) : (
                    dms.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === currentUser.id} />
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-100">
                {/* File Preview */}
                {selectedFile && (
                    <div className="px-4 pt-3 pb-1">
                        <div className="flex items-center justify-between bg-gray-100 p-2 rounded-lg border border-gray-200">
                            <div className="flex items-center truncate">
                                <div className="p-1.5 bg-white rounded-md border border-gray-200 mr-2">
                                    <FileIcon size={14} className="text-pantheon-navy" />
                                </div>
                                <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{selectedFile.name}</span>
                                <span className="text-[10px] text-gray-400 ml-2">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button 
                                type="button" 
                                onClick={clearFile}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSend} className="p-4 pt-2">
                    <div className="flex items-center space-x-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileChange}
                        />
                        <button 
                            type="button" 
                            onClick={handleFileClick}
                            className={`p-2 rounded-full transition-colors ${selectedFile ? 'bg-pantheon-navy text-white' : 'text-gray-400 hover:text-pantheon-navy hover:bg-gray-100'}`}
                            title="ファイルを添付"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="メッセージを入力..."
                            className="flex-1 bg-gray-100 text-gray-900 border-transparent focus:bg-white focus:border-pantheon-navy focus:ring-0 rounded-full px-4 py-2 transition-all outline-none"
                        />
                        <button 
                            type="submit" 
                            className="p-2 bg-pantheon-navy text-white rounded-full hover:bg-pantheon-light transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!inputText.trim() && !selectedFile}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            </div>
          </>
      ) : (
          /* Files Tab Content */
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              {sharedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <FileText size={48} className="mb-2 opacity-20" />
                      <p>共有されたファイルはありません</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {sharedFiles.map(file => (
                          <div key={file.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                              <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
                                  {file.attachmentType === 'image' ? (
                                      <img src={file.attachmentUrl} alt={file.attachmentName} className="w-full h-full object-cover" />
                                  ) : (
                                      <FileText size={40} className="text-gray-300" />
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
                                          <Download size={20} />
                                      </a>
                                  </div>
                              </div>
                              <div className="p-3">
                                  <p className="text-sm font-bold text-gray-800 truncate" title={file.attachmentName}>{file.attachmentName}</p>
                                  <div className="flex justify-between items-center mt-2">
                                      <p className="text-xs text-gray-500">{file.attachmentSize || 'Unknown'}</p>
                                      <p className="text-[10px] text-gray-400">{file.createdAt}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
