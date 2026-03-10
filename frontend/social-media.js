/**
 * SOCIAL MEDIA MODULE
 * Sistema de seguimiento, feed de actividad y grupos privados
 * Trading Survivor Platform
 */

console.log('🚀 [SOCIAL-MEDIA.JS] Iniciando carga del módulo...');

// ==========================================
// UTILITIES
// ==========================================
function showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Usar showToast si está disponible en la plataforma
    if (typeof window.showToast === 'function') {
        const title = type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Info';
        window.showToast(title, message, type);
    }
}

console.log('✅ [SOCIAL-MEDIA.JS] Utilidades cargadas');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
// Acceso a currentUser desde window (definido en platform.html)
const getCurrentUser = () => window.currentUser || null;
let currentActiveGroup = null;
let groupMessagesListener = null;
let currentSocialTab = 'ranking';
let followingList = [];
let myGroups = [];
let invitationsFeatureEnabled = false; // Se detectará automáticamente

// Variables para paginación de mensajes
let messagesOffset = 0;
const MESSAGES_PAGE_SIZE = 30;
let hasMoreMessages = true;

// ==========================================
// SISTEMA DE CACHÉ (Reduce 70-80% uso de datos)
// ==========================================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const dataCache = {
    groups: { data: null, timestamp: 0 },
    messages: {},
    following: { data: null, timestamp: 0 },
    activity: { data: null, timestamp: 0 }
};

function isCacheValid(cacheKey) {
    const cache = dataCache[cacheKey];
    return cache && cache.data && (Date.now() - cache.timestamp) < CACHE_TTL;
}

function setCache(cacheKey, data) {
    dataCache[cacheKey] = { data, timestamp: Date.now() };
}

function getCache(cacheKey) {
    return isCacheValid(cacheKey) ? dataCache[cacheKey].data : null;
}

function clearCache(cacheKey = null) {
    if (cacheKey) {
        dataCache[cacheKey] = { data: null, timestamp: 0 };
    } else {
        Object.keys(dataCache).forEach(key => {
            if (typeof dataCache[key] === 'object' && !Array.isArray(dataCache[key])) {
                dataCache[key] = { data: null, timestamp: 0 };
            }
        });
    }
}

console.log('✅ [SOCIAL-MEDIA.JS] Variables globales cargadas');

// ==========================================
// VERIFICACIÓN DE FEATURES
// ==========================================
async function checkInvitationsFeature() {
    try {
        // Intentar una query simple a la tabla de invitaciones
        const { data, error } = await supabase
            .from('group_invitations')
            .select('id')
            .limit(1);
        
        if (error) {
            // Si hay error, las tablas no existen
            invitationsFeatureEnabled = false;
            return false;
        }
        
        invitationsFeatureEnabled = true;
        return true;
    } catch (error) {
        invitationsFeatureEnabled = false;
        return false;
    }
}

console.log('✅ [SOCIAL-MEDIA.JS] Funciones de verificación cargadas');

// Grupos demo (vacío - solo datos reales de Supabase)
const DEMO_GROUPS = [];

// ==========================================
// INICIALIZACIÓN
// ==========================================

async function initSocialMedia() {
    console.log('🌍 Inicializando Social Media Module...');
    
    // Prevenir doble inicialización
    if (window.socialMediaModuleInitialized) {
        console.log('⚠️ Módulo ya inicializado, saltando...');
        return;
    }
    
    // Datos demo eliminados - usando solo datos reales de Supabase
    console.log('✅ Modo producción: Solo datos reales de Supabase');
    
    // Event listeners para las pestañas
    document.querySelectorAll('.social-tab').forEach(tab => {
        tab.addEventListener('click', () => switchSocialTab(tab.dataset.tab));
    });

    // Event listeners para crear grupo
    document.getElementById('create-group-btn')?.addEventListener('click', openCreateGroupModal);
    document.getElementById('close-create-group-modal')?.addEventListener('click', closeCreateGroupModal);
    document.getElementById('cancel-create-group')?.addEventListener('click', closeCreateGroupModal);
    document.getElementById('confirm-create-group')?.addEventListener('click', createGroup);

    // Event listeners para chat
    const sendBtn = document.getElementById('send-message-btn');
    const attachBtn = document.getElementById('attach-image-btn');
    const imageInput = document.getElementById('group-image-input');
    const removeBtn = document.getElementById('remove-image-preview');
    const messageInput = document.getElementById('group-message-input');
    
    console.log('🔗 Configurando event listeners de chat:');
    console.log('  - Botón enviar:', sendBtn ? '✅' : '❌');
    console.log('  - Botón adjuntar:', attachBtn ? '✅' : '❌');
    console.log('  - Input imagen:', imageInput ? '✅' : '❌');
    console.log('  - Botón remover:', removeBtn ? '✅' : '❌');
    console.log('  - Input mensaje:', messageInput ? '✅' : '❌');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendGroupMessage);
        console.log('  ✅ Event listener agregado a botón enviar');
    }
    
    if (attachBtn && imageInput) {
        attachBtn.addEventListener('click', () => {
            console.log('📎 Click en botón adjuntar');
            imageInput.click();
        });
        console.log('  ✅ Event listener agregado a botón adjuntar');
    }
    
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelect);
        console.log('  ✅ Event listener agregado a input imagen');
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', removeImagePreview);
        console.log('  ✅ Event listener agregado a botón remover');
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGroupMessage();
            }
        });
        console.log('  ✅ Event listener agregado a input mensaje (Enter)');
    }

    // Event listeners para info de grupo
    document.getElementById('group-info-btn')?.addEventListener('click', openGroupInfoModal);
    document.getElementById('group-settings-btn')?.addEventListener('click', openGroupSettingsModal);
    document.getElementById('close-group-info-modal')?.addEventListener('click', closeGroupInfoModal);
    document.getElementById('leave-group-btn')?.addEventListener('click', leaveGroup);

    // Event listeners para configuración de grupo
    document.getElementById('close-group-settings-modal')?.addEventListener('click', closeGroupSettingsModal);
    document.getElementById('close-settings-modal-btn')?.addEventListener('click', closeGroupSettingsModal);
    document.getElementById('search-ranking-btn')?.addEventListener('click', searchRankingTraders);
    document.getElementById('delete-group-btn')?.addEventListener('click', deleteGroup);
    
    // Buscar al presionar Enter
    document.getElementById('search-ranking-username')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchRankingTraders();
    });

    // Verificar si la feature de invitaciones está disponible
    const invitationsAvailable = await checkInvitationsFeature();
    
    if (invitationsAvailable) {
        // Event listeners para invitaciones de grupo
        document.getElementById('group-invite-btn')?.addEventListener('click', openInviteGroupModal);
        document.getElementById('close-invite-modal')?.addEventListener('click', closeInviteGroupModal);
        document.getElementById('send-invite-btn')?.addEventListener('click', sendGroupInvite);
        document.getElementById('copy-invite-link-btn')?.addEventListener('click', copyInviteLink);
    } else {
        // Ocultar botones de invitación si no están disponibles
        const inviteBtn = document.getElementById('group-invite-btn');
        if (inviteBtn) inviteBtn.style.display = 'none';
    }

    // Buscar grupos
    document.getElementById('search-groups-input')?.addEventListener('input', searchPublicGroups);

    // Cargar datos iniciales
    console.log('📊 Cargando datos iniciales de social media...');
    await loadFollowingList();
    await loadMyGroups();
    await loadPublicGroups();
    
    console.log('✅ Social Media Module inicializado completamente');
}

