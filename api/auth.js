export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const serverPassword = process.env.GAME_PASSWORD;

  if (!serverPassword) {
    return res.status(500).json({ error: 'Server GAME_PASSWORD environment variable is not configured.' });
  }

  if (password === serverPassword) {
    return res.status(200).json({ authenticated: true });
  } else {
    return res.status(401).json({ error: 'Invalid dive authorization code.' });
  }
}
