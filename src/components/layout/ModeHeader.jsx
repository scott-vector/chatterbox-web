export default function ModeHeader({ title, children }) {
  return (
    <div className="border-b border-zinc-700/30 bg-[#1c1c21]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-200">{title}</h2>
        {children}
      </div>
    </div>
  )
}