// ==========================================
// GESTIÓN DE PESTAÑAS
// ==========================================

function switchSocialTab(tabName) {
    currentSocialTab = tabName;
    
    // Actualizar pestañas activas
    document.querySelectorAll('.social-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Mostrar contenido correspondiente
    document.querySelectorAll('.social-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(`social-content-${tabName}`).style.display = 'block';

    // Cargar datos según la pestaña
    if (tabName === 'following') {
        loadActivityFeed();
    } else if (tabName === 'groups') {
        loadMyGroups();
        loadPublicGroups();
    }
}

// ==========================================
// SISTEMA DE SEGUIMIENTO
// ==========================================

async function followTrader(traderId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }
        
        const { data, error } = await supabase
            .from('user_follows')
            .insert([
                {
                    follower_id: currentUser.id,
                    following_id: traderId
                }
            ]);

        if (error) throw error;

        showNotification('✅ Ahora sigues a este trader', 'success');
        await loadFollowingList();
        
        // Actualizar botón visualmente
        updateFollowButton(traderId, true);
        
    } catch (error) {
        console.error('Error siguiendo trader:', error);
        showNotification('❌ Error al seguir trader', 'error');
    }
}

async function unfollowTrader(traderId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }
        
        const { data, error } = await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', currentUser.id)
            .eq('following_id', traderId);

        if (error) throw error;

        showNotification('✅ Dejaste de seguir a este trader', 'success');
        await loadFollowingList();
        
        // Actualizar botón visualmente
        updateFollowButton(traderId, false);
        
    } catch (error) {
        console.error('Error dejando de seguir:', error);
        showNotification('❌ Error al dejar de seguir', 'error');
    }
}

function updateFollowButton(traderId, isFollowing) {
    const btn = document.querySelector(`[data-trader-id="${traderId}"]`);
    if (!btn) return;

    if (isFollowing) {
        btn.classList.add('following');
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Siguiendo';
    } else {
        btn.classList.remove('following');
        btn.innerHTML = '<i class="fas fa-user-plus mr-1"></i>Seguir';
    }
}

async function loadFollowingList() {
    console.log('👥 loadFollowingList() iniciada');
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            console.warn('⚠️ No hay usuario logueado');
            followingList = [];
            renderFollowingList();
            return;
        }

        // Solo cargar traders reales (datos demo eliminados)
        console.log('📋 Cargando solo traders reales de Supabase...');

        // Cargar traders reales de Supabase
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select('following_id, created_at')
                .eq('follower_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                followingList = data;
            } else {
                followingList = [];
            }
        } catch (error) {
            console.error('Error cargando follows:', error);
            followingList = [];
        }
        console.log('📊 Total traders seguidos:', followingList.length);
        renderFollowingList();
        
        // Actualizar contador
        const countElement = document.getElementById('following-count');
        if (countElement) {
            countElement.textContent = followingList.length;
        }

    } catch (error) {
        console.error('❌ Error cargando lista de seguidos:', error);
    }
}

