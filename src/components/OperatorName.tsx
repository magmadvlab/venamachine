"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

export const OPERATOR_STORAGE_KEY = "coffee_operator_name";
export const OPERATOR_ID_STORAGE_KEY = "coffee_operator_id";

type Operator = { id: string; nome: string };

export function getStoredOperator() {
  if (typeof window === "undefined") return { id: "", nome: "" };
  return {
    id: window.localStorage.getItem(OPERATOR_ID_STORAGE_KEY)?.trim() ?? "",
    nome: window.localStorage.getItem(OPERATOR_STORAGE_KEY)?.trim() ?? "",
  };
}

export function getStoredOperatorName() {
  return getStoredOperator().nome;
}

export function getStoredOperatorId() {
  return getStoredOperator().id;
}

export function OperatorName({ compact = false }: { compact?: boolean }) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOperatorId(getStoredOperatorId());

    let cancelled = false;
    fetch("/api/operatori")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setOperators(data.operatori ?? []);
      })
      .catch(() => {
        if (!cancelled) setOperators([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateOperator(id: string) {
    setOperatorId(id);
    const operator = operators.find((item) => item.id === id);
    window.localStorage.setItem(OPERATOR_ID_STORAGE_KEY, operator?.id ?? "");
    window.localStorage.setItem(OPERATOR_STORAGE_KEY, operator?.nome ?? "");
  }

  return (
    <label className={`flex items-center gap-2 rounded-2xl border border-coffee-100 bg-white px-3 py-2 text-sm ${compact ? "" : "shadow-sm shadow-coffee-900/5"}`}>
      <UserRound className="h-4 w-4 shrink-0 text-arancio" />
      <span className="shrink-0 font-semibold text-coffee-700">Operatore</span>
      <select
        value={operatorId}
        onChange={(e) => updateOperator(e.target.value)}
        disabled={loading || operators.length === 0}
        className="min-w-0 flex-1 bg-transparent text-coffee-900 outline-none placeholder:text-coffee-300"
      >
        <option value="">{loading ? "Caricamento..." : "Seleziona"}</option>
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>{operator.nome}</option>
        ))}
      </select>
    </label>
  );
}
