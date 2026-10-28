// Queries are deliberately scoped to a trusted service-area identifier. The
// server must authorise the officer and select that identifier before calling.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function areaId(value) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new TypeError('Invalid service area.');
  return value;
}

function position(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new TypeError('Invalid location.');
}

export async function nearbyVerifiedAssets(pool, {area, latitude, longitude, radiusMetres = 500}) {
  areaId(area); position(latitude, longitude);
  if (!Number.isFinite(radiusMetres) || radiusMetres < 1 || radiusMetres > 10000) throw new TypeError('Invalid radius.');
  const {rows} = await pool.query('select * from public.fmc_find_nearby_assets($1::uuid,$2::float8,$3::float8,$4::float8)',
    [area, latitude, longitude, radiusMetres]);
  return rows.map(row => ({assetId: row.asset_id, assetType: row.asset_type,
    ownerName: row.owner_name, distanceMetres: Number(row.distance_metres)}));
}

export async function relevantApprovedContext(pool, {area, embedding, limit = 5}) {
  areaId(area);
  if (!Array.isArray(embedding) || embedding.length !== 384 || embedding.some(n => !Number.isFinite(n)))
    throw new TypeError('Expected a 384-dimensional embedding.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new TypeError('Invalid match count.');
  // Parameter binding prevents vector values from becoming executable SQL.
  const vector = `[${embedding.join(',')}]`;
  const {rows} = await pool.query('select * from public.fmc_match_reviewed_context($1::uuid,$2::extensions.vector,$3::integer)',
    [area, vector, limit]);
  return rows.map(row => ({id: row.document_id, title: row.title, text: row.body,
    similarity: Number(row.similarity)}));
}
