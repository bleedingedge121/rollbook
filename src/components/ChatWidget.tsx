'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  AlertCircle,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your Roll Book attendance advisor. Ask me anything about your current percentages, safe-to-skip buffers, recovery streaks, or upcoming timetable schedule.",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || isLoading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'No response received.' },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not communicate with the server. Please verify your connection.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const quickPrompts = [
    'Am I below 75% in any subject?',
    'What is my upcoming schedule?',
    'Any unlogged past classes?',
    'How many classes can I safely skip?',
  ]

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-6 sm:right-6 z-40">
      {/* Floating Trigger Button */}
      <motion.button
        whileHover={prefersReducedMotion ? {} : { scale: 1.08, rotate: 2 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-teal-600 text-white border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)] flex items-center justify-center transition-colors hover:bg-teal-500 focus:outline-none"
        title="Open AI Attendance Advisor"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-pink-400 border border-white animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Expandable Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }
            }
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[75vh] sm:max-h-[580px] h-[480px] sm:h-[520px] bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl shadow-[6px_6px_0px_var(--shadow-color)] flex flex-col overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-teal-600/15 via-pink-500/10 to-amber-500/10 border-b-2 border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-sm text-[var(--foreground)] tracking-tight">
                    Attendance Advisor
                  </h3>
                  <p className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    Attendance Intelligence
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setMessages([
                    {
                      role: 'assistant',
                      content:
                        "Chat reset! What attendance numbers or timetable details would you like to explore?",
                    },
                  ])
                }
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-dot-grid">
              {messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-2 ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1 border border-[var(--border)]">
                      AI
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed font-sans ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] rounded-tr-sm'
                        : 'bg-[var(--card)] text-[var(--card-foreground)] border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] rounded-tl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 border border-[var(--border)]">
                    AI
                  </div>
                  <div className="bg-[var(--card)] border-2 border-[var(--border)] p-3 rounded-2xl rounded-tl-sm shadow-[3px_3px_0px_var(--shadow-color)] flex items-center gap-1.5">
                    <motion.span
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="w-1.5 h-1.5 rounded-full bg-teal-500"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      className="w-1.5 h-1.5 rounded-full bg-pink-500"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Pills */}
            <div className="p-2 border-t border-[var(--border)] bg-[var(--card)] flex items-center gap-1.5 overflow-x-auto">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-[var(--muted)] hover:bg-teal-600/15 hover:text-teal-600 border border-[var(--border)] text-[10px] font-semibold text-[var(--foreground)] whitespace-nowrap transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="p-3 bg-[var(--card)] border-t-2 border-[var(--border)] flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your attendance..."
                disabled={isLoading}
                className="flex-1 bg-[var(--background)] border-2 border-[var(--border)] rounded-full px-3.5 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-teal-500 transition-colors font-sans"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-full bg-teal-600 hover:bg-teal-500 text-white border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-40 transition-transform active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
