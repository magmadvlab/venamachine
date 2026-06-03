"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X, Download } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "ce-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);

    if (isIos) {
      setShowIosHint(true);
      setVisible(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-coffee-100 bg-white p-4 shadow-lg shadow-coffee-900/10"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-coffee-900">Installa Vena Coffee Machine</p>
          {showIosHint ? (
            <p className="mt-1 text-sm text-coffee-600">
              Tocca <Share className="inline h-4 w-4 align-text-bottom text-arancio" /> Condividi, poi{" "}
              <span className="font-semibold">Aggiungi a Home</span>{" "}
              <Plus className="inline h-4 w-4 align-text-bottom text-arancio" />.
            </p>
          ) : (
            <p className="mt-1 text-sm text-coffee-600">Avviala dall'icona come una vera app.</p>
          )}
          {!showIosHint && (
            <button
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-arancio px-4 py-2 text-sm font-semibold text-white hover:bg-arancio-dark active:scale-95"
            >
              <Download className="h-4 w-4" /> Installa l'app
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Chiudi" className="text-coffee-400 active:scale-90">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
