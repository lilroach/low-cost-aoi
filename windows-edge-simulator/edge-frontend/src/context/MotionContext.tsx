import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface MotionStatus {
    machine: { x: number, y: number }
    work: { x: number, y: number }
    offset: { x: number, y: number }
}

interface MotionContextType {
    status: MotionStatus
    stepSize: number
    setStepSize: (size: number) => void
    handleJog: (axis: string, dist: number) => Promise<void>
    handleHome: () => Promise<void>
    moveToAbsolute: (x: number, y: number) => Promise<void>
    handleRecordRef: (idx: number) => Promise<void>
    handleRecordPoint: () => Promise<void>
    handleUpdatePoints: (points: any[]) => Promise<void>
}

const MotionContext = createContext<MotionContextType | undefined>(undefined)

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<MotionStatus>({
        machine: { x: 0, y: 0 },
        work: { x: 0, y: 0 },
        offset: { x: 0, y: 0 }
    })
    const [stepSize, setStepSize] = useState(10)
    const statusRef = useRef(status)

    useEffect(() => {
        statusRef.current = status
    }, [status])

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/motion/status')
            const data = await res.json()
            setStatus(data)
        } catch (e) {
            console.error("Failed to fetch motion status", e)
        }
    }, [])

    useEffect(() => {
        const interval = setInterval(fetchStatus, 500)
        return () => clearInterval(interval)
    }, [fetchStatus])

    const handleJog = useCallback(async (axis: string, dist: number) => {
        try {
            await fetch('/api/motion/jog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ axis, distance: dist })
            })
            fetchStatus()
        } catch (e) {
            console.error("Jog failed", e)
        }
    }, [fetchStatus])

    const handleHome = useCallback(async () => {
        if (!confirm("Return to Machine Zero?")) return
        try {
            await fetch('/api/motion/home', { method: 'POST' })
            fetchStatus()
        } catch (e) {
            console.error("Home failed", e)
        }
    }, [fetchStatus])

    const moveToAbsolute = useCallback(async (x: number, y: number) => {
        const dx = x - statusRef.current.machine.x
        const dy = y - statusRef.current.machine.y

        if (Math.abs(dx) > 0.1) await handleJog('x', dx)
        if (Math.abs(dy) > 0.1) await handleJog('y', dy)
    }, [handleJog])

    const handleRecordRef = useCallback(async (idx: number) => {
        await fetch(`/api/program/record/ref/${idx}`, { method: 'POST' })
    }, [])

    const handleRecordPoint = useCallback(async () => {
        await fetch(`/api/program/record/point`, { method: 'POST' })
    }, [])

    const handleUpdatePoints = useCallback(async (points: any[]) => {
        await fetch('/api/program/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points })
        })
    }, [])

    return (
        <MotionContext.Provider value={{
            status, stepSize, setStepSize, handleJog, handleHome, moveToAbsolute,
            handleRecordRef, handleRecordPoint, handleUpdatePoints
        }}>
            {children}
        </MotionContext.Provider>
    )
}

export const useMotion = () => {
    const context = useContext(MotionContext)
    if (!context) throw new Error("useMotion must be used within a MotionProvider")
    return context
}
