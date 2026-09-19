'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  RotateCcw,
  Image as ImageIcon,
  Plus,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
  images?: Array<{
    mimeType: string
    data: string
    url?: string
  }>
}

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your Roll Book attendance advisor. Ask me anything about your current percentages, safe-to-skip buffers, recovery streaks, or upcoming timetable schedule. You can also paste your SLCM table or upload multiple screenshots of it to sync your records instantly!",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<
    Array<{
      mimeType: string
      data: string
      url: string
    }>
  >([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen, selectedImages])

  const processSingleImage = (file: File): Promise<void> => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new window.Image()
        img.onload = () => {
          const MAX_DIM = 1600
          let { width, height } = img
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width)
              width = MAX_DIM
            } else {
              width = Math.round((width * MAX_DIM) / height)
              height = MAX_DIM
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
            const [, base64Data] = dataUrl.split(';base64,')
            setSelectedImages((prev) => [
              ...prev,
              {
                mimeType: 'image/jpeg',
                data: base64Data,
                url: dataUrl,
              },
            ])
          } else {
            const rawUrl = (e.target?.result as string) || ''
            const [, base64Data] = rawUrl.split(';base64,')
            setSelectedImages((prev) => [
              ...prev,
              {
                mimeType: file.type || 'image/png',
                data: base64Data,
                url: rawUrl,
              },
            ])
          }
          resolve()
        }
        img.onerror = () => resolve()
        img.src = e.target?.result as string
      }
      reader.onerror = () => resolve()
      reader.readAsDataURL(file)
    })
  }

  const processImageFiles = async (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith('image/'))
    for (const f of valid) {
      await processSingleImage(f)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      processImageFiles(files)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    const imgsToSend = selectedImages
    if ((!text && imgsToSend.length === 0) || isLoading) return

    const userMessageContent =
      text ||
      (imgsToSend.length > 1
        ? `Please extract and synchronize all attendance figures from these ${imgsToSend.length} SLCM table screenshots.`
        : 'Please extract and synchronize my attendance figures from this SLCM table screenshot.')

    const newMsg: Message = {
      role: 'user',
      content: userMessageContent,
      ...(imgsToSend.length > 0
        ? {
            images: imgsToSend.map((img) => ({
              mimeType: img.mimeType,
              data: img.data,
              url: img.url,
            })),
          }
        : {}),
    }

    const newMessages: Message[] = [...messages, newMsg]
    setMessages(newMessages)
    setInput('')
    setSelectedImages([])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.images && m.images.length > 0
              ? {
                  images: m.images.map((img) => ({
                    mimeType: img.mimeType,
                    data: img.data,
                  })),
                }
              : {}),
          })),
        }),
      })

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'No response received.' },
      ])

      if (data?.synced) {
        window.dispatchEvent(
          new CustomEvent('rollbook:synced', {
            detail: { count: data.syncedCount },
          })
        )
      }
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
    '📸 Sync from Screenshots',
    'Am I below 75% in any subject?',
    'How many classes can I safely skip?',
    'What is my upcoming schedule?',
  ]

  const handleQuickPromptClick = (prompt: string) => {
    if (prompt === '📸 Sync from Screenshots') {
      if (selectedImages.length === 0) {
        fileInputRef.current?.click()
        return
      }
      handleSend(
        `Please extract and synchronize my attendance figures from these ${selectedImages.length} SLCM table screenshots.`
      )
      return
    }
    handleSend(prompt)
  }

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
            className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] sm:w-[390px] max-h-[75vh] sm:max-h-[590px] h-[500px] sm:h-[530px] bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl shadow-[6px_6px_0px_var(--shadow-color)] flex flex-col overflow-hidden z-50"
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
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed font-sans ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] rounded-tr-sm'
                        : 'bg-[var(--card)] text-[var(--card-foreground)] border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] rounded-tl-sm'
                    }`}
                  >
                    {/* Render attached screenshots if any */}
                    {m.images && m.images.length > 0 && (
                      <div
                        className={`mb-2 grid gap-1.5 ${
                          m.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                        } max-h-48 overflow-y-auto rounded-xl`}
                      >
                        {m.images.map((img, i) => (
                          <div
                            key={i}
                            className="relative rounded-lg overflow-hidden border border-white/20 bg-black/20"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={`Screenshot ${i + 1}`}
                              className="w-full h-24 object-cover"
                            />
                            {m.images && m.images.length > 1 && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white font-bold">
                                #{i + 1}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
                  onClick={() => handleQuickPromptClick(prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-[var(--muted)] hover:bg-teal-600/15 hover:text-teal-600 border border-[var(--border)] text-[10px] font-semibold text-[var(--foreground)] whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Multi-Image Preview Banner */}
            {selectedImages.length > 0 && (
              <div className="px-3 py-2 bg-teal-600/10 border-t-2 border-[var(--border)] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Preview ${idx + 1}`}
                        className="w-9 h-9 object-cover rounded-lg border-2 border-[var(--border)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow"
                        title="Remove screenshot"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-teal-500 text-[var(--muted-foreground)] hover:text-teal-600 flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                    title="Add another screenshot"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 block">
                    {selectedImages.length} {selectedImages.length === 1 ? 'photo' : 'photos'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedImages([])}
                    className="text-[9px] text-[var(--muted-foreground)] hover:text-rose-500 font-mono"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              onPaste={handlePaste}
              className="p-3 bg-[var(--card)] border-t-2 border-[var(--border)] flex items-end gap-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2.5 rounded-full text-[var(--muted-foreground)] hover:text-teal-600 hover:bg-teal-600/15 border border-[var(--border)] transition-colors shrink-0 mb-0.5"
                title="Attach or upload SLCM screenshots"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length > 0) {
                    processImageFiles(files)
                    e.target.value = ''
                  }
                }}
              />

              <textarea
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={
                  selectedImages.length > 0
                    ? `Hit send to sync ${selectedImages.length} screenshot${selectedImages.length > 1 ? 's' : ''}...`
                    : 'Ask advisor or paste table / screenshots...'
                }
                disabled={isLoading}
                className="flex-1 bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl px-3.5 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-teal-500 transition-colors font-sans resize-none max-h-24 overflow-y-auto leading-normal"
              />
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
                className="p-2.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-40 transition-transform active:scale-95 shrink-0 mb-0.5"
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