function renderFollowingList() {
    const container = document.getElementById('following-list');
    if (!container) return;

    if (followingList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-text-secondary">
                <i class="fas fa-user-plus text-4xl mb-3 opacity-50"></i>
                <p class="text-sm">No sigues a ningún trader aún</p>
                <p class="text-xs mt-2">Ve al Ranking y sigue a traders interesantes</p>
            </div>
        `;
        return;
    }

    container.innerHTML = followingList.map(follow => {
        const trader = follow.following;
        const displayName = trader.raw_user_meta_data?.display_name || trader.email.split('@')[0];
        const avatar = trader.raw_user_meta_data?.avatar_url || displayName.charAt(0).toUpperCase();
        const country = trader.raw_user_meta_data?.country || '🌍';

        return `
            <div class="trader-following-card" onclick="viewTraderProfile('${trader.id}')">
                <div class="trader-following-avatar">
                    ${avatar.startsWith('http') ? `<img src="${avatar}" alt="${displayName}">` : avatar}
                </div>
                <div class="flex-1">
                    <div class="font-semibold text-sm">${displayName}</div>
                    <div class="text-xs text-text-secondary">${country}</div>
                </div>
                <button 
                    class="follow-btn following" 
                    data-trader-id="${trader.id}"
                    onclick="event.stopPropagation(); unfollowTrader('${trader.id}')"
                >
                    <i class="fas fa-check mr-1"></i>Siguiendo
                </button>
            </div>
        `;
    }).join('');
}

// ==========================================
// FEED DE ACTIVIDAD
// ==========================================

async function loadActivityFeed() {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            renderEmptyActivityFeed();
            return;
        }

        // Solo actividades reales (datos demo eliminados)
        console.log('📋 Cargando solo actividades reales de Supabase...');

        // Obtener IDs de traders reales que sigo
        const followingIds = followingList.map(f => f.following_id);
        let realActivities = [];
        
        if (followingIds.length > 0) {
            try {
                // ✅ OPTIMIZADO: Usar caché y solo campos necesarios
                const cached = getCache('activity');
                
                if (cached) {
                    realActivities = cached;
                } else {
                    const { data, error } = await supabase
                        .from('user_activity')
                        .select('id, user_id, activity_type, activity_data, created_at')
                        .in('user_id', followingIds)
                        .order('created_at', { ascending: false })
                        .limit(20);  // ✅ Reducido de 50 a 20

                    if (!error && data) {
                        realActivities = data;
                        setCache('activity', realActivities);
                    }
                }
            } catch (error) {
                console.error('Error cargando actividades:', error);
            }
        }

        if (realActivities.length === 0) {
            renderEmptyActivityFeed();
            return;
        }

        renderActivityFeed(realActivities);

    } catch (error) {
        renderEmptyActivityFeed();
    }
}

function renderActivityFeed(activities) {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    if (activities.length === 0) {
        renderEmptyActivityFeed();
        return;
    }

    container.innerHTML = activities.map(activity => {
        const user = activity.user;
        const displayName = user.raw_user_meta_data?.display_name || user.email.split('@')[0];
        const avatar = user.raw_user_meta_data?.avatar_url || displayName.charAt(0).toUpperCase();
        const timeAgo = getTimeAgo(new Date(activity.created_at));

        return renderActivityItem(activity, displayName, avatar, timeAgo);
    }).join('');
}

function renderActivityItem(activity, displayName, avatar, timeAgo) {
    const data = activity.activity_data || activity.data;

    if (activity.activity_type === 'trade') {
        const pnlColor = data.pnl >= 0 ? 'text-green' : 'text-red';
        const pnlIcon = data.pnl >= 0 ? '📈' : '📉';
        
        return `
            <div class="activity-item">
                <div class="activity-header">
                    <div class="activity-avatar">
                        ${avatar.startsWith('http') ? `<img src="${avatar}" alt="${displayName}" class="w-full h-full object-cover rounded-full">` : avatar}
                    </div>
                    <div class="flex-1">
                        <div class="font-semibold text-sm">${displayName}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                    <div class="text-xl">${pnlIcon}</div>
                </div>
                <div class="activity-trade-card">
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-bold text-lg">${data.symbol}</div>
                        <div class="font-bold ${pnlColor}">${formatCurrency(data.pnl, data.currency || 'USD')}</div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        <div>
                            <div class="text-text-secondary">Tipo</div>
                            <div class="font-semibold">${data.type === 'long' ? '📈 Long' : '📉 Short'}</div>
                        </div>
                        <div>
                            <div class="text-text-secondary">Entrada</div>
                            <div class="font-semibold">${data.entry_price}</div>
                        </div>
                        <div>
                            <div class="text-text-secondary">Salida</div>
                            <div class="font-semibold">${data.exit_price}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return '';
}

function renderEmptyActivityFeed() {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12 text-text-secondary">
            <i class="fas fa-chart-line text-4xl mb-3 opacity-50"></i>
            <p class="text-sm">No hay actividad reciente</p>
            <p class="text-xs mt-2">Los trades de traders que sigas aparecerán aquí</p>
        </div>
    `;
}

// ==========================================
// GRUPOS PRIVADOS
// ==========================================

async function loadMyGroups() {
    console.log('📂 loadMyGroups() iniciada');
    try {
        const currentUser = getCurrentUser();
        console.log('👤 Current user:', currentUser);
        
        if (!currentUser) {
            console.warn('⚠️ No hay usuario logueado');
            myGroups = [];
            renderGroupsList();
            return;
        }

        // Solo cargar grupos reales de Supabase (datos demo eliminados)
        console.log('🔄 Cargando grupos reales de Supabase...');

        try {
            // ✅ OPTIMIZADO: Usar caché y solo campos necesarios
            let cachedGroups = getCache('groups');
            
            if (cachedGroups) {
                myGroups = cachedGroups;
                console.log('✅ Grupos cargados desde caché:', myGroups.length);
                renderGroupsList();
                return;
            }
            
            const { data, error } = await supabase
                .from('group_members')
                .select(`
                    id,
                    group_id,
                    role,
                    joined_at,
                    group:group_id (
                        id,
                        name,
                        description,
                        emoji,
                        privacy,
                        created_by
                    )
                `)
                .eq('user_id', currentUser.id)
                .order('joined_at', { ascending: false })
                .limit(50);  // ✅ Agregar límite

            if (!error && data) {
                myGroups = data.map(g => ({ ...g, is_demo: false }));
                setCache('groups', myGroups);  // ✅ Cachear grupos
                console.log('✅ Grupos reales cargados:', myGroups.length);
            } else {
                console.error('Error cargando grupos:', error);
                myGroups = [];
            }
        } catch (error) {
            console.error('❌ Error en query de grupos:', error);
            myGroups = [];
        }

        console.log('📋 Total grupos cargados:', myGroups.length);
        renderGroupsList();

    } catch (error) {
        console.error('❌ Error cargando grupos:', error);
    }
}

function renderGroupsList() {
    console.log('🎨 renderGroupsList() - Grupos a renderizar:', myGroups.length);
    const container = document.getElementById('groups-list');
    if (!container) {
        console.error('❌ Contenedor groups-list no encontrado');
        return;
    }

    if (myGroups.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-text-secondary text-sm">
                <i class="fas fa-users text-3xl mb-2 opacity-50"></i>
                <p class="text-xs">No tienes grupos aún</p>
            </div>
        `;
        return;
    }

    container.innerHTML = myGroups.map(membership => {
        const group = membership.group;
        const isActive = currentActiveGroup?.id === group.id;
        const currentUser = getCurrentUser();
        
        // Badge "Tuyo" para grupos que creaste
        const isOwner = currentUser && group.created_by === currentUser.id;
        const ownerBadge = isOwner 
            ? '<span class="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">Tuyo</span>' 
            : '';

        return `
            <div class="group-card ${isActive ? 'active' : ''}" onclick="selectGroup('${group.id}')">
                <div class="group-avatar">${group.emoji}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm truncate flex items-center">
                        ${group.name}
                        ${ownerBadge}
                    </div>
                    <div class="text-xs text-text-secondary truncate">${group.description || 'Sin descripción'}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function selectGroup(groupId) {
    try {
        // Reset paginación al cambiar de grupo
        messagesOffset = 0;
        hasMoreMessages = true;
        
        // Buscar el grupo en myGroups primero
        const membership = myGroups.find(m => 
            (m.group_id === groupId || m.group?.id === groupId || m.id === groupId)
        );

        let groupData;

        if (membership) {
            // Usar datos de la membresía (grupo real de Supabase)
            groupData = membership.group;
            if (!groupData) {
                // ✅ OPTIMIZADO: Solo campos necesarios
                const { data, error } = await supabase
                    .from('trading_groups')
                    .select('id, name, description, emoji, privacy, created_by, created_at')
                    .eq('id', membership.group_id)
                    .single();

                if (error) throw error;
                groupData = data;
            }
        } else {
            // ✅ OPTIMIZADO: Solo campos necesarios
            const { data, error } = await supabase
                .from('trading_groups')
                .select('id, name, description, emoji, privacy, created_by, created_at')
                .eq('id', groupId)
                .single();

            if (error) {
                console.error('Grupo no encontrado en Supabase:', error);
                showNotification('❌ Grupo no encontrado', 'error');
                return;
            }
            
            groupData = data;
        }

        currentActiveGroup = { ...groupData, group_id: groupData.id, is_demo: false };

        // Actualizar UI
        document.getElementById('no-group-selected').style.display = 'none';
        document.getElementById('group-chat-container').style.display = 'block';
        
        document.getElementById('group-chat-avatar').textContent = groupData.emoji;
        document.getElementById('group-chat-name').textContent = groupData.name;

        // Mostrar conteo de miembros
        const membersCount = await getGroupMembersCount(groupData.id);
        document.getElementById('group-chat-members').textContent = `${membersCount} miembros`;

        // Cargar mensajes desde Supabase
        await loadGroupMessages(groupData.id);
        
        // Suscribirse a nuevos mensajes en tiempo real
        subscribeToGroupMessages(groupData.id);

        // Resaltar grupo activo
        renderGroupsList();

    } catch (error) {
        console.error('Error seleccionando grupo:', error);
        showNotification('❌ Error al cargar el grupo', 'error');
    }
}

async function loadGroupMessages(groupId, limit = MESSAGES_PAGE_SIZE, isLoadMore = false) {
    try {
        // ✅ OPTIMIZADO: Usar caché por grupo (solo para carga inicial)
        if (!isLoadMore) {
            const cacheKey = `messages_${groupId}`;
            let cachedMessages = dataCache.messages[groupId]?.data;
            
            if (cachedMessages && (Date.now() - dataCache.messages[groupId].timestamp) < CACHE_TTL) {
                console.log('📦 Mensajes cargados desde caché');
                renderGroupMessages(cachedMessages, false);
                return;
            }
        }
        
        // Cargar solo campos necesarios con offset
        const { data: messages, error } = await supabase
            .from('group_messages')
            .select('id, group_id, user_id, message, image_url, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })  // ✅ Orden descendente para paginación
            .range(messagesOffset, messagesOffset + limit - 1);

        if (error) throw error;

        if (!messages || messages.length === 0) {
            if (!isLoadMore) {
                console.log('ℹ️ No hay mensajes en este grupo');
                renderGroupMessages([], false);
            }
            hasMoreMessages = false;
            return;
        }

        // Actualizar offset y flag de "hay más"
        messagesOffset += messages.length;
        hasMoreMessages = messages.length === limit;

        // Revertir orden para mostrar (más antiguos arriba, más recientes abajo)
        messages.reverse();

        // ✅ Cachear mensajes (solo para carga inicial)
        if (!isLoadMore) {
            if (!dataCache.messages[groupId]) {
                dataCache.messages[groupId] = {};
            }
            dataCache.messages[groupId] = { data: messages, timestamp: Date.now() };
        }
        
        // Obtener user_ids únicos
        const userIds = [...new Set(messages.map(m => m.user_id))];

        // Cargar datos de usuarios (solo campos necesarios)
        const { data: users, error: usersError } = await supabase
            .from('user_settings')
            .select(' user_id, username, profile_image')
            .in('user_id', userIds);

        if (usersError) {
            console.warn('⚠️ Error cargando usuarios:', usersError);
        }

        // Combinar mensajes con datos de usuarios
        const messagesWithUsers = messages.map(msg => ({
            ...msg,
            user: users?.find(u => u.user_id === msg.user_id) || {
                username: 'Usuario',
                profile_image: null
            }
        }));

        console.log(`✅ ${messagesWithUsers.length} mensajes cargados para grupo ${groupId}`);
        renderGroupMessages(messagesWithUsers, isLoadMore);
        if (!isLoadMore) {
            scrollChatToBottom();
        }

    } catch (error) {
        console.error('Error cargando mensajes:', error);
        showNotification('❌ Error al cargar mensajes del grupo', 'error');
    }
}

function renderGroupMessages(messages, isLoadMore = false) {
    const container = document.getElementById('group-messages-container');
    if (!container) return;

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    if (messages.length === 0 && !isLoadMore) {
        container.innerHTML = `
            <div class="text-center py-8 text-text-secondary text-sm">
                <i class="fas fa-comments text-3xl mb-2 opacity-50"></i>
                <p>No hay mensajes aún</p>
                <p class="text-xs mt-1">Sé el primero en escribir</p>
            </div>
        `;
        return;
    }

    const messagesHtml = messages.map(msg => {
        // Mensajes de Supabase (con objeto user de user_settings)
        const user = msg.user;
        const displayName = user?.username || 'Usuario';
        const profileImage = user?.profile_image;
        const avatar = profileImage || displayName.charAt(0).toUpperCase();
        const isOwn = msg.user_id === currentUser.id;

        const time = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="chat-message ${isOwn ? 'own' : ''}">
                <div class="chat-message-avatar">
                    ${profileImage ? `<img src="${profileImage}" alt="${displayName}" class="w-full h-full object-cover rounded-full">` : avatar}
                </div>
                <div class="chat-message-content">
                    ${!isOwn ? `<div class="text-xs font-semibold mb-1 text-text-secondary">${displayName}</div>` : ''}
                    <div class="chat-message-bubble">
                        ${msg.message ? `<div>${escapeHtml(msg.message)}</div>` : ''}
                        ${msg.image_url ? `<img src="${msg.image_url}" alt="Imagen" class="chat-message-image" onclick="openImageModal('${msg.image_url}')">` : ''}
                    </div>
                    <div class="chat-message-meta">
                        <span>${time}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ✅ PAGINACIÓN: Agregar o reemplazar mensajes
    if (isLoadMore) {
        // Insertar al principio (mensajes más antiguos)
        container.insertAdjacentHTML('afterbegin', messagesHtml);
    } else {
        // Reemplazar todos
        container.innerHTML = messagesHtml;
    }

    // ✅ Botón "Cargar más" si hay más mensajes
    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    const container = document.getElementById('group-messages-container');
    if (!container) return;

    // Remover botón existente
    const existingBtn = container.querySelector('.load-more-messages-btn');
    if (existingBtn) existingBtn.remove();

    // Agregar botón si hay más mensajes
    if (hasMoreMessages && currentActiveGroup) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'load-more-messages-btn text-center py-3';
        loadMoreBtn.innerHTML = `
            <button onclick="loadMoreMessages()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-80 transition-all text-sm">
                <i class="fas fa-arrow-up mr-2"></i>Cargar mensajes anteriores
            </button>
        `;
        container.insertAdjacentElement('afterbegin', loadMoreBtn);
    }
}

async function loadMoreMessages() {
    if (!currentActiveGroup || !hasMoreMessages) return;
    
    console.log('📜 Cargando más mensajes...');
    const groupId = currentActiveGroup.group_id || currentActiveGroup.id;
    await loadGroupMessages(groupId, MESSAGES_PAGE_SIZE, true);
}

async function sendGroupMessage() {
    const input = document.getElementById('group-message-input');
    const imageInput = document.getElementById('group-image-input');
    const message = input.value.trim();
    const imageFile = imageInput.files[0];

    console.log('📤 sendGroupMessage llamada');
    console.log('  - Mensaje:', message);
    console.log('  - Imagen:', imageFile ? imageFile.name : 'ninguna');
    console.log('  - Grupo activo:', currentActiveGroup);

    if (!message && !imageFile) {
        console.log('⚠️ No hay mensaje ni imagen');
        return;
    }
    
    if (!currentActiveGroup) {
        showNotification('❌ Selecciona un grupo primero', 'error');
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
        showNotification('❌ Debes iniciar sesión', 'error');
        return;
    }

    try {
        // Enviar mensaje a Supabase
        const groupId = currentActiveGroup.group_id || currentActiveGroup.id;
        console.log('☁️ Enviando mensaje a Supabase...');
        
        let imageUrl = null;

        // Subir imagen si existe
        if (imageFile) {
            console.log('📤 Subiendo imagen a Supabase Storage...');
            imageUrl = await uploadGroupImage(imageFile, groupId);
            console.log('✅ Imagen subida:', imageUrl);
        }

        // Insertar mensaje
        const { data, error } = await supabase
            .from('group_messages')
            .insert([{
                group_id: groupId,
                user_id: currentUser.id,
                message: message || null,
                image_url: imageUrl
            }])
            .select();

        if (error) {
            console.error('Error insertando mensaje:', error);
            throw error;
        }

        console.log('✅ Mensaje enviado a Supabase');

        // ✅ Invalidar caché de mensajes del grupo
        if (dataCache.messages[groupId]) {
            delete dataCache.messages[groupId];
        }

        // Limpiar inputs
        input.value = '';
        imageInput.value = '';
        removeImagePreview();

        showNotification('✅ Mensaje enviado', 'success');

        // Recargar mensajes del grupo
        await loadGroupMessages(groupId);

    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        showNotification(`❌ Error al enviar mensaje: ${error.message}`, 'error');
    }
}

async function uploadGroupImage(file, groupId) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${groupId}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('group-images')
            .upload(filePath, file);

        if (error) {
            // Si el bucket no existe, mostrar mensaje amigable
            if (error.message.includes('Bucket not found')) {
                throw new Error('El bucket de imágenes no está configurado. Por favor contacta al administrador.');
            }
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('group-images')
            .getPublicUrl(filePath);

        return publicUrl;

    } catch (error) {
        console.error('Error subiendo imagen:', error);
        showNotification(`❌ Error al subir imagen: ${error.message}`, 'error');
        throw error;
    }
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    console.log('🖼️ handleImageSelect llamada');
    console.log('  - Archivo:', file);
    
    if (!file) {
        console.log('⚠️ No se seleccionó archivo');
        return;
    }

    console.log('📋 Detalles del archivo:');
    console.log('  - Nombre:', file.name);
    console.log('  - Tipo:', file.type);
    console.log('  - Tamaño:', (file.size / 1024).toFixed(2), 'KB');

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Por favor selecciona una imagen válida', 'error');
        e.target.value = '';
        return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('❌ La imagen es demasiado grande (máximo 5MB)', 'error');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        console.log('✅ Imagen cargada para preview');
        const preview = document.getElementById('image-preview');
        const container = document.getElementById('image-preview-container');
        
        if (preview && container) {
            preview.src = event.target.result;
            container.style.display = 'block';
            console.log('✅ Preview mostrado');
        } else {
            console.error('❌ Elementos de preview no encontrados');
        }
    };
    reader.onerror = (error) => {
        console.error('❌ Error leyendo archivo:', error);
        showNotification('❌ Error al cargar la imagen', 'error');
    };
    reader.readAsDataURL(file);
}

function removeImagePreview() {
    console.log('🗑️ Removiendo preview de imagen');
    const container = document.getElementById('image-preview-container');
    const preview = document.getElementById('image-preview');
    const input = document.getElementById('group-image-input');
    
    if (container) container.style.display = 'none';
    if (preview) preview.src = '';
    if (input) input.value = '';
    
    console.log('✅ Preview removido');
}

function subscribeToGroupMessages(groupId) {
    // Cancelar suscripción anterior si existe
    if (groupMessagesListener) {
        groupMessagesListener.unsubscribe();
        groupMessagesListener = null;
    }

    // Nueva suscripción con API moderna de Supabase
    groupMessagesListener = supabase
        .channel(`group-messages-${groupId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'group_messages',
                filter: `group_id=eq.${groupId}`
            },
            (payload) => {
                console.log('🔔 Nuevo mensaje recibido:', payload);
                loadGroupMessages(groupId);
            }
        )
        .subscribe((status) => {
            console.log(`📡 Suscripción a mensajes: ${status}`);
        });
}

function scrollChatToBottom() {
    const container = document.getElementById('group-messages-container');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

// ==========================================
// MODALES
// ==========================================

function openCreateGroupModal() {
    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
    // Limpiar campos
    document.getElementById('new-group-name').value = '';
    document.getElementById('new-group-description').value = '';
    document.getElementById('new-group-privacy').value = 'private';
    document.getElementById('new-group-emoji').value = '📊';
}

async function createGroup() {
    const name = document.getElementById('new-group-name').value.trim();
    const description = document.getElementById('new-group-description').value.trim();
    const privacy = document.getElementById('new-group-privacy').value;
    const emoji = document.getElementById('new-group-emoji').value;
    const currentUser = getCurrentUser();

    if (!name) {
        showNotification('❌ El nombre del grupo es obligatorio', 'error');
        return;
    }

    try {
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }

        // Generar ID único para el grupo
        const groupId = `custom-group-${Date.now()}`;
        
        // Insertar grupo en Supabase
        const { data: newGroup, error: groupError } = await supabase
            .from('trading_groups')
            .insert([{
                id: groupId,
                name,
                description,
                emoji,
                privacy,
                created_by: currentUser.id
            }])
            .select()
            .single();

        if (groupError) {
            console.error('Error insertando grupo:', groupError);
            throw groupError;
        }

        console.log('✅ Grupo creado en Supabase:', newGroup);

        // El creador se agrega automáticamente como admin por el trigger auto_add_creator_to_group
        console.log('✅ Creator automáticamente agregado como admin por trigger de DB');

        // ✅ Invalidar caché de grupos
        clearCache('groups');
        
        showNotification('✅ Grupo creado exitosamente', 'success');
        closeCreateGroupModal();
        await loadMyGroups();
        await loadPublicGroups();

    } catch (error) {
        console.error('Error creando grupo:', error);
        showNotification(`❌ Error al crear grupo: ${error.message}`, 'error');
    }
}

function openGroupInfoModal() {
    if (!currentActiveGroup) return;
    document.getElementById('group-info-modal').classList.remove('hidden');
    loadGroupInfo();
}

function closeGroupInfoModal() {
    document.getElementById('group-info-modal').classList.add('hidden');
}

async function loadGroupInfo() {
    if (!currentActiveGroup) return;

    document.getElementById('group-info-emoji').textContent = currentActiveGroup.emoji;
    document.getElementById('group-info-name').textContent = currentActiveGroup.name;
    document.getElementById('group-info-description').textContent = currentActiveGroup.description || 'Sin descripción';

    // ✅ OPTIMIZADO: Solo campos necesarios y limitar resultados
    const { data, error } = await supabase
        .from('group_members')
        .select('id, group_id, user_id, role, joined_at')
        .eq('group_id', currentActiveGroup.id)
        .limit(100);  // ✅ Limitar a 100 miembros

    if (!error && data) {
        document.getElementById('group-info-members-count').textContent = data.length;
        renderGroupMembers(data);
    }
}

function renderGroupMembers(members) {
    const container = document.getElementById('group-members-list');
    if (!container) return;

    container.innerHTML = members.map(member => {
        const user = member.user;
        const displayName = user.raw_user_meta_data?.display_name || user.email.split('@')[0];
        const avatar = user.raw_user_meta_data?.avatar_url || displayName.charAt(0).toUpperCase();

        return `
            <div class="member-card">
                <div class="member-info">
                    <div class="member-avatar">
                        ${avatar.startsWith('http') ? `<img src="${avatar}" alt="${displayName}" class="w-full h-full object-cover rounded-full">` : avatar}
                    </div>
                    <div>
                        <div class="font-semibold text-sm">${displayName}</div>
                        <div class="text-xs text-text-secondary">${user.email}</div>
                    </div>
                </div>
                ${member.role === 'admin' ? '<span class="member-role-badge">Admin</span>' : ''}
            </div>
        `;
    }).join('');
}

async function leaveGroup() {
    if (!currentActiveGroup) return;

    if (!confirm('¿Estás seguro de que quieres salir de este grupo?')) return;

    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }

        // Eliminar de Supabase
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', currentActiveGroup.id || currentActiveGroup.group_id)
            .eq('user_id', currentUser.id);

        if (error) throw error;
        
        showNotification('✅ Has salido del grupo', 'success');

        closeGroupInfoModal();
        
        currentActiveGroup = null;
        document.getElementById('no-group-selected').style.display = 'block';
        document.getElementById('group-chat-container').style.display = 'none';

        await loadMyGroups();
        await loadPublicGroups();

    } catch (error) {
        console.error('Error saliendo del grupo:', error);
        showNotification('❌ Error al salir del grupo', 'error');
    }
}

