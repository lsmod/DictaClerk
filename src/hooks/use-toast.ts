import { useState } from 'react'

type Toast = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])

  const addToast = ({
    title,
    description,
    action,
    variant = 'default',
  }: Omit<Toast, 'id'>) => {
    const id = genId()
    const newToast: Toast = { id, title, description, action, variant }

    setToastList((prev) => [...prev, newToast])

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToastList((prev) => prev.filter((toast) => toast.id !== id))
    }, 5000)

    return { id }
  }

  const dismiss = (toastId?: string) => {
    if (toastId) {
      setToastList((prev) => prev.filter((toast) => toast.id !== toastId))
    } else {
      setToastList([])
    }
  }

  return {
    toasts: toastList,
    toast: addToast,
    dismiss,
  }
}

export const toast = ({
  title,
  description,
  action,
  variant = 'default',
}: Omit<Toast, 'id'>) => {
  const id = genId()
  console.log('Toast:', { title, description, action, variant })
  return { id }
}
