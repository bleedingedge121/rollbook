'use client'

import React, { useState, useEffect } from 'react'
import { Course } from '@/types'

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
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
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
  const [color, setColor] = useState('#3b82f6')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setCode(initialData.code)
      setRequiredPercent(initialData.requiredPercent || 75.0)
      setColor(initialData.color || '#3b82f6')
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleUp">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">
            {initialData ? 'Edit Subject' : 'Add New Subject'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Subject Name
            </label>
            <input
              type="text"
              placeholder="e.g. Engineering Physics"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Subject Code
            </label>
            <input
              type="text"
              placeholder="e.g. PHY1001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
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
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Standard MAHE attendance requirement is 75%.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Subject' : 'Add Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