// =====================================================
// CONFIGURACIÓN DE GRUPO
// =====================================================

function openGroupSettingsModal() {
    if (!currentActiveGroup) return;
    
    const modal = document.getElementById('group-settings-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Verificar si el usuario es admin para habilitar botón de borrar
    checkIfUserIsAdmin();
    
    // Limpiar búsqueda anterior
    document.getElementById('search-ranking-username').value = '';
    document.getElementById('ranking-search-results').innerHTML = `
        <div class="text-center py-4 text-text-secondary text-sm">
            <i class="fas fa-search text-2xl mb-2 opacity-50"></i>
            <p>Busca traders del ranking para invitar</p>
        </div>
    `;
}

function closeGroupSettingsModal() {
    const modal = document.getElementById('group-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function checkIfUserIsAdmin() {
    if (!currentActiveGroup) return;
    
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        const { data, error } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', currentActiveGroup.id)
            .eq('user_id', currentUser.id)
            .single();
        
        const isAdmin = !error && data && data.role === 'admin';
        const deleteBtn = document.getElementById('delete-group-btn');
        const adminNotice = document.getElementById('delete-group-admin-notice');
        
        if (deleteBtn) {
            deleteBtn.disabled = !isAdmin;
        }
        
        if (adminNotice) {
            adminNotice.style.display = isAdmin ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error verificando admin:', error);
    }
}

async function searchRankingTraders() {
    const searchInput = document.getElementById('search-ranking-username');
    const resultsContainer = document.getElementById('ranking-search-results');
    
    if (!searchInput || !resultsContainer) return;
    
    const searchQuery = searchInput.value.trim().toLowerCase();
    
    if (!searchQuery) {
        resultsContainer.innerHTML = `
            <div class="text-center py-4 text-text-secondary text-sm">
                <i class="fas fa-search text-2xl mb-2 opacity-50"></i>
                <p>Escribe un nombre de usuario para buscar</p>
            </div>
        `;
        return;
    }
    
    try {
        resultsContainer.innerHTML = `
            <div class="text-center py-4 text-text-secondary text-sm">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>Buscando traders...</p>
            </div>
        `;
        
        // Buscar en usuarios con perfil público
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, display_name, avatar_url, is_public')
            .eq('is_public', true)
            .ilike('display_name', `%${searchQuery}%`)
            .limit(10);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center py-4 text-text-secondary text-sm">
                    <i class="fas fa-user-slash text-2xl mb-2 opacity-50"></i>
                    <p>No se encontraron traders con ese nombre</p>
                </div>
            `;
            return;
        }
        
        // Verificar cuáles ya están en el grupo
        const { data: members } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', currentActiveGroup.id);
        
        const memberIds = members?.map(m => m.user_id) || [];
        
        resultsContainer.innerHTML = data.map(trader => {
            const isMember = memberIds.includes(trader.user_id);
            const displayName = trader.display_name || 'Usuario';
            const avatar = trader.avatar_url || displayName.charAt(0).toUpperCase();
            
            return `
                <div class="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary text-background flex items-center justify-center font-bold">
                            ${avatar.startsWith('http') ? `<img src="${avatar}" class="w-full h-full rounded-full object-cover">` : avatar}
                        </div>
                        <div>
                            <div class="font-semibold text-sm">${displayName}</div>
                            <div class="text-xs text-text-secondary">Trader Público</div>
                        </div>
                    </div>
                    ${isMember 
                        ? '<span class="text-xs text-text-secondary">Ya es miembro</span>'
                        : `<button onclick="inviteTraderFromRanking('${trader.user_id}', '${displayName}')" class="px-3 py-1 bg-primary text-background rounded-lg text-xs font-bold hover:bg-secondary transition-all">
                            <i class="fas fa-user-plus mr-1"></i>Invitar
                        </button>`
                    }
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error buscando traders:', error);
        resultsContainer.innerHTML = `
            <div class="text-center py-4 text-red text-sm">
                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                <p>Error al buscar traders</p>
            </div>
        `;
    }
}

async function inviteTraderFromRanking(userId, displayName) {
    if (!currentActiveGroup) return;
    
    try {
        // Usar la función RPC para crear invitación
        const { data, error } = await supabase.rpc('create_group_invitation', {
            p_group_id: currentActiveGroup.id,
            p_invited_email: null,
            p_invited_user_id: userId,
            p_expiry_hours: 168
        });

        if (error) throw error;

        showNotification(`✅ Invitación enviada a ${displayName}`, 'success');
        
        // Recargar resultados para actualizar estado
        await searchRankingTraders();
        
    } catch (error) {
        console.error('Error invitando trader:', error);
        showNotification('❌ Error al enviar invitación', 'error');
    }
}

async function deleteGroup() {
    if (!currentActiveGroup) return;
    
    const groupName = currentActiveGroup.name;
    
    // Confirmación doble
    const confirmText = `¿Estás seguro de que quieres BORRAR PERMANENTEMENTE el grupo "${groupName}"?\n\nEsta acción NO se puede deshacer.\n\nTodos los mensajes, imágenes y miembros serán eliminados.`;
    
    if (!confirm(confirmText)) return;
    
    const secondConfirm = prompt(`Para confirmar, escribe el nombre del grupo:\n"${groupName}"`);
    
    if (secondConfirm !== groupName) {
        showNotification('❌ El nombre no coincide. Cancelado.', 'error');
        return;
    }
    
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }
        
        // Verificar que sea admin
        const { data: memberData, error: memberError } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', currentActiveGroup.id)
            .eq('user_id', currentUser.id)
            .single();
        
        if (memberError || !memberData || memberData.role !== 'admin') {
            showNotification('❌ Solo los administradores pueden borrar el grupo', 'error');
            return;
        }
        
        // Borrar grupo (cascade eliminará miembros y mensajes automáticamente)
        const { error } = await supabase
            .from('trading_groups')
            .delete()
            .eq('id', currentActiveGroup.id);

        if (error) throw error;
        
        showNotification(`✅ Grupo "${groupName}" eliminado permanentemente`, 'success');

        closeGroupSettingsModal();
        
        currentActiveGroup = null;
        document.getElementById('no-group-selected').style.display = 'block';
        document.getElementById('group-chat-container').style.display = 'none';

        await loadMyGroups();
        await loadPublicGroups();

    } catch (error) {
        console.error('Error borrando grupo:', error);
        showNotification('❌ Error al borrar el grupo', 'error');
    }
}

