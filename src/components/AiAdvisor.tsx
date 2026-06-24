import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Maximize2, 
  Minimize2,
  Sparkles,
  RefreshCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiAdvisorProps {
  dataSummary: any;
  allRecords?: any[];
  funnelRecords?: any[];
  theme: { isDark: boolean };
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ dataSummary, allRecords, funnelRecords, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "assistant", 
      content: "Hello! I am your **SalesPulse AI Advisor**. I now have access to your full database of sales and funnel records. How can I assist you with your queries today?" 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role === "user" ? "user" : "model",
            content: m.content
          })),
          dataSummary,
          allRecords,
          funnelRecords,
          modelName: selectedModel
        })
      });

      if (!response.ok) throw new Error("Failed to reach AI Advisor");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm having trouble connecting right now. Please ensure your GEMINI_API_KEY is configured in the environment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`${
              isExpanded ? "w-[80vw] h-[80vh] max-w-4xl" : "w-80 sm:w-96 h-[500px]"
            } mb-4 rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              theme.isDark 
                ? "bg-[#09090b] border-slate-800 text-slate-200" 
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between border-b ${
              theme.isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-sans">SalesPulse Advisor</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-slate-500 font-mono">Live Data Analysis</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-colors text-slate-500 hidden sm:block"
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-colors text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      m.role === "user" 
                        ? "bg-indigo-500/10 text-indigo-400" 
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : theme.isDark 
                          ? "bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none" 
                          : "bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none"
                    }`}>
                      <div className="markdown-body prose prose-invert prose-xs">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <Bot size={16} />
                    </div>
                    <div className={`p-3 rounded-2xl rounded-tl-none ${
                      theme.isDark ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200"
                    }`}>
                      <Loader2 size={16} className="animate-spin text-slate-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className={`p-4 border-t ${theme.isDark ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about sales trends, targets..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs focus:outline-none transition-all ${
                    theme.isDark 
                      ? "bg-slate-900/50 border border-slate-800 text-slate-200 focus:border-indigo-500" 
                      : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-indigo-500"
                  }`}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span>Model:</span>
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className={`bg-transparent outline-none cursor-pointer ${
                      theme.isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast/Free)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fastest)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (Reasoning)</option>
                  </select>
                </div>
                <span>Real-time BI Engine</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          isOpen ? "bg-slate-800 text-slate-200" : "bg-indigo-600 text-white"
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </motion.button>
    </div>
  );
};
