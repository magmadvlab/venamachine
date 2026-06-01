"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NuovaAccettazione, RegimePossessoMacchina, TipoMacchina } from "@/lib/types";
import { User, Coffee, ClipboardList } from "lucide-react";

const ACCESSORI = ["Serbatoio", "Vassoio", "Cavo alim.", "Portacialde"];

type StoricoRiparazione = {
  id: string;
  numero_scheda: string | null;
  stato: string;
  data_ingresso: string;
  data_riparazione: string | null;
  difetto_cliente: string | null;
  diagnosi_tecnico: string | null;
  importo_finale: number | null;
  importo_preventivo: number | null;
  operatore?: { nome?: string | null } | { nome?: string | null }[] | null;
};

type StoricoMacchina = {
  macchina: {
    marca: string | null;
    modello: string | null;
    matricola: string | null;
    tipologia: TipoMacchina | null;
    regime_possesso: RegimePossessoMacchina | null;
    colore: string | null;
    cliente?: { ragione_sociale?: string | null; telefono?: string | null; email?: string | null } | null;
  } | null;
  riparazioni: StoricoRiparazione[];
};

export default function AcceptanceForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [storico, setStorico] = useState<StoricoMacchina | null>(null);
  const [storicoStatus, setStoricoStatus] = useState<"idle" | "loading" | "done" | "empty" | "error">("idle");

  const [f, setF] = useState<NuovaAccettazione>({
    cliente: { tipo: "privato", ragione_sociale: "", telefono: "", email: "",
      consenso_gdpr: false, canale_preferito: "email" },
    macchina: { tipologia: "capsule", regime_possesso: "proprieta_cliente" },
    scheda: { accessori: [], preventivo_richiesto: false },
  });

  const set = (path: string, val: any) =>
    setF((prev) => {
      const next = structuredClone(prev) as any;
      const [a, b] = path.split(".");
      next[a][b] = val;
      return next;
    });

  const toggleAccessorio = (acc: string) =>
    setF((prev) => {
      const has = prev.scheda.accessori.includes(acc);
      const accessori = has ? prev.scheda.accessori.filter((x) => x !== acc) : [...prev.scheda.accessori, acc];
      return { ...prev, scheda: { ...prev.scheda, accessori } };
    });

  const mostraFoto = f.scheda.stato_estetico === "graffi" || f.scheda.stato_estetico === "danni";
  const matricola = f.macchina.matricola?.trim() ?? "";

  useEffect(() => {
    if (matricola.length < 3) {
      setStorico(null);
      setStoricoStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStoricoStatus("loading");
      try {
        const res = await fetch(`/api/macchine/storico?matricola=${encodeURIComponent(matricola)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as StoricoMacchina & { error?: string };
        if (!res.ok) throw new Error(data.error || "Errore ricerca storico");

        setStorico(data);
        setStoricoStatus(data.riparazioni.length > 0 ? "done" : "empty");
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setStorico(null);
          setStoricoStatus("error");
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [matricola]);

  const usaDatiStorico = () => {
    if (!storico?.macchina) return;
    setF((prev) => ({
      ...prev,
      macchina: {
        ...prev.macchina,
        marca: storico.macchina?.marca ?? prev.macchina.marca,
        modello: storico.macchina?.modello ?? prev.macchina.modello,
        colore: storico.macchina?.colore ?? prev.macchina.colore,
        tipologia: storico.macchina?.tipologia ?? prev.macchina.tipologia,
        regime_possesso: storico.macchina?.regime_possesso ?? prev.macchina.regime_possesso,
      },
    }));
  };

  async function submit() {
    setErrore(null);
    if (!f.cliente.ragione_sociale.trim()) { setErrore("Inserisci nome o ragione sociale."); return; }
    if (!f.cliente.consenso_gdpr) { setErrore("Manca il consenso al trattamento dati (GDPR)."); return; }
    setSaving(true);
    try {
      const payload: NuovaAccettazione = {
        ...f,
        scheda: { ...f.scheda },
      };
      const res = await fetch("/api/riparazioni", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) {
        const detail = [out.error, out.details, out.hint].filter(Boolean).join(" ");
        throw new Error(detail || "Errore salvataggio");
      }

      if (mostraFoto && fotoFile) {
        const form = new FormData();
        form.set("file", fotoFile);
        form.set("momento", "ingresso");
        const photoRes = await fetch(`/api/riparazioni/${out.id}/foto`, { method: "POST", body: form });
        const photoOut = await photoRes.json();
        if (!photoRes.ok) throw new Error(`Scheda creata, ma upload foto non riuscito: ${photoOut.error}`);
      }

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setErrore(e.message); setSaving(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* CLIENTE */}
      <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
          <User className="h-5 w-5 text-arancio" /> Cliente
        </h2>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["privato", "azienda"] as const).map((t) => (
            <button key={t} type="button" onClick={() => set("cliente.tipo", t)}
              className={`rounded-lg border px-3 py-3 text-sm font-medium capitalize sm:py-2 ${
                f.cliente.tipo === t ? "border-arancio bg-arancio/10 text-arancio-dark" : "border-coffee-200 text-coffee-400"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nome / Ragione sociale *</label>
            <input className={inputCls} value={f.cliente.ragione_sociale}
              onChange={(e) => set("cliente.ragione_sociale", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Telefono</label>
              <input className={inputCls} value={f.cliente.telefono}
                onChange={(e) => set("cliente.telefono", e.target.value)} /></div>
            <div><label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={f.cliente.email}
                onChange={(e) => set("cliente.email", e.target.value)} /></div>
          </div>
        </div>
      </section>

      {/* MACCHINA */}
      <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
          <Coffee className="h-5 w-5 text-arancio" /> Macchina
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={labelCls}>Marca</label>
            <input className={inputCls} value={f.macchina.marca ?? ""}
              onChange={(e) => set("macchina.marca", e.target.value)} /></div>
          <div><label className={labelCls}>Modello</label>
            <input className={inputCls} value={f.macchina.modello ?? ""}
              onChange={(e) => set("macchina.modello", e.target.value)} /></div>
          <div><label className={labelCls}>Matricola</label>
            <input className={inputCls} value={f.macchina.matricola ?? ""}
              autoComplete="off" onChange={(e) => set("macchina.matricola", e.target.value)} /></div>
          <div><label className={labelCls}>Colore</label>
            <input className={inputCls} value={f.macchina.colore ?? ""}
              onChange={(e) => set("macchina.colore", e.target.value)} /></div>
        </div>

        {storicoStatus !== "idle" && (
          <div className="mt-4 border-t border-coffee-100 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Storico macchina</p>
                {storicoStatus === "loading" && <p className="mt-1 text-sm text-coffee-400">Ricerca in corso...</p>}
                {storicoStatus === "empty" && <p className="mt-1 text-sm text-coffee-400">Nessun intervento precedente trovato.</p>}
                {storicoStatus === "error" && <p className="mt-1 text-sm text-red-700">Storico non disponibile.</p>}
                {storicoStatus === "done" && storico && (
                  <p className="mt-1 text-sm font-semibold text-coffee-700">
                    {storico.riparazioni.length} intervent{storico.riparazioni.length === 1 ? "o" : "i"} precedente{storico.riparazioni.length === 1 ? "" : "i"}
                  </p>
                )}
              </div>
              {storico?.macchina && (
                <button type="button" onClick={usaDatiStorico}
                  className="shrink-0 rounded-lg border border-arancio/40 px-3 py-2 text-xs font-semibold text-arancio-dark">
                  Usa dati
                </button>
              )}
            </div>

            {storicoStatus === "done" && storico && (
              <ul className="mt-3 divide-y divide-coffee-100 text-sm">
                {storico.riparazioni.map((r) => {
                  const operatore = Array.isArray(r.operatore) ? r.operatore[0] : r.operatore;
                  return (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs font-bold text-coffee-700">{r.numero_scheda ?? "Scheda"}</span>
                        <span className="text-xs text-coffee-400">
                          {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                        </span>
                        <span className="rounded-full bg-coffee-50 px-2 py-0.5 text-xs font-semibold text-coffee-600">
                          {r.stato.replace(/_/g, " ")}
                        </span>
                      </div>
                      {r.data_riparazione && (
                        <p className="mt-1 text-xs text-coffee-500">
                          Riparata il {new Date(r.data_riparazione).toLocaleDateString("it-IT")}
                          {operatore?.nome ? ` da ${operatore.nome}` : ""}
                        </p>
                      )}
                      {r.difetto_cliente && <p className="mt-1 text-coffee-700">Segnalato: {r.difetto_cliente}</p>}
                      {r.diagnosi_tecnico && <p className="mt-1 text-coffee-600">Fatto: {r.diagnosi_tecnico}</p>}
                      {(r.importo_finale != null || r.importo_preventivo != null) && (
                        <p className="mt-1 text-xs font-semibold text-coffee-600">
                          Importo: € {Number(r.importo_finale ?? r.importo_preventivo).toFixed(2)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3">
          <label className={labelCls}>Tipologia</label>
          <select className={inputCls} value={f.macchina.tipologia}
            onChange={(e) => set("macchina.tipologia", e.target.value as TipoMacchina)}>
            <option value="cialde">Cialde</option><option value="capsule">Capsule</option>
            <option value="macinato">Macinato</option><option value="altro">Altro</option>
          </select>
        </div>

        <div className="mt-3">
          <label className={labelCls}>Regime macchina</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              ["proprieta_cliente", "Proprietà cliente"],
              ["comodato_uso", "Comodato d'uso"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => set("macchina.regime_possesso", value)}
                className={`rounded-lg border px-3 py-3 text-sm font-medium sm:py-2 ${
                  f.macchina.regime_possesso === value ? "border-arancio bg-arancio/10 text-arancio-dark" : "border-coffee-200 text-coffee-400"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* STATO + GUASTO */}
      <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
          <ClipboardList className="h-5 w-5 text-arancio" /> Stato e guasto
        </h2>
        <label className={labelCls}>Stato estetico all'ingresso</label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(["buono", "graffi", "danni"] as const).map((t) => (
            <button key={t} type="button" onClick={() => set("scheda.stato_estetico", t)}
              className={`rounded-lg border px-2 py-3 text-sm font-medium capitalize sm:py-2 ${
                f.scheda.stato_estetico === t ? "border-arancio bg-arancio/10 text-arancio-dark" : "border-coffee-200 text-coffee-400"}`}>
              {t}
            </button>
          ))}
        </div>

        {mostraFoto && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-amber-800">
              Foto del difetto (consigliata per tutela)
            </label>
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-coffee-600" />
          </div>
        )}

        <label className={labelCls}>Accessori consegnati</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {ACCESSORI.map((acc) => (
            <button key={acc} type="button" onClick={() => toggleAccessorio(acc)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                f.scheda.accessori.includes(acc) ? "border-arancio bg-arancio/10 text-arancio-dark" : "border-coffee-200 text-coffee-400"}`}>
              {acc}
            </button>
          ))}
        </div>

        <label className={labelCls}>Difetto segnalato dal cliente</label>
        <textarea className={`${inputCls} min-h-[80px]`}
          onChange={(e) => set("scheda.difetto_cliente", e.target.value)} />

        <div className="mt-3">
          <label className={labelCls}>Preventivo previsto?</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              [false, "No"],
              [true, "Sì"],
            ] as const).map(([value, label]) => (
              <button key={label} type="button" onClick={() => set("scheda.preventivo_richiesto", value)}
                className={`rounded-lg border px-3 py-3 text-sm font-medium sm:py-2 ${
                  f.scheda.preventivo_richiesto === value ? "border-arancio bg-arancio/10 text-arancio-dark" : "border-coffee-200 text-coffee-400"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {f.scheda.preventivo_richiesto && (
          <div className="mt-3">
            <label className={labelCls}>Spesa massima autorizzata</label>
            <input className={inputCls} inputMode="decimal" type="number" min="0" step="0.01"
              value={f.scheda.spesa_max_autorizzata ?? ""}
              onChange={(e) => set("scheda.spesa_max_autorizzata", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        )}
      </section>

      {/* GDPR */}
      <label className="flex items-start gap-3 rounded-xl border border-coffee-100 bg-white p-4 text-sm sm:p-5">
        <input type="checkbox" checked={f.cliente.consenso_gdpr} className="mt-0.5 h-5 w-5 accent-arancio"
          onChange={(e) => set("cliente.consenso_gdpr", e.target.checked)} />
        <span className="text-coffee-600">
          Il cliente acconsente al trattamento dei dati (Reg. UE 2016/679) per la gestione della riparazione
          e autorizza a essere ricontattato ai recapiti indicati.
        </span>
      </label>

      {errore && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errore}</p>}

      <div className="sticky bottom-0 -mx-4 bg-coffee-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <button onClick={submit} disabled={saving}
          className="w-full rounded-full bg-arancio py-3.5 text-base font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-[0.99] disabled:opacity-60">
          {saving ? "Salvataggio…" : "Crea scheda e invia ricevuta"}
        </button>
      </div>
    </div>
  );
}
