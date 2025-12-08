import React, { useEffect } from 'react';
import { NotificationType } from '../types';
import { CheckCircle, AlertTriangle, XCircle, Info, MessageCircle, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, type, title, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000); // Auto dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case NotificationType.SUCCESS: return <CheckCircle size={20} className="text-emerald-500" />;
      case NotificationType.WARNING: return <AlertTriangle size={20} className="text-yellow-500" />;
      case NotificationType.ERROR: return <XCircle size={20} className="text-red-500" />;
      case NotificationType.MESSAGE: return <MessageCircle size={20} className="text-purple-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case NotificationType.SUCCESS: return 'bg-white border-l-4 border-emerald-500';
      case NotificationType.WARNING: return 'bg-white border-l-4 border-yellow-500';
      case NotificationType.ERROR: return 'bg-white border-l-4 border-red-500';
      case NotificationType.MESSAGE: return 'bg-white border-l-4 border-purple-500';
      default: return 'bg-white border-l-4 border-blue-500';
    }
  };

  return (
    <div className={`w-80 md:w-96 p-4 rounded-lg shadow-xl border border-gray-100 flex items-start gap-3 transform transition-all duration-300 animate-in slide-in-from-right fade-in hover:translate-x-[-4px] ${getStyles()}`}>
      <div className="shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 text-sm leading-tight mb-1">{title}</h4>
        <p className="text-xs text-gray-600 leading-relaxed break-words">{message}</p>
      </div>
      <button 
        onClick={() => onClose(id)}
        className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};
