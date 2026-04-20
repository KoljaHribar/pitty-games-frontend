"""Min-max normalize the numeric columns of programs.csv and emit normalized_programs.json.

Each program in the output JSON contains its descriptive fields, the normalized
values for every numeric column, a single ``feature_vector`` array holding all
7 normalized numeric features in a fixed order, and three enrichment fields:

* ``image_url`` – a real photo of the primary city (Wikipedia REST API thumbnail)
* ``pro_text``  – one short, city-specific positive
* ``con_text``  – one short, city-specific negative

The ``english_proficiency_ef_epi_2024`` column contains the literal string
"Native" for English-speaking countries; we treat that as the ceiling value
(700) before normalization, so those programs receive 1.0 for that feature.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

INPUT_CSV = Path(__file__).with_name("programs.csv")
OUTPUT_JSON = Path(__file__).with_name("normalized_programs.json")

NATIVE_ENGLISH_SCORE = 700

NUMERIC_COLUMNS = [
    "cost_of_living_usd_monthly_no_rent",
    "avg_temp_celsius",
    "population_density_per_km2",
    "distance_from_pgh_miles",
    "hrmi_quality_of_life_score",
    "english_proficiency_ef_epi_2024",
    "program_duration_weeks",
]

DESCRIPTIVE_COLUMNS = ["program_name", "primary_city", "country", "notes"]

WIKI_SUMMARY_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/"
PLACEHOLDER_IMAGE = "https://via.placeholder.com/800x600.png?text=City+Image+Unavailable"

# Direct image overrides for cities whose default Wikipedia summary returns a
# non-photo (e.g. a flag) or an unrepresentative image.
CITY_IMAGE_OVERRIDES: dict[str, str] = {
    "Hong Kong": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/"
        "Hong_Kong_Skyline_View_From_The_Peak_2024-12-13.jpg/"
        "1280px-Hong_Kong_Skyline_View_From_The_Peak_2024-12-13.jpg"
    ),
}

# Per-city pros/cons. Keys must match `primary_city` in programs.csv exactly.
CITY_INFO: dict[str, dict[str, str]] = {
    "London": {
        "pro": "World-class museums (the British Museum, Tate, V&A) are free to enter.",
        "con": "Notoriously grey, drizzly weather and one of the priciest rental markets in Europe.",
    },
    "Florence": {
        "pro": "Walkable Renaissance city center where you can see the Duomo, Uffizi, and Ponte Vecchio in one afternoon.",
        "con": "Summer heat plus dense tour-group crowds make the historic center uncomfortable in peak months.",
    },
    "Sydney": {
        "pro": "Iconic harbor lifestyle with world-famous beaches like Bondi a short bus ride from downtown.",
        "con": "Extremely far from almost everywhere — a 20+ hour flight from Pittsburgh and very expensive groceries.",
    },
    "Amsterdam": {
        "pro": "Bike-first infrastructure makes the entire city accessible without ever stepping into a car.",
        "con": "Housing is severely constrained, so short-term student housing is scarce and overpriced.",
    },
    "Berlin": {
        "pro": "Unmatched modern history immersion — the Wall, Holocaust memorials, Cold War sites are all walkable.",
        "con": "Long, dark, cold winters with very short daylight hours from November through February.",
    },
    "Madrid": {
        "pro": "Late-night culture: world-class tapas and nightlife that doesn’t really start until 10pm.",
        "con": "Brutal summer heat — temperatures regularly exceed 35°C (95°F) in July and August.",
    },
    "Nicosia": {
        "pro": "Last divided capital in Europe — uniquely lets you cross between EU and non-EU territory on foot.",
        "con": "Limited international flight connections; you’ll usually connect via Athens or Istanbul.",
    },
    "Bilbao": {
        "pro": "Home of the Guggenheim and gateway to Basque cuisine (pintxos) that locals consider Spain’s best.",
        "con": "Frequent rain year-round — one of the wettest major cities in Spain.",
    },
    "Munich": {
        "pro": "Cleanest, safest, and most efficient public transit of any major German city, plus the Alps are 1 hour away.",
        "con": "Highest cost of living in Germany; rent and dining are noticeably more expensive than Berlin.",
    },
    "Prague": {
        "pro": "Stunning preserved medieval architecture at some of the lowest prices in the EU.",
        "con": "Old Town is overrun with tourists and stag parties, which can drown out local culture.",
    },
    "Graz": {
        "pro": "Compact UNESCO old town with a real student culture — roughly 1 in 5 residents is a university student.",
        "con": "Limited international visibility means fewer English-speaking events and a steeper German barrier.",
    },
    "Barcelona": {
        "pro": "Beach + mountains + Gaudí architecture in a single Mediterranean city — rare combination globally.",
        "con": "Pickpocketing on metros and Las Ramblas is among the worst in Europe.",
    },
    "Beijing": {
        "pro": "Direct access to the Great Wall, Forbidden City, and 3,000 years of imperial history.",
        "con": "Air quality can be hazardous in winter, and the Great Firewall blocks Google, Instagram, WhatsApp, etc.",
    },
    "Basel": {
        "pro": "Trinational location — you can be in Germany or France within a 15-minute tram ride.",
        "con": "Switzerland is the most expensive country in the world; a basic restaurant meal often exceeds $30.",
    },
    "Mussoorie": {
        "pro": "Himalayan foothill setting with sweeping mountain views and a slower, cooler escape from the Indian plains.",
        "con": "Limited medical infrastructure and frequent monsoon landslides can disrupt travel into and out of town.",
    },
    "Paris": {
        "pro": "Arguably the densest concentration of world-class art, food, and architecture on the planet.",
        "con": "Very crowded, can feel unwelcoming to non-French speakers, and pricey for cafés and groceries.",
    },
    "Belfast": {
        "pro": "Compact, friendly city with the Titanic Quarter and easy day trips to the Giant’s Causeway.",
        "con": "Lingering sectarian murals and peace walls are a reminder that political tensions are still recent.",
    },
    "Dublin": {
        "pro": "English-speaking, deeply pub-centric culture with a strong literary heritage (Joyce, Yeats, Beckett).",
        "con": "Dublin rents are now among the highest in Europe and the weather is famously wet and grey.",
    },
    "Seoul": {
        "pro": "Best public transit and 24/7 city services of almost any global capital — including all-night cafés and food.",
        "con": "Brutally competitive academic and work culture, plus long, polluted yellow-dust springs.",
    },
    "Stockholm": {
        "pro": "Spread across 14 islands — a uniquely beautiful archipelago city with excellent design culture.",
        "con": "Winters bring as little as 6 hours of daylight, and almost everything (especially alcohol) is heavily taxed.",
    },
    "Kobe": {
        "pro": "Coastal Japanese city with mountains directly behind it; famous for beef and a relaxed pace vs. Tokyo.",
        "con": "Earthquake-prone (still rebuilding cultural memory of 1995) and fairly expensive for Japan.",
    },
    "Arusha": {
        "pro": "Gateway to Mt. Kilimanjaro and the Serengeti — unrivaled access to East African wildlife.",
        "con": "Limited healthcare infrastructure and you must take malaria prophylaxis for the whole stay.",
    },
    "Auckland": {
        "pro": "Surrounded by water and volcanoes, with world-class hiking and beaches inside city limits.",
        "con": "Most isolated major city on Earth — flights anywhere outside Oceania take 12+ hours.",
    },
    "Cape Town": {
        "pro": "Table Mountain + two oceans + wine country make it one of the most scenic cities on Earth.",
        "con": "High violent crime rates and rolling power cuts (load-shedding) can disrupt daily life.",
    },
    "Buenos Aires": {
        "pro": "Vibrant European-feeling capital with world-class steakhouses, tango, and an extremely cheap dollar.",
        "con": "Hyperinflation makes daily prices unstable and ATMs are unreliable for foreigners.",
    },
    "Dakar": {
        "pro": "Atlantic-facing capital with a thriving music scene and one of West Africa’s safest big cities.",
        "con": "Heavy traffic, limited English usage outside hotels, and intense midday heat year-round.",
    },
    "Rome": {
        "pro": "Living museum — you literally walk past 2,000-year-old ruins on the way to the grocery store.",
        "con": "Public transit is unreliable, taxi scams target tourists, and August heat empties the city.",
    },
    "Athens": {
        "pro": "Birthplace of Western philosophy and democracy; the Acropolis is visible from much of the city.",
        "con": "Air pollution and graffiti are widespread, and many central neighborhoods feel run-down.",
    },
    "Cochabamba": {
        "pro": "Famous for the best food in Bolivia and a mild year-round spring-like climate at 8,400 ft.",
        "con": "High altitude takes 1–2 weeks to acclimate to, and water/sanitation infrastructure is limited.",
    },
    "Reykjavik": {
        "pro": "Northern Lights, geothermal lagoons, and dramatic volcanic landscapes within a 30-minute drive.",
        "con": "Only ~4 hours of daylight in deep winter, and food/alcohol prices are among the highest in the world.",
    },
    "Lisbon": {
        "pro": "Sunniest capital in Europe with affordable seafood, surfing beaches, and beautiful azulejo-tiled streets.",
        "con": "Very steep, hilly cobblestone streets are exhausting daily and rough on luggage and ankles.",
    },
    "Hong Kong": {
        "pro": "Densest, most vertical city skyline on Earth with 24/7 dim sum and easy hikes minutes from skyscrapers.",
        "con": "Extreme summer humidity, tiny apartments, and increasing political restrictions on speech.",
    },
    "San Juan": {
        "pro": "U.S. territory (no passport required) with Caribbean beaches and historic Old San Juan forts.",
        "con": "Hurricane season (June–November) can disrupt travel, and the power grid is fragile.",
    },
    "Brussels": {
        "pro": "Capital of the EU — unmatched access to European institutions, plus chocolate, waffles, and 1,000+ beers.",
        "con": "Often described as grey and bureaucratic; weather is overcast for much of the year.",
    },
    "Quito": {
        "pro": "UNESCO-listed colonial old town sits at 9,350 ft on the equator — best-preserved historic center in the Americas.",
        "con": "Altitude sickness is common on arrival and petty theft in tourist areas is a constant concern.",
    },
}


def min_max_normalize(series: pd.Series) -> pd.Series:
    """Scale a numeric series to [0.0, 1.0]. Constant series collapse to 0.0."""
    minimum = series.min()
    maximum = series.max()
    spread = maximum - minimum
    if spread == 0:
        return pd.Series([0.0] * len(series), index=series.index)
    return (series - minimum) / spread


def fetch_city_image(city: str, country: str) -> str:
    """Return a Wikipedia thumbnail URL for the city, falling back to a placeholder."""
    if city in CITY_IMAGE_OVERRIDES:
        return CITY_IMAGE_OVERRIDES[city]
    candidates = [city.replace(" ", "_"), f"{city.replace(' ', '_')},_{country.replace(' ', '_')}"]
    for candidate in candidates:
        url = WIKI_SUMMARY_ENDPOINT + urllib.parse.quote(candidate, safe="_")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "pitty-games-normalizer/1.0 (educational use)"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue
        original = (payload.get("originalimage") or {}).get("source")
        if original:
            return original
        thumb = (payload.get("thumbnail") or {}).get("source")
        if thumb:
            return thumb
    return PLACEHOLDER_IMAGE


def main() -> None:
    df = pd.read_csv(INPUT_CSV)

    df["english_proficiency_ef_epi_2024"] = (
        df["english_proficiency_ef_epi_2024"]
        .replace("Native", NATIVE_ENGLISH_SCORE)
        .astype(float)
    )

    for column in NUMERIC_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="raise")

    normalized = pd.DataFrame(index=df.index)
    for column in NUMERIC_COLUMNS:
        normalized[column] = min_max_normalize(df[column]).round(6)

    df["notes"] = df["notes"].fillna("")

    image_cache: dict[str, str] = {}
    records = []
    for idx, row in df.iterrows():
        city = row["primary_city"]
        country = row["country"]

        if city not in image_cache:
            image_cache[city] = fetch_city_image(city, country)
            print(f"  image for {city}: {image_cache[city][:90]}")

        info = CITY_INFO.get(city, {"pro": "", "con": ""})
        if not info["pro"] or not info["con"]:
            print(f"  WARNING: missing pro/con for {city}")

        normalized_values = {col: float(normalized.at[idx, col]) for col in NUMERIC_COLUMNS}
        record = {
            "program_name": row["program_name"],
            "primary_city": city,
            "country": country,
            "notes": row["notes"],
            "image_url": image_cache[city],
            "pro_text": info["pro"],
            "con_text": info["con"],
            "raw": {col: float(row[col]) for col in NUMERIC_COLUMNS},
            "normalized": normalized_values,
            "feature_vector": [normalized_values[col] for col in NUMERIC_COLUMNS],
        }
        records.append(record)

    payload = {
        "feature_order": NUMERIC_COLUMNS,
        "programs": records,
    }

    OUTPUT_JSON.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {len(records)} programs to {OUTPUT_JSON.name}")


if __name__ == "__main__":
    main()
