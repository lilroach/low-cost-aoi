import { useState, useEffect } from 'react'

export const useOrchestrator = (alignState: string) => {
    const [isRunning, setIsRunning] = useState(false)
    const [runResults, setRunResults] = useState<any[]>([])
    const [runIndex, setRunIndex] = useState(0)

    useEffect(() => {
        let interval: any
        if (alignState === 'running') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/orchestrator/status')
                    const data = await res.json()

                    if (data.is_running) {
                        setIsRunning(true)
                        setRunIndex(data.current_point_index)
                        setRunResults(data.results)
                    } else {
                        setIsRunning(false)
                        setRunResults(data.results)
                        // Note: Transitioning state back to idle should be managed by caller?
                        // Or we can return a flag.
                    }
                } catch (e) {
                    console.error("Orchestrator poll failed", e)
                }
            }, 500)
        } else {
            setIsRunning(false)
        }
        return () => clearInterval(interval)
    }, [alignState])

    return { isRunning, setIsRunning, runResults, setRunResults, runIndex, setRunIndex }
}