// Exportar funciones globalmente para uso en onclick
window.inviteTraderFromRanking = inviteTraderFromRanking;

async function loadPublicGroups() {
    console.log('🌐 loadPublicGroups() iniciada');
    try {
        // Solo cargar grupos reales públicos de Supabase (datos demo eliminados)
        console.log('🔄 Cargando grupos públicos de Supabase...');
        
        let realPublicGroups = [];
        try {
            // ✅ OPTIMIZADO: Solo campos necesarios
            const { data, error } = await supabase
                .from('trading_groups')
                .select('id, name, description, emoji, privacy, created_by, created_at')
                .eq('privacy', 'public')
                .order('created_at', { ascending: false })
                .limit(10);

            if (!error && data) {
                realPublicGroups = data.map(g => ({ ...g, is_demo: false }));
                console.log('✅ Grupos públicos cargados:', realPublicGroups.length);
            } else {
                console.error('Error cargando grupos públicos:', error);
            }
        } catch (error) {
            console.error('❌ Error en query de grupos públicos:', error);
        }

        console.log('📋 Total grupos públicos:', realPublicGroups.length);
        renderPublicGroups(realPublicGroups);

    } catch (error) {
        console.error('❌ Error en loadPublicGroups:', error);
    }
}

function renderPublicGroups(groups) {
    const container = document.getElementById('public-groups-list');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = '<div class="text-xs text-text-secondary text-center py-4">No hay grupos públicos</div>';
        return;
    }

    const currentUser = getCurrentUser();

    container.innerHTML = groups.map(group => {
        const isMember = myGroups.some(g => g.group_id === group.id);
        const isOwner = currentUser && group.created_by === currentUser.id;
        
        const ownerBadge = isOwner
            ? `<span style="
                display: inline-block;
                padding: 2px 6px;
                background: linear-gradient(135deg, #39ff14, #28e000);
                color: #000;
                border-radius: 3px;
                font-size: 9px;
                font-weight: 700;
                margin-left: 6px;
                text-transform: uppercase;
            ">Tuyo</span>`
            : '';

        return `
            <div class="public-group-card">
                <div class="flex items-center gap-2 mb-2">
                    <div class="text-2xl">${group.emoji}</div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-sm truncate">
                            ${group.name}${ownerBadge}
                        </div>
                        <div class="text-xs text-text-secondary truncate">${group.description || 'Sin descripción'}</div>
                        ${group.members_count ? `<div class="text-xs text-text-secondary mt-1"><i class="fas fa-users" style="font-size: 10px;"></i> ${group.members_count} miembros</div>` : ''}
                    </div>
                </div>
                ${isMember 
                    ? '<div class="text-xs text-primary font-semibold">Ya eres miembro</div>'
                    : `<button class="join-group-btn" onclick="joinGroup('${group.id}')"><i class="fas fa-sign-in-alt mr-1"></i>Unirse</button>`
                }
            </div>
        `;
    }).join('');
}

