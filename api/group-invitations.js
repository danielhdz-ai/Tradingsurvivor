// =====================================================
// GROUP INVITATIONS API
// Endpoints para gestión de invitaciones a grupos
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Validar variables de entorno
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ 
            error: 'Configuración de Supabase no encontrada' 
        });
    }

    // Obtener token de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Token de autorización requerido' 
        });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return res.status(401).json({ 
            error: 'Usuario no autenticado' 
        });
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res, supabase, user);
            case 'POST':
                return await handlePost(req, res, supabase, user);
            case 'PUT':
                return await handlePut(req, res, supabase, user);
            case 'DELETE':
                return await handleDelete(req, res, supabase, user);
            default:
                return res.status(405).json({ 
                    error: 'Método no permitido' 
                });
        }
    } catch (error) {
        console.error('Error en group-invitations:', error);
        return res.status(500).json({ 
            error: error.message || 'Error interno del servidor' 
        });
    }
}

// GET: Obtener invitaciones
async function handleGet(req, res, supabase, user) {
    const { type, group_id, token } = req.query;

    // GET por token específico
    if (token) {
        const { data, error } = await supabase
            .from('group_invitations')
            .select(`
                *,
                group:trading_groups(id, name, description, emoji),
                inviter:invited_by(email, raw_user_meta_data)
            `)
            .eq('invitation_token', token)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        return res.status(200).json(data);
    }

    // GET invitaciones recibidas por el usuario
    if (type === 'received') {
        const { data, error } = await supabase
            .from('group_invitations')
            .select(`
                *,
                group:trading_groups(id, name, description, emoji),
                inviter:invited_by(email, raw_user_meta_data)
            `)
            .or(`invited_user_id.eq.${user.id},invited_email.eq.${user.email}`)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
    }

    // GET invitaciones de un grupo específico
    if (group_id) {
        const { data, error } = await supabase
            .from('group_invitations')
            .select(`
                *,
                inviter:invited_by(email, raw_user_meta_data),
                invitee:invited_user_id(email, raw_user_meta_data)
            `)
            .eq('group_id', group_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
    }

    // GET todas las invitaciones enviadas por el usuario
    const { data, error } = await supabase
        .from('group_invitations')
        .select(`
            *,
            group:trading_groups(id, name, description, emoji),
            invitee:invited_user_id(email, raw_user_meta_data)
        `)
        .eq('invited_by', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
}

// POST: Crear nueva invitación
async function handlePost(req, res, supabase, user) {
    const { group_id, invited_email, invited_user_id, expiry_hours } = req.body;

    if (!group_id) {
        return res.status(400).json({ 
            error: 'group_id es requerido' 
        });
    }

    if (!invited_email && !invited_user_id) {
        return res.status(400).json({ 
            error: 'Debe especificar invited_email o invited_user_id' 
        });
    }

    // Verificar que el usuario no es ya miembro
    if (invited_user_id) {
        const { data: existingMember } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group_id)
            .eq('user_id', invited_user_id)
            .single();

        if (existingMember) {
            return res.status(400).json({ 
                error: 'El usuario ya es miembro del grupo' 
            });
        }
    }

    // Verificar si ya existe una invitación pendiente
    let existingQuery = supabase
        .from('group_invitations')
        .select('id')
        .eq('group_id', group_id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

    if (invited_user_id) {
        existingQuery = existingQuery.eq('invited_user_id', invited_user_id);
    } else if (invited_email) {
        existingQuery = existingQuery.eq('invited_email', invited_email);
    }

    const { data: existingInvite } = await existingQuery.single();

    if (existingInvite) {
        return res.status(400).json({ 
            error: 'Ya existe una invitación pendiente para este usuario' 
        });
    }

    // Crear la invitación usando la función SQL
    const { data, error } = await supabase.rpc('create_group_invitation', {
        p_group_id: group_id,
        p_invited_email: invited_email || null,
        p_invited_user_id: invited_user_id || null,
        p_expiry_hours: expiry_hours || 168 // 7 días por defecto
    });

    if (error) {
        console.error('Error creando invitación:', error);
        return res.status(400).json({ 
            error: error.message || 'Error al crear invitación' 
        });
    }

    // Obtener la invitación creada con todos sus datos
    const { data: invitation, error: fetchError } = await supabase
        .from('group_invitations')
        .select(`
            *,
            group:trading_groups(id, name, description, emoji)
        `)
        .eq('id', data)
        .single();

    if (fetchError) throw fetchError;

    return res.status(201).json(invitation);
}

// PUT: Aceptar o rechazar invitación
async function handlePut(req, res, supabase, user) {
    const { token, action } = req.body;

    if (!token) {
        return res.status(400).json({ 
            error: 'token es requerido' 
        });
    }

    if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ 
            error: 'action debe ser "accept" o "reject"' 
        });
    }

    let result;
    let error;

    if (action === 'accept') {
        ({ data: result, error } = await supabase.rpc('accept_group_invitation', {
            p_token: token
        }));
    } else {
        ({ data: result, error } = await supabase.rpc('reject_group_invitation', {
            p_token: token
        }));
    }

    if (error) {
        console.error(`Error al ${action} invitación:`, error);
        return res.status(400).json({ 
            error: error.message || `Error al ${action === 'accept' ? 'aceptar' : 'rechazar'} invitación` 
        });
    }

    return res.status(200).json({ 
        success: true,
        action: action,
        message: action === 'accept' ? 'Invitación aceptada' : 'Invitación rechazada'
    });
}

// DELETE: Cancelar/revocar invitación
async function handleDelete(req, res, supabase, user) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ 
            error: 'ID de invitación es requerido' 
        });
    }

    const { error } = await supabase
        .from('group_invitations')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error eliminando invitación:', error);
        return res.status(400).json({ 
            error: error.message || 'Error al eliminar invitación' 
        });
    }

    return res.status(200).json({ 
        success: true,
        message: 'Invitación eliminada' 
    });
}
