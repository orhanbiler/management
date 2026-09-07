import Link from "next/link"
import { Layers3, ShieldCheck, Laptop, Check, ArrowUpRight } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link
          href="/"
          className="flex items-center gap-3 text-base font-medium"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-[#efbc9e] text-[#20392f]">
            <Layers3 className="size-5" />
          </span>
          Device Manager<span className="-ml-2 text-[#efbc9e]">.</span>
        </Link>
        <div className="my-auto max-w-[460px] py-12">
          <p className="text-[10px] font-medium tracking-[0.2em] text-[#b5c6bc]">
            CHEVERLY POLICE DEPARTMENT
          </p>
          <h1 className="mt-5 text-[clamp(36px,3.5vw,54px)] font-medium leading-[1.13] tracking-[-0.045em]">
            Your equipment.
            <br />
            Your people.
            <br />
            <span className="text-[#efbc9e]">One connected workspace.</span>
          </h1>
          <p className="mt-6 max-w-[340px] text-sm leading-7 text-[#b5c6bc]">
            A clearer picture of your department’s devices, assignments, and
            readiness. Built for the work ahead.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-grid" />
            <div className="auth-device">
              <div className="flex items-center justify-between text-[10px] text-[#c9d5cc]">
                <span className="flex items-center gap-2">
                  <Laptop className="size-3.5" /> DEVICE WORKSPACE
                </span>
                <span className="flex gap-1">
                  <i className="size-1 rounded-full bg-white/30" />
                  <i className="size-1 rounded-full bg-white/30" />
                  <i className="size-1 rounded-full bg-white/30" />
                </span>
              </div>
              <div className="auth-device-screen">
                <div className="space-y-3 border-r border-white/10 pr-3">
                  <div className="h-2 w-10 rounded bg-[#efbc9e]/70" />
                  <div className="h-2 w-12 rounded bg-white/10" />
                  <div className="h-2 w-8 rounded bg-white/10" />
                </div>
                <div className="space-y-4">
                  {[80, 55, 68].map((width, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded bg-white/5">
                        <Laptop className="size-3 text-white/40" />
                      </div>
                      <div className="flex-1">
                        <div
                          className="mb-1.5 h-1.5 rounded bg-white/30"
                          style={{ width: `${width}%` }}
                        />
                        <div className="h-1 w-9 rounded bg-white/10" />
                      </div>
                      <Check className="size-3 text-[#afc7a5]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="auth-float">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#c0cfa8]/10">
                <ShieldCheck className="size-4 text-[#c0cfa8]" />
              </span>
              <div>
                <p className="font-medium">Accounted for.</p>
                <p className="mt-1 text-[10px] text-white/50">
                  Ready for the next shift.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-[#b5c6bc]">
          <span>Equipment management, thoughtfully organized.</span>
          <ArrowUpRight className="size-4" />
        </div>
      </aside>
      <main className="auth-main">
        <div className="absolute top-6 right-6">
          <ModeToggle />
        </div>
        <Link
          href="/"
          className="absolute top-7 left-6 flex items-center gap-2 text-sm font-semibold lg:hidden"
        >
          <Layers3 className="size-5 text-primary" />
          Device Manager
        </Link>
        <div className="auth-form">{children}</div>
        <div className="absolute bottom-7 px-6 text-center text-[10px] text-muted-foreground">
          Cheverly Police Department <span className="mx-2">·</span> Device
          Manager
        </div>
      </main>
    </div>
  )
}