async function joinGroup(groupId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showNotification('❌ Debes iniciar sesión', 'error');
            return;
        }

        // Guardar en Supabase
        const { error } = await supabase
            .from('group_members')
            .insert([{
                group_id: groupId,
                user_id: currentUser.id,
                role: 'member'
            }]);

        if (error) {
            if (error.code === '23505') {
                showNotification('⚠️ Ya eres miembro de este grupo', 'info');
            } else {
                throw error;
            }
        } else {
            showNotification('✅ Te has unido al grupo', 'success');
        }

        await loadMyGroups();
        await loadPublicGroups();

    } catch (error) {
        console.error('Error uniéndose al grupo:', error);
        showNotification('❌ Error al unirse al grupo', 'error');
    }
}

async function searchPublicGroups() {
    const query = document.getElementById('search-groups-input').value.toLowerCase();
    
    try {
        // ✅ OPTIMIZADO: Solo campos necesarios
        const { data, error } = await supabase
            .from('trading_groups')
            .select('id, name, description, emoji, privacy, created_by, created_at')
            .eq('privacy', 'public')
            .ilike('name', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        renderPublicGroups(data || []);

    } catch (error) {
        console.error('Error buscando grupos:', error);
    }
}

// ==========================================
// UTILIDADES
// ==========================================

async function getGroupMembersCount(groupId) {
    // ✅ OPTIMIZADO: head:true para no traer datos, solo el count
    const { count, error } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })  // ✅ Solo id en lugar de *
        .eq('group_id', groupId);

    return count || 0;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " años";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " días";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutos";
    
    return Math.floor(seconds) + " segundos";
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function openImageModal(imageUrl) {
    console.log('🖼️ [Social Media] Abriendo modal de imagen:', imageUrl.substring(0, 50) + '...');
    
    // Buscar la función global de platform.html (que acepta array como primer parámetro)
    if (typeof window.platformOpenImageModal === 'function') {
        console.log('✅ Usando función global platformOpenImageModal');
        window.platformOpenImageModal([imageUrl], 0);
        return;
    }
    
    // Fallback: abrir en nueva pestaña
    console.log('⚠️ Función global no encontrada, abriendo en nueva pestaña');
    window.open(imageUrl, '_blank');
}

