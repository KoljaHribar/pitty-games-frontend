/**
 * One-off seed: load normalized_programs.json and upload to
 * Supabase table `study_abroad_programs`.
 *
 * Run:
 *   SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." \
 *   node seed.js
 *
 * Use the service_role key (Project Settings → API → service_role). The anon
 * key will almost certainly be blocked by RLS for INSERT.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const JSON_PATH = path.join(__dirname, "normalized_programs.json");
const TABLE = "study_abroad_programs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ydbivwgowrzrkntiasef.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars."
  );
  process.exit(1);
}

/**
 * @param {{ primary_city?: string, country?: string }} p
 */
function buildLocation(p) {
  const city = (p.primary_city || "").trim();
  const country = (p.country || "").trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || "";
}

/**
 * @param {Record<string, unknown>} p
 */
function toRow(p) {
  return {
    name: p.program_name,
    location: buildLocation(/** @type {any} */ (p)),
    image_url: p.image_url,
    pro_text: p.pro_text,
    con_text: p.con_text,
    feature_vector: p.feature_vector,
  };
}

async function main() {
  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const programs = Array.isArray(parsed.programs) ? parsed.programs : [];

  if (!programs.length) {
    console.error("No programs found under the 'programs' key. Aborting.");
    process.exit(1);
  }

  const rows = programs.map(toRow);
  console.log(`Loaded ${rows.length} program(s) from normalized_programs.json.`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from(TABLE)
    .insert(rows)
    .select("id, name");

  if (error) {
    console.error("Insert failed:", error.message);
    console.error(error);
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? 0} row(s) into ${TABLE}.`);
  if (data?.length) {
    for (const r of data) {
      console.log(`  • ${r.id}  ${r.name}`);
    }
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
