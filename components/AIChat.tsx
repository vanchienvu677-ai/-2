
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MaterialItem } from '../types';
import { chatWithContext } from '../services/gemini';
import { MessageSquare, Send, X, Bot, Camera } from 'lucide-react';

interface AIChatProps {
  materials: MaterialItem[];
}

export const AIChat: React.FC<AIChatProps> = ({ materials }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Prepare context from materials
      const contextSummary = materials.length 
        ? JSON.stringify(materials.map(m => ({ item: m.name, mat: m.material, qty: m.quantity })))
        : "尚未分析图纸。";

      const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      // In a real app, we would grab the canvas/screenshot here if requested
      const responseText = await chatWithContext(history, userMsg.text, undefined, contextSummary);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "连接估算大脑时出错，请重试。",
        isError: true,
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center z-50 active:scale-95"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={() => setIsOpen(false)}
      />
      
      <div className={`
        fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200
        transition-all duration-300 ease-in-out
        bottom-0 left-0 right-0 w-full h-[85vh] rounded-t-2xl
        md:bottom-6 md:right-6 md:w-96 md:h-[500px] md:rounded-xl
      `}>
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">工程助手</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 mt-10 text-sm px-4">
              <p>您可以询问关于图纸、材料属性或标准规范（如 GB/T 150）的问题。</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-slate-200 rounded-lg p-3 rounded-bl-none animate-pulse w-12 h-8"></div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex gap-2 flex-shrink-0 pb-safe md:pb-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入问题..."
            className="flex-grow border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};
