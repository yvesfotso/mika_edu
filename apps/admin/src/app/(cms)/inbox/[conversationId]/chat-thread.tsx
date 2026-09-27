"use client";

import type { MessageDto } from "@eduprep/core";
import { useEffect, useOptimistic, useRef, useState } from "react";
import { ArrowUpRightIcon } from "@/components/icons";
import { VerifiedBadge } from "@/components/verified-badge";
import { replyToSupport } from "@/server/cms/actions";
import { initialActionState } from "@/server/cms/state";

type ChatMessage = MessageDto & { pending?: boolean };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function ChatThread({ conversationId, learnerName, messages }: { conversationId: string; learnerName: string; messages: MessageDto[] }) {
  const [optimistic, addOptimistic] = useOptimistic<ChatMessage[], ChatMessage>(messages, (state, m) => [...state, m]);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [optimistic.length]);

  async function send(fd: FormData) {
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return;
    const clientMessageId = crypto.randomUUID();
    fd.set("clientMessageId", clientMessageId);
    setError(null);
    addOptimistic({
      id: clientMessageId,
      conversationId,
      sender: null,
      mine: true,
      body,
      createdAt: new Date().toISOString(),
      clientMessageId,
      pending: true,
    });
    const result = await replyToSupport(initialActionState, fd);
    if (!result.ok) setError(result.error ?? "Message not sent.");
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {optimistic.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted">
            <p className="font-medium text-ink">Say hello to {learnerName.split(" ")[0]}</p>
            <p>Your message appears in their EduPrep app under “EduPrep team”.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {optimistic.map((m, i) => {
              const fromStaff = m.mine || Boolean(m.sender?.verified);
              const day = dayLabel(m.createdAt);
              const showDay = i === 0 || day !== dayLabel(optimistic[i - 1]!.createdAt);
              return (
                <li key={m.clientMessageId ?? m.id}>
                  {showDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-frame px-3 py-1 text-[11px] font-medium text-muted">{day}</span>
                    </div>
                  )}
                  <div className={`flex ${fromStaff ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-3xl px-4 py-2.5 text-sm ${
                        fromStaff ? "rounded-br-lg bg-ocean text-white" : "rounded-bl-lg bg-frame text-ink"
                      } ${m.pending ? "opacity-70" : ""}`}
                    >
                      {fromStaff && !m.mine && m.sender && (
                        <div className="mb-1 flex items-center gap-1.5 text-xs opacity-90">
                          <span className="font-semibold">{m.sender.displayName}</span>
                          <VerifiedBadge label={m.sender.role === "admin" ? "Admin" : "Staff"} />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div className={`mt-1 text-right text-[10px] ${fromStaff ? "text-white/70" : "text-muted"}`}>
                        {m.pending ? "Sending…" : time(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} action={send} className="border-t border-line p-3 md:px-5">
        <input type="hidden" name="conversationId" value={conversationId} />
        {error && (
          <p role="alert" className="mb-2 px-2 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-3xl bg-frame p-1.5 pl-4">
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={1}
            placeholder={`Message ${learnerName.split(" ")[0]}…`}
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink transition hover:brightness-95"
          >
            <ArrowUpRightIcon size={18} />
          </button>
        </div>
        <p className="mt-1.5 px-2 text-[11px] text-muted">Enter to send · Shift + Enter for a new line</p>
      </form>
    </>
  );
}
