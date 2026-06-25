import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COFFEE_900 = "#2b2320";
const COFFEE_50 = "#faf7f4";
const COFFEE_100 = "#f1e9e2";
const COFFEE_200 = "#e3d4c6";
const ARANCIO = "#E8731C";

function money(v: number) {
  return `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString("it-IT");
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (missingSupabaseEnv().length > 0) {
    return new Response("Configurazione mancante", { status: 503 });
  }

  const db = createServiceClient();
  const { data: campagna } = await db
    .from("campagne_offerte")
    .select(
      `id, titolo, descrizione, slug, valida_al,
       righe:campagne_offerte_righe(id, titolo, descrizione, prezzo_offerta, foto_storage_path, ordinamento)`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!campagna) return new Response("Not found", { status: 404 });

  const righe = [...(campagna.righe ?? [])]
    .sort((a: any, b: any) => Number(a.ordinamento ?? 0) - Number(b.ordinamento ?? 0))
    .slice(0, 12);

  // Fetch product photos as base64 data URLs
  const fotoMap = new Map<string, string>();
  await Promise.all(
    righe.map(async (riga: any) => {
      if (!riga.foto_storage_path) return;
      const { data } = await db.storage
        .from("offerte-foto")
        .createSignedUrl(riga.foto_storage_path, 300);
      if (!data?.signedUrl) return;
      const dataUrl = await fetchAsDataUrl(data.signedUrl);
      if (dataUrl) fotoMap.set(riga.foto_storage_path, dataUrl);
    })
  );

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;

  // Build rows of 3 columns
  const rows: any[][] = [];
  for (let i = 0; i < righe.length; i += 3) rows.push(righe.slice(i, i + 3));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 794,
          height: 1122,
          backgroundColor: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            backgroundColor: COFFEE_900,
            padding: "18px 28px",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                color: ARANCIO,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              VENA COFFEE MACHINE
            </span>
            <span
              style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginTop: 4 }}
            >
              {campagna.titolo}
            </span>
            {campagna.descrizione && (
              <span
                style={{ color: "#c8b89a", fontSize: 13, marginTop: 6, maxWidth: 460 }}
              >
                {campagna.descrizione}
              </span>
            )}
          </div>
          {campagna.valida_al && (
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              <span style={{ color: "#e5d5c0", fontSize: 12 }}>
                Valido fino al {formatDate(campagna.valida_al)}
              </span>
            </div>
          )}
        </div>

        {/* Product grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "14px 16px",
            gap: 10,
          }}
        >
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", gap: 10, flex: 1 }}>
              {row.map((riga: any) => (
                <div
                  key={riga.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    border: `1px solid ${COFFEE_200}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    backgroundColor: COFFEE_50,
                  }}
                >
                  {fotoMap.get(riga.foto_storage_path) ? (
                    <img
                      src={fotoMap.get(riga.foto_storage_path) as string}
                      width={244}
                      height={150}
                      style={{ width: "100%", height: 150, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: 150,
                        backgroundColor: COFFEE_100,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 36 }}>☕</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "8px 10px",
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COFFEE_900,
                        lineHeight: 1.2,
                      }}
                    >
                      {riga.titolo}
                    </span>
                    {riga.descrizione && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#7a6050",
                          marginTop: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {String(riga.descrizione).slice(0, 60)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: ARANCIO,
                        marginTop: "auto",
                        paddingTop: 6,
                      }}
                    >
                      {money(Number(riga.prezzo_offerta))}
                    </span>
                  </div>
                </div>
              ))}
              {row.length < 3 && <div style={{ flex: 1 }} />}
              {row.length < 2 && <div style={{ flex: 1 }} />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            backgroundColor: ARANCIO,
            padding: "10px 28px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {offertaUrl}
          </span>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>
            Contatta Vena Coffee Machine per ordini
          </span>
        </div>
      </div>
    ),
    {
      width: 794,
      height: 1122,
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
    }
  );
}