function viewTraderProfile(traderId) {
    console.log('Ver perfil de trader:', traderId);
    // Implementar vista de perfil de trader
}

// Exportar funciones para uso global
console.log('📦 [SOCIAL-MEDIA.JS] Iniciando exportación de funciones...');

window.initSocialMediaModule = initSocialMedia;
window.loadMyGroups = loadMyGroups;
window.loadPublicGroups = loadPublicGroups;
window.followTrader = followTrader;
window.unfollowTrader = unfollowTrader;
window.selectGroup = selectGroup;
window.loadMoreMessages = loadMoreMessages;
window.joinGroup = joinGroup;
window.openCreateGroupModal = openCreateGroupModal;
window.createGroup = createGroup;
window.closeCreateGroupModal = closeCreateGroupModal;
window.sendGroupMessage = sendGroupMessage;
window.leaveGroup = leaveGroup;

// ==========================================
// FUNCIONES DE INVITACIONES
// ==========================================

async function openInviteGroupModal() {
    if (!invitationsFeatureEnabled) return;
    
    const currentGroupId = currentActiveGroup?.id;
    if (!currentGroupId) {
        console.error('No hay grupo seleccionado');
        return;
    }
    
    // Obtener información del grupo actual
    const groupName = document.getElementById('group-chat-name')?.textContent || currentActiveGroup?.name || 'Grupo';
    const groupNameEl = document.getElementById('invite-modal-group-name');
    if (groupNameEl) groupNameEl.textContent = groupName;
    
    // Mostrar modal
    const modal = document.getElementById('invite-group-modal');
    if (modal) modal.classList.remove('hidden');
    
    // Cargar invitaciones pendientes
    await loadPendingInvitations(currentGroupId);
    
    // Generar link de invitación
    await generateInviteLink(currentGroupId);
}

function closeInviteGroupModal() {
    document.getElementById('invite-group-modal').classList.add('hidden');
    document.getElementById('invite-email-input').value = '';
}

