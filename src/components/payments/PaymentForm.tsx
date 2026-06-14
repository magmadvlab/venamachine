"use client";

import type { StatoPagamento } from "@/lib/types";

const METODI = ["Contanti", "POS", "Bonifico", "Assegno", "Altro"] as const;

const inputCls =
  "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export interface PaymentFormValue {
  stato_pagamento: StatoPagamento | "";
  metodo_pagamento: string;
  data_pagamento: string;
}

export function PaymentForm({
  value,
  onChange,
}: {
  value: PaymentFormValue;
  onChange: (v: PaymentFormValue) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  function setStato(stato: StatoPagamento | "") {
    onChange({
      stato_pagamento: stato,
      metodo_pagamento: stato === "pagato" ? value.metodo_pagamento : "",
      data_pagamento: stato === "pagato" ? (value.data_pagamento || today) : "",
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3">
      <div>
        <label className={labelCls}>Stato pagamento</label>
        <select
          className={inputCls}
          value={value.stato_pagamento}
          onChange={(e) => setStato(e.target.value as StatoPagamento | "")}
        >
          <option value="">— non specificato</option>
          <option value="sospeso">Sospeso (da incassare)</option>
          <option value="pagato">Pagato</option>
        </select>
      </div>

      {value.stato_pagamento === "pagato" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Metodo pagamento</label>
            <select
              className={inputCls}
              value={value.metodo_pagamento}
              onChange={(e) => onChange({ ...value, metodo_pagamento: e.target.value })}
            >
              <option value="">Seleziona metodo</option>
              {METODI.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data incasso</label>
            <input
              type="date"
              className={inputCls}
              value={value.data_pagamento}
              onChange={(e) => onChange({ ...value, data_pagamento: e.target.value })}
            />
          </div>
        </div>
      )}

      {value.stato_pagamento === "sospeso" && (
        <p className="text-xs font-semibold text-amber-700">
          Da incassare — l&apos;admin verrà notificato.
        </p>
      )}
    </div>
  );
}
