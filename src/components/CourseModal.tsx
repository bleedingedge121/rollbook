'use client'

import React, { useState, useEffect } from 'react'
import { Course } from '@/types'
import { motion } from 'framer-motion'

interface CourseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (courseData: {
    id?: string
    name: string
    code: string
    requiredPercent: number
    color: string
  }) => Promise<void>
  initialData?: Course | null
}

const COLOR_OPTIONS = [
  '#0D9488', // Teal
  '#F472B6', // Pink
  '#FBBF24', // Amber
  '#34D399', // Mint
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#F97316', // Orange
]

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [requiredPercent, setRequiredPercent] = useState<number>(75.0)
  const [color, setColor] = useState('#0D9488')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setCode(initialData.code)
      setRequiredPercent(initialData.requiredPercent || 75.0)
      setColor(initialData.color || '#0D9488')
    } else {
      setName('')
      setCode('')
      setRequiredPercent(75.0)
      setColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)])
    }
    setError(null)
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      setError('Course name and code are required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        id: initialData?.id,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        requiredPercent: Number(requiredPercent),
        color,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save subject')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-md shadow-[8px_8px_0px_var(--shadow-color)] overflow-hidden"
      >
        <div className="p-6 border-b-2 border-[var(--border)] flex items-center justify-between">
          <h3 className="text-lg font-heading font-black text-[var(--foreground)]">
            {initialData ? 'Edit Subject' : 'Add New Subject'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors font-mono"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Subject Name
            </label>
            <input
              type="text"
              placeholder="e.g. Engineering Physics"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Subject Code
            </label>
            <input
              type="text"
              placeholder="e.g. PHY1001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-teal-500 uppercase"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Minimum Required Attendance (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={requiredPercent}
              onChange={(e) => setRequiredPercent(parseFloat(e.target.value))}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono font-bold"
            />
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Standard MAHE attendance threshold is 75%.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Accent Color
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 border-[var(--border)] transition-transform ${
                    color === c ? 'scale-125 shadow-[2px_2px_0px_var(--shadow-color)] ring-2 ring-teal-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="pill-btn px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="pill-btn px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Subject' : 'Add Subject'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
