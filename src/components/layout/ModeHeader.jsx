export default function ModeHeader({ title, children }) {
  return (
    <div className="border-b border-zinc-600/35 bg-[#232328]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="px-10 py-3.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-200">{title}</h2>
        {children}
      </div>
    </div>
  )
}
