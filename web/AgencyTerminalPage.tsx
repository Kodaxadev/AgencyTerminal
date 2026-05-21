import React from "react";
import { Shield, FileCheck2, Radio, ScrollText, LockKeyhole, Terminal, Scale } from "lucide-react";

const features = [
  {
    icon: FileCheck2,
    label: "EVIDENCE LEDGER",
    text: "Validated contribution records across PvP, contracts, intel, technical output, assets, exploration, and lore discovery.",
  },
  {
    icon: Radio,
    label: "INTEL REVIEW",
    text: "Operational reports with confidence grading, sensitivity controls, and future Signal Vault export support.",
  },
  {
    icon: Shield,
    label: "CLEARANCE REQUESTS",
    text: "Access requests tied to operational need, contribution history, sponsor context, and auditable decisions.",
  },
  {
    icon: Scale,
    label: "DOCTRINE CHALLENGE",
    text: "Structured dissent workflow for critique, analysis, adopted changes, and contribution credit.",
  },
];

export default function AgencyTerminalPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-400/20">
      <section className="relative overflow-hidden border-b border-emerald-400/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.13),transparent_26%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.28em] text-emerald-300">
              <Terminal className="h-3.5 w-3.5" /> SIG//AGENCY TERMINAL
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Contribution made legible. Clearance made auditable.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Agency Terminal converts enlistment, contracts, intelligence, doctrine challenges, and performance evidence into structured operational records for The Agency // Lux Letifera.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-5 py-3 font-mono text-sm uppercase tracking-[0.18em] text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.12)]" href="#briefing">
                Access Terminal Briefing
              </a>
              <a className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-mono text-sm uppercase tracking-[0.18em] text-amber-200" href="#workflows">
                Review Protocols
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-black/60 p-4 shadow-2xl shadow-emerald-950/40 backdrop-blur">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 font-mono">
              <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">
                <span>SYSTEM:\\EVIDENCE_LEDGER</span>
                <span className="text-emerald-300">ONLINE</span>
              </div>
              <div className="space-y-3">
                <TerminalRow status="CODE 200" title="CONTRACT COMPLETED" meta="+8 // configured_table // v03" />
                <TerminalRow status="PENDING" title="INTEL ACQUISITION" meta="quorum 1/2 // officer_only" />
                <TerminalRow status="STALE" title="LORE DISCOVERY" meta="48h timeout // needs resolution" />
                <TerminalRow status="CODE 403" title="DUPLICATE CLAIM" meta="rejected // insufficient evidence" />
              </div>
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-6 text-amber-100/90">
                CLEARANCE, AUTHORITY, AND ACCESS ARE NOT DECLARED BY THE BOT. THE TERMINAL RECORDS CONTRIBUTION, ROUTES REVIEW, AND PRESERVES THE AUDIT TRAIL.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="briefing" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20">
              <feature.icon className="h-6 w-6 text-emerald-300" />
              <h3 className="mt-4 font-mono text-sm uppercase tracking-[0.2em] text-white">{feature.label}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflows" className="border-y border-white/10 bg-black/30">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-amber-300">SYSTEM://REVIEW_PROTOCOLS</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Ticket-shaped intake. Ledger-backed decisions.</h2>
              <p className="mt-4 text-sm leading-6 text-zinc-400">Each workflow produces structured records, reviewer actions, and audit events. Validated contribution becomes score history. Reversals require elevated procedure.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {["ENLISTMENT", "CONTRACT", "INTEL", "EVIDENCE", "CLEARANCE", "DOCTRINE CHALLENGE"].map((item, idx) => (
                <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>{String(idx + 1).padStart(2, "0")} //</span>
                    <LockKeyhole className="h-4 w-4" />
                  </div>
                  <div className="mt-4 text-emerald-200">{item}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">STATUS // ROUTABLE</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500 lg:px-8 md:flex-row md:items-center md:justify-between">
        <span>Encrypted via Discord · Evidence retained by ledger</span>
        <span>THE AGENCY // LUX LETIFERA // CONCEPT TERMINAL</span>
      </footer>
    </main>
  );
}

function TerminalRow({ status, title, meta }: { status: string; title: string; meta: string }) {
  const color = status.includes("403") ? "text-red-300" : status === "STALE" ? "text-amber-300" : status === "PENDING" ? "text-zinc-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={color}>STATUS // {status}</span>
        <span className="text-zinc-600">AUDIT READY</span>
      </div>
      <div className="mt-2 text-sm text-white">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{meta}</div>
    </div>
  );
}
