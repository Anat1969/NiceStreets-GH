#!/usr/bin/env node
/**
 * Turns the municipal GIS layers into the shape lib/city.ts expects.
 *
 *   node scripts/import-gis.mjs quarters.geojson streets.geojson > lib/city-data.json
 *
 * Expected properties (rename with the maps below if the city layer differs):
 *   quarters: name
 *   streets:  name, quarter, typology, row_width_m, canopy_pct, intersection_m
 *
 * The output is a JSON file you paste into lib/city.ts (QUARTERS / SEED_STREETS)
 * or load from disk. Every imported street is marked verified: true.
 */

import { readFileSync } from "node:fs";

const QUARTER_FIELD = { name: "name" };
const STREET_FIELD = {
  name: "name",
  quarter: "quarter",
  typology: "typology",
  rowWidth: "row_width_m",
  canopy: "canopy_pct",
  intersection: "intersection_m",
};

const TYPOLOGIES = new Set([
  "neighborhood_commercial",
  "main_commercial",
  "residential",
  "boulevard",
  "pedestrian_mall",
  "linear_park",
]);

function read(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (data.type !== "FeatureCollection") {
    throw new Error(`${path}: expected a GeoJSON FeatureCollection`);
  }
  return data.features;
}

function slug(value, index) {
  const clean = String(value ?? "")
    .trim()
    .replace(/\s+/g, "-");
  return clean ? `${clean}-${index}` : `item-${index}`;
}

function centroid(ring) {
  const sum = ring.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

const [quartersPath, streetsPath] = process.argv.slice(2);
if (!quartersPath || !streetsPath) {
  console.error("usage: import-gis.mjs <quarters.geojson> <streets.geojson>");
  process.exit(1);
}

const quarterIdByName = new Map();
const quarters = read(quartersPath).map((feature, index) => {
  const name = feature.properties?.[QUARTER_FIELD.name];
  const ring =
    feature.geometry?.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry?.coordinates?.[0]?.[0];
  if (!ring) throw new Error(`quarter ${index}: unsupported geometry`);
  const id = `q-${slug(name, index)}`;
  quarterIdByName.set(String(name).trim(), id);
  return { id, name: String(name), polygon: ring, center: centroid(ring), schematic: false };
});

const warnings = [];
const streets = read(streetsPath).map((feature, index) => {
  const props = feature.properties ?? {};
  const name = String(props[STREET_FIELD.name] ?? "").trim();
  const quarterName = String(props[STREET_FIELD.quarter] ?? "").trim();
  const quarterId = quarterIdByName.get(quarterName);
  const typology = String(props[STREET_FIELD.typology] ?? "residential");

  if (!quarterId) warnings.push(`street "${name}": unknown quarter "${quarterName}"`);
  if (!TYPOLOGIES.has(typology)) warnings.push(`street "${name}": unknown typology "${typology}"`);

  const line =
    feature.geometry?.type === "LineString"
      ? feature.geometry.coordinates
      : feature.geometry?.coordinates?.flat?.() ?? null;

  const gis = {};
  if (props[STREET_FIELD.rowWidth] != null) gis.rowWidthM = Number(props[STREET_FIELD.rowWidth]);
  if (props[STREET_FIELD.canopy] != null) gis.canopyPct = Number(props[STREET_FIELD.canopy]);
  if (props[STREET_FIELD.intersection] != null) {
    gis.intersectionDistanceM = Number(props[STREET_FIELD.intersection]);
  }

  return {
    id: `s-${slug(name, index)}`,
    name,
    quarterId: quarterId ?? "",
    typology: TYPOLOGIES.has(typology) ? typology : "residential",
    line,
    gis: Object.keys(gis).length ? gis : undefined,
    verified: true,
  };
});

if (warnings.length) {
  console.error(`${warnings.length} warnings:`);
  warnings.slice(0, 20).forEach((w) => console.error(`  ${w}`));
}

process.stdout.write(JSON.stringify({ quarters, streets }, null, 2));
