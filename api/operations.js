// API unificada para operaciones
export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { action } = req.query;

    try {
        if (action === 'create' && req.method === 'POST') {
            // POST /api/operations?action=create
            return res.status(200).json({ success: true, message: 'Operation created' });
        }
        
        if (action === 'list' && req.method === 'GET') {
            // GET /api/operations?action=list
            return res.status(200).json({ success: true, operations: [] });
        }
        
        if (action === 'update' && req.method === 'PUT') {
            // PUT /api/operations?action=update
            return res.status(200).json({ success: true, message: 'Operation updated' });
        }
        
        if (action === 'delete' && req.method === 'DELETE') {
            // DELETE /api/operations?action=delete
            return res.status(200).json({ success: true, message: 'Operation deleted' });
        }

        return res.status(400).json({ error: 'Invalid action or method' });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
