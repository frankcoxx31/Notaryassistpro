import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Users } from 'lucide-react';
import { Client } from '../types';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  onSave: (c: Client) => void;
  userId: string;
}

const NewClientModal = ({ isOpen, onClose, client, onSave, userId }: NewClientModalProps) => {
  const [formData, setFormData] = useState<Partial<Client>>({});

  useEffect(() => {
    if (client) {
      setFormData(client);
    } else {
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        userId: userId,
        name: '',
        company: '',
        email: '',
        phone: '',
        address: ''
      });
    }
  }, [client, isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.name && formData.company && formData.email && formData.phone && formData.address) {
      onSave(formData as Client);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{client ? 'Edit Client' : 'New Client'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Name:</label>
            <input 
              type="text" 
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Company:</label>
            <input 
              type="text" 
              value={formData.company || ''}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Email:</label>
            <input 
              type="email" 
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Phone:</label>
            <input 
              type="tel" 
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Address:</label>
            <textarea 
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Save Client
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default NewClientModal;
