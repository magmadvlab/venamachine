import React from "react";
import {
  Document, Page, View, Text, Image, StyleSheet,
} from "@react-pdf/renderer";

export interface RicevutaData {
  numeroScheda: string;
  dataIngresso: string;
  cliente: string;
  tipoCliente: string;
  telefono?: string;
  marca?: string;
  modello?: string;
  matricola?: string;
  tipologia?: string;
  colore?: string;
  statoEstetico?: string;
  accessori?: string;
  difetto?: string;
  qrDataUrl?: string; // PNG base64 del QR verso il link di tracking
  trackingShort?: string;
}

const C = { coffee: "#5b3a29", ink: "#2b2320", mute: "#8a7d74", line: "#e3dcd6", soft: "#5a504a" };

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    borderBottomWidth: 2.5, borderBottomColor: C.coffee, paddingBottom: 8 },
  name: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.coffee, letterSpacing: 0.5 },
  sub: { fontSize: 7.5, color: C.mute, marginTop: 2 },
  docTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", textTransform: "uppercase",
    letterSpacing: 1, textAlign: "right" },
  docNum: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.coffee, textAlign: "right" },
  docDate: { fontSize: 8, color: C.mute, textAlign: "right" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  box: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 5, padding: 8 },
  h4: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.7, color: C.mute,
    fontFamily: "Helvetica-Bold", marginBottom: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  soft: { color: C.soft, lineHeight: 1.5 },
  badge: { backgroundColor: C.coffee, color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold",
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  cond: { marginTop: 10, fontSize: 7, color: C.mute, lineHeight: 1.5, textAlign: "justify" },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 },
  qr: { width: 74, height: 74 },
  qrCap: { fontSize: 6.5, color: C.mute, marginTop: 2, textAlign: "center" },
  firmaLine: { borderBottomWidth: 1, borderBottomColor: "#b9aea6", height: 26, marginBottom: 3 },
  firmaLbl: { fontSize: 7, color: C.mute },
});

export function Ricevuta(d: RicevutaData) {
  return (
    <Document>
      <Page size="A5" style={s.page}>
        <View style={s.brandRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View>
              <Text style={s.name}>Vena Coffee Machine</Text>
              <Text style={s.sub}>Officina macchine da caffe</Text>
            </View>
          </View>
          <View>
            <Text style={s.docTitle}>Ricevuta di deposito</Text>
            <Text style={s.docNum}>{d.numeroScheda}</Text>
            <Text style={s.docDate}>Ingresso: {d.dataIngresso}</Text>
          </View>
        </View>

        <View style={s.row}>
          <View style={s.box}>
            <Text style={s.h4}>Cliente</Text>
            <Text style={s.strong}>{d.cliente}</Text>
            <Text style={s.soft}>{d.tipoCliente}{d.telefono ? ` · Tel. ${d.telefono}` : ""}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.h4}>Macchina</Text>
            <Text style={s.strong}>{[d.marca, d.modello].filter(Boolean).join(" ") || "—"}</Text>
            {d.matricola ? <Text style={s.soft}>Matr. {d.matricola}</Text> : null}
            <Text style={s.soft}>{[d.tipologia, d.colore].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>

        <View style={s.row}>
          <View style={s.box}>
            <Text style={s.h4}>Stato estetico all'ingresso</Text>
            <Text style={s.soft}>{d.statoEstetico || "—"}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.h4}>Accessori consegnati</Text>
            <Text style={s.soft}>{d.accessori || "Nessuno"}</Text>
          </View>
        </View>

        <View style={[s.box, { marginTop: 10 }]}>
          <Text style={s.h4}>Difetto segnalato dal cliente</Text>
          <Text style={s.soft}>{d.difetto || "—"}</Text>
        </View>

        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.badge}>Segui la riparazione online</Text>
          <Text style={{ fontSize: 7.5, color: C.mute }}> inquadra il QR: ti aggiorniamo su preventivo e ritiro.</Text>
        </View>

        <Text style={s.cond}>
          Il ritiro avviene dietro presentazione della presente ricevuta. Le macchine non ritirate entro
          90 giorni dall'avviso di completamento potranno essere considerate abbandonate (art. 927 e segg. c.c.).
          L'officina non risponde di dati o cialde lasciati nella macchina. I dati personali sono trattati ai
          sensi del Reg. UE 2016/679 (GDPR) per la sola gestione della riparazione.
        </Text>

        <View style={s.foot}>
          <View>
            {d.qrDataUrl ? <Image src={d.qrDataUrl} style={s.qr} /> : null}
            {d.trackingShort ? <Text style={s.qrCap}>{d.trackingShort}</Text> : null}
          </View>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <View style={s.firmaLine} />
            <Text style={s.firmaLbl}>Firma del cliente per accettazione</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