async function sendGroupInvite() {
    if (!invitationsFeatureEnabled) return;
    
    const currentGroupId = currentActiveGroup?.id;
    const email = document.getElementById('invite-email-input').value.trim();
    
    if (!email) {
        showNotification('Por favor ingresa un email', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showNotification('Por favor ingresa un email válido', 'error');
        return;
    }
    
    if (!currentGroupId) {
        console.error('No hay grupo seleccionado');
        return;
    }
    
    const sendBtn = document.getElementById('send-invite-btn');
    const originalText = sendBtn.innerHTML;
    
    try {
        // Mostrar loading
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;
        
        // Usar la función SQL directamente
        const { data, error } = await supabase.rpc('create_group_invitation', {
            p_group_id: currentGroupId,
            p_invited_email: email,
            p_invited_user_id: null,
            p_expiry_hours: 168
        });
        
        if (error) {
            console.error('Error RPC completo:', error);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            console.error('Error hint:', error.hint);
            console.error('Group ID:', currentGroupId);
            showNotification('No se pudo enviar la invitación: ' + error.message, 'error');
            sendBtn.innerHTML = originalText;
            sendBtn.disabled = false;
            return;
        }
        
        // Limpiar input
        document.getElementById('invite-email-input').value = '';
        
        // Recargar lista de invitaciones pendientes
        await loadPendingInvitations(currentGroupId);
        
        // Mostrar notificación
        showNotification(`Invitación enviada a ${email}`, 'success');
        
        // Restaurar botón
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
        
    } catch (error) {
        showNotification('No se pudo enviar la invitación', 'error');
        
        // Restaurar botón
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

async function loadPendingInvitations(groupId) {
    if (!invitationsFeatureEnabled) return;
    
    const container = document.getElementById('pending-invites-list');
    
    try {
        // ✅ OPTIMIZADO: Solo campos necesarios
        const { data: invitations, error } = await supabase
            .from('group_invitations')
            .select('id, group_id, invited_email, invited_user_id, invitation_token, status, expires_at, created_at')
            .eq('group_id', groupId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20);  // ✅ Agregar límite
        
        if (error) {
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-4 text-text-secondary text-xs">
                        No hay invitaciones pendientes
                    </div>
                `;
            }
            return;
        }
        
        if (!invitations || invitations.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-4 text-text-secondary text-xs">
                        No hay invitaciones pendientes
                    </div>
                `;
            }
            return;
        }
        
        if (container) {
            container.innerHTML = invitations.map(inv => {
                const expiresAt = new Date(inv.expires_at);
                const now = new Date();
                const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
                const timeText = hoursRemaining > 24 
                    ? `${Math.floor(hoursRemaining / 24)} días`
                    : `${hoursRemaining} horas`;
                
                return `
                    <div class="flex items-center justify-between p-2 bg-surface border border-border rounded-lg text-xs text-white">
                        <div class="flex-1">
                            <p class="font-semibold text-white">${inv.invited_email || 'Usuario invitado'}</p>
                            <p class="text-text-secondary">Expira en: ${timeText}</p>
                        </div>
                        <button onclick="cancelInvitation('${inv.id}')" class="px-2 py-1 text-red hover:bg-surface-light rounded">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
    } catch (error) {
        console.error('Error cargando invitaciones pendientes:', error);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4 text-text-secondary text-xs">
                    Error al cargar invitaciones
                </div>
            `;
        }
    }
}

async function generateInviteLink(groupId) {
    if (!invitationsFeatureEnabled) return;
    
    const linkInput = document.getElementById('invite-link-input');
    
    try {
        // Mostrar mensaje de carga
        if (linkInput) linkInput.value = 'Generando link...';
        
        // Usar la función SQL directamente para crear invitación genérica
        const { data, error } = await supabase.rpc('create_group_invitation', {
            p_group_id: groupId,
            p_invited_email: `invite_${Date.now()}@temp.group`, // Email temporal único
            p_invited_user_id: null,
            p_expiry_hours: 168
        });

        if (error) {
            if (linkInput) linkInput.value = '';
            return;
        }

        // Obtener el token de la invitación recién creada
        const { data: invitation, error: fetchError } = await supabase
            .from('group_invitations')
            .select('invitation_token')
            .eq('id', data)
            .single();

        if (fetchError) throw fetchError;

        // Detectar si estamos en producción (Vercel) o desarrollo (localhost)
        const isProduction = window.location.hostname !== 'localhost' && 
                            window.location.hostname !== '127.0.0.1';
        
        // Usar el dominio apropiado
        const baseUrl = isProduction 
            ? 'https://tradingsurvivor.vercel.app'  // Dominio de producción
            : window.location.origin;               // localhost para desarrollo
        
        const link = `${baseUrl}/?invite=${invitation.invitation_token}`;
        
        // Mostrar en el input
        if (linkInput) linkInput.value = link;
        
    } catch (error) {
        if (linkInput) {
            linkInput.value = '';
        }
    }
}

async function copyInviteLink() {
    if (!invitationsFeatureEnabled) return;
    
    const input = document.getElementById('invite-link-input');
    const link = input.value;
    
    if (!link || link === '') {
        showNotification('No hay link disponible', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(link);
        
        // Cambiar icono temporalmente
        const btn = document.getElementById('copy-invite-link-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
        
        showNotification('Link copiado al portapapeles', 'success');
        
    } catch (error) {
        showNotification('No se pudo copiar el link', 'error');
    }
}

// Compartir invitación por WhatsApp
window.shareViaWhatsApp = function() {
    const link = document.getElementById('invite-link-input').value;
    const groupName = currentActiveGroup?.name || 'un grupo';
    
    if (!link || link === '') {
        showNotification('No hay link disponible', 'error');
        return;
    }
    
    const message = `🚀 *¡Te invito a Trading Survivor!*

📊 Únete al grupo *${groupName}* donde compartimos:
✅ Operaciones y análisis en tiempo real
✅ Estrategias de trading probadas
✅ Comunidad de traders comprometidos

🔗 *Haz click para unirte:*
${link}

⏰ Este link expira en 7 días`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
};

// Compartir invitación por Telegram
window.shareViaTelegram = function() {
    const link = document.getElementById('invite-link-input').value;
    const groupName = currentActiveGroup?.name || 'un grupo';
    
    if (!link || link === '') {
        showNotification('No hay link disponible', 'error');
        return;
    }
    
    const message = `🚀 ¡Te invito a Trading Survivor!

📊 Únete al grupo "${groupName}" donde compartimos:
✅ Operaciones y análisis en tiempo real
✅ Estrategias de trading probadas
✅ Comunidad de traders comprometidos

🔗 Haz click para unirte:
${link}

⏰ Este link expira en 7 días`;
    
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, '_blank');
};

// Compartir invitación por Discord
window.shareViaDiscord = function() {
    const link = document.getElementById('invite-link-input').value;
    const groupName = currentActiveGroup?.name || 'un grupo';
    
    if (!link || link === '') {
        showNotification('No hay link disponible', 'error');
        return;
    }
    
    // Discord no tiene API de compartir directo, pero copiamos un mensaje formateado
    const message = `🚀 **¡Te invito a Trading Survivor!**

📊 Únete al grupo **${groupName}** donde compartimos:
✅ Operaciones y análisis en tiempo real
✅ Estrategias de trading probadas
✅ Comunidad de traders comprometidos

🔗 **Haz click para unirte:**
${link}

⏰ Este link expira en 7 días`;
    
    navigator.clipboard.writeText(message).then(() => {
        showNotification('✅ Mensaje copiado para Discord. Pégalo en tu servidor o chat', 'success');
    }).catch(() => {
        showNotification('❌ Error al copiar. Copia el link manualmente', 'error');
    });
};

window.cancelInvitation = async function(invitationId) {
    if (!invitationsFeatureEnabled) return;
    if (!confirm('¿Cancelar esta invitación?')) return;
    
    try {
        // Eliminar la invitación directamente en Supabase
        const { error } = await supabase
            .from('group_invitations')
            .delete()
            .eq('id', invitationId);
        
        if (error) throw error;
        
        // Recargar lista
        const currentGroupId = currentActiveGroup?.id;
        if (currentGroupId) {
            await loadPendingInvitations(currentGroupId);
        }
        
        showNotification('Invitación cancelada', 'info');
        
    } catch (error) {
        showNotification('No se pudo cancelar la invitación', 'error');
    }
};

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Exportar nuevas funciones
window.openInviteGroupModal = openInviteGroupModal;
window.closeInviteGroupModal = closeInviteGroupModal;
window.sendGroupInvite = sendGroupInvite;
window.copyInviteLink = copyInviteLink;

console.log('✅ [SOCIAL-MEDIA.JS] Funciones exportadas correctamente:');
console.log('  - initSocialMediaModule:', typeof window.initSocialMediaModule);
console.log('  - loadMyGroups:', typeof window.loadMyGroups);
console.log('  - loadPublicGroups:', typeof window.loadPublicGroups);
console.log('✅ [SOCIAL-MEDIA.JS] Módulo cargado completamente');
