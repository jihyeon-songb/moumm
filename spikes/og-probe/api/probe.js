// Vercel serverless function: GET /api/probe?url=<instagram link>
// Returns what this server (datacenter IP) can read from the link's og meta.
import { probe, egressInfo } from '../lib/probe.js';

export default async function handler(req, res) {
  const token = process.env.PROBE_TOKEN;
  const given = req.headers['x-probe-token'] ?? req.query.token;
  if (token && given !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Pass an Instagram post or reel link as ?url=' });
  }

  // probe() only fetches instagram.com hosts, so this endpoint can't be used as an open proxy.
  const result = await probe(url);
  result.server = { region: process.env.VERCEL_REGION ?? null, ...(await egressInfo()) };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(result);
}
