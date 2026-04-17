'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Send, RefreshCw, Trash2, Bot,
  User, Shield, Zap, AlertTriangle, Brain
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const QUICK_PROMPTS = [
  { label: "Analyse les menaces", prompt: "Analyse les menaces actuelles sur le réseau et donne-moi un résumé exécutif", icon: AlertTriangle },
  { label: "Top risques", prompt: "Quels sont les 3 principaux risques de sécurité en ce moment ?", icon: Shield },
  { label: "Recommandations", prompt: "Quelles actions immédiates recommandes-tu pour sécuriser le réseau ?", icon: Zap },
  { label: "MITRE Analysis", prompt: "Analyse les techniques MITRE ATT&CK détectées et explique la kill chain probable", icon: Brain },
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  // Formatage markdown simple
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-foreground font-bold text-sm mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-foreground font-bold mt-3 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-foreground">{line.slice(2, -2)}</p>;
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 my-0.5">
              <span className="text-primary mt-1">•</span>
              <span dangerouslySetInnerHTML={{
                __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-primary">$1</code>')
              }} />
            </div>
          );
        }
        if (line.match(/^\d+\./)) {
          return (
            <div key={i} className="flex gap-2 my-0.5">
              <span className="text-primary shrink-0">{line.match(/^\d+/)?.[0]}.</span>
              <span dangerouslySetInnerHTML={{
                __html: line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-primary">$1</code>')
              }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return (
          <p key={i} className="my-0.5" dangerouslySetInnerHTML={{
            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-primary">$1</code>')
          }} />
        );
      });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${
        isUser ? 'bg-primary' : 'bg-muted'
      }`}>
        {isUser
          ? <User className="h-4 w-4 text-foreground" />
          : <Bot className="h-4 w-4 text-primary" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-primary/30 text-foreground border border-cyan-700/50'
          : 'bg-muted text-slate-200 border border-border'
      }`}>
        {isUser
          ? <p>{msg.content}</p>
          : <div className="leading-relaxed">{formatContent(msg.content)}</div>
        }
        {msg.timestamp && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            {new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ChatbotPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/chatbot/history');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.history || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    setInput('');
    setSending(true);

    // Ajoute le message utilisateur immédiatement
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await apiClient('/chatbot/message', {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = async () => {
    await apiClient('/chatbot/clear', { method: 'POST' });
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700">
            <Bot className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">NetGuard SOC Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Powered by Groq · llama-3.3-70b</span>
            </div>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 mb-4">
              <Bot className="h-8 w-8 text-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">NetGuard SOC Assistant</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
              Je suis ton assistant SOC alimenté par IA. Je peux analyser les menaces, 
              expliquer les incidents, mapper les techniques MITRE et recommander des actions.
            </p>

            {/* Quick prompts */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-left text-sm text-foreground/80 hover:border-cyan-500/50 hover:bg-muted transition-all"
                >
                  <qp.icon className="h-5 w-5 text-primary shrink-0" />
                  <span>{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl bg-muted border border-border px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts bar (si conversation active) */}
      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-6 py-2 border-t border-border/50">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => sendMessage(qp.prompt)}
              disabled={sending}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            >
              <qp.icon className="h-3 w-3" />
              {qp.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about threats, incidents, MITRE techniques... (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none max-h-32"
            style={{ minHeight: '48px' }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {sending
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Shift+Enter for new line • Enter to send
        </p>
      </div>
    </div>
  );
}