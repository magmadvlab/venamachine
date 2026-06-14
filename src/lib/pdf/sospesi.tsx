import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const C = { coffee: "#5b3a29", ink: "#2b2320", mute: "#8a7d74", line: "#e3dcd6", amber: "#b45309" };

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },
  header: { borderBottomWidth: 2, borderBottomColor: C.coffee, paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.coffee },
  subtitle: { fontSize: 9, color: C.mute, marginTop: 2 },
  table: { marginTop: 8 },
  thead: { flexDirection: "row", backgroundColor: C.coffee, color: "#fff", padding: "5 6", fontSize: 8, fontFamily: "Helvetica-Bold" },
  trow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, padding: "5 6", fontSize: 8.5 },
  trowAlt: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, padding: "5 6", fontSize: 8.5, backgroundColor: "#faf7f4" },
  c1: { width: "22%", fontFamily: "Helvetica-Bold" },
  c2: { width: "14%" },
  c3: { width: "18%" },
  c4: { width: "14%" },
  c5: { width: "14%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  c6: { width: "18%", color: C.amber },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerLabel: { fontSize: 9, color: C.mute },
  footerTotal: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.coffee },
});

function money(val: number | null) {
  if (val == null) return "—";
  return `€ ${Number(val).toFixed(2)}`;
}

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("it-IT");
}

export interface SospesoItem {
  tipo: "riparazione" | "vendita";
  riferimento: string;
  cliente: { nome: string; telefono?: string | null; email?: string | null };
  importo: number | null;
  data: string;
  giorni_sospeso: number;
}

function buildItems(riparazioni: any[], vendite: any[]): SospesoItem[] {
  const oggi = new Date();
  const rip = riparazioni.map((r: any) => {
    const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    return {
      tipo: "riparazione" as const,
      riferimento: r.numero_scheda ?? "—",
      cliente: { nome: c?.ragione_sociale ?? "—", telefono: c?.telefono ?? null, email: c?.email ?? null },
      importo: r.importo_finale ?? r.importo_preventivo ?? null,
      data: r.data_ingresso,
      giorni_sospeso: Math.floor((oggi.getTime() - new Date(r.data_ingresso).getTime()) / 86400000),
    };
  });
  const ven = vendite.map((v: any) => {
    const c = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    const righe = v.righe ?? [];
    const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
    return {
      tipo: "vendita" as const,
      riferimento: v.numero_documento ?? v.id?.slice(0, 8) ?? "—",
      cliente: { nome: c?.ragione_sociale ?? "—", telefono: c?.telefono ?? null, email: c?.email ?? null },
      importo: importo > 0 ? importo : null,
      data: v.data_ordine,
      giorni_sospeso: Math.floor((oggi.getTime() - new Date(v.data_ordine).getTime()) / 86400000),
    };
  });
  return [...rip, ...ven].sort((a, b) => a.giorni_sospeso - b.giorni_sospeso);
}

function SospesiDocument({ items, generatoIl }: { items: SospesoItem[]; generatoIl: string }) {
  const totale = items.reduce((sum, i) => sum + (i.importo ?? 0), 0);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Incassi Sospesi</Text>
          <Text style={s.subtitle}>Vena Coffee Machine · Generato il {generatoIl} · {items.length} pratiche</Text>
        </View>
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.c1}>Cliente</Text>
            <Text style={s.c2}>Telefono</Text>
            <Text style={s.c3}>Email</Text>
            <Text style={s.c4}>Riferimento</Text>
            <Text style={s.c5}>Importo</Text>
            <Text style={s.c6}>Giorni aperti</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={i % 2 === 0 ? s.trow : s.trowAlt}>
              <Text style={s.c1}>{item.cliente.nome}</Text>
              <Text style={s.c2}>{item.cliente.telefono ?? "—"}</Text>
              <Text style={s.c3}>{item.cliente.email ?? "—"}</Text>
              <Text style={s.c4}>{item.riferimento} ({item.tipo === "riparazione" ? "Rip." : "Vend."})</Text>
              <Text style={s.c5}>{money(item.importo)}</Text>
              <Text style={s.c6}>{item.giorni_sospeso} gg · {fmt(item.data)}</Text>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <Text style={s.footerLabel}>Totale da incassare</Text>
          <Text style={s.footerTotal}>{money(totale)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildSospesiPDF(opts: { riparazioni: any[]; vendite: any[] }): Promise<Buffer> {
  const items = buildItems(opts.riparazioni, opts.vendite);
  const generatoIl = new Date().toLocaleDateString("it-IT");
  return renderToBuffer(<SospesiDocument items={items} generatoIl={generatoIl} />);
}
