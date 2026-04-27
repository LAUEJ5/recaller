import { RecallrCard } from './features/recallr/RecallrCard'

export default function App() {
  return (
    <div className="h-screen overflow-hidden flex flex-col items-center p-6 bg-background font-sans">
      <header className="w-full max-w-6xl flex items-center justify-between pb-4">
        <div className="text-4xl font-semibold">Recallr</div>
      </header>

      <main className="w-full max-w-6xl flex-1 min-h-0">
        <RecallrCard />
      </main>
    </div>
  )
}
