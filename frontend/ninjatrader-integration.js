// =====================================================
// NINJATRADER INTEGRATION - Frontend Helper
// Funciones para gestionar la conexión con NinjaTrader
// =====================================================

/**
 * Genera una nueva API Key para NinjaTrader
 */
async function generateNinjaTraderApiKey() {
    try {
        const apiClient = new AuthenticatedAPI();
        
        // Generar API Key única
        const apiKey = generateSecureApiKey();
        
        // Guardar en Supabase
        const response = await apiClient.request('/api/credentials/save', {
            method: 'POST',
            body: JSON.stringify({
                platform: 'ninjatrader',
                api_key: apiKey,
                secret_key: '', // No se usa para NinjaTrader
                account_id: 'NinjaTrader Default'
            })
        });

        if (response.success) {
            return {
                success: true,
                apiKey: apiKey,
                message: 'API Key generada exitosamente'
            };
        } else {
            throw new Error(response.error || 'Error generando API Key');
        }
    } catch (error) {
        console.error('Error generando API Key:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Genera una API Key segura
 */
function generateSecureApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 64;
    let apiKey = 'nt_'; // Prefijo para identificar que es de NinjaTrader
    
    for (let i = 0; i < length; i++) {
        apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return apiKey;
}

/**
 * Obtiene las credenciales de NinjaTrader del usuario
 */
async function getNinjaTraderCredentials() {
    try {
        const apiClient = new AuthenticatedAPI();
        const response = await apiClient.request('/api/credentials/list');
        
        if (response.success) {
            const ninjaCredential = response.data.find(c => c.platform === 'ninjatrader');
            return ninjaCredential || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error obteniendo credenciales:', error);
        return null;
    }
}

/**
 * Revoca la API Key de NinjaTrader
 */
async function revokeNinjaTraderApiKey(credentialId) {
    try {
        const apiClient = new AuthenticatedAPI();
        const response = await apiClient.request(`/api/credentials/delete`, {
            method: 'DELETE',
            body: JSON.stringify({ id: credentialId })
        });
        
        return response;
    } catch (error) {
        console.error('Error revocando API Key:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Muestra el modal de configuración de NinjaTrader
 */
function showNinjaTraderSetupModal() {
    const modal = document.createElement('div');
    modal.id = 'ninjatrader-setup-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.95)';
    
    modal.innerHTML = `
        <div class="relative bg-surface border border-border rounded-lg shadow-lg p-8 w-full max-w-2xl">
            <button id="close-ninja-modal" class="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-light">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="mb-6">
                <div class="flex items-center gap-3 mb-2">
                    <img src="logos/ninja-logo.png" alt="NinjaTrader" class="w-12 h-12 rounded-lg">
                    <h2 class="text-2xl font-bold">Conectar NinjaTrader</h2>
                </div>
                <p class="text-text-secondary">Exporta tus trades automáticamente desde NinjaTrader</p>
            </div>

            <div id="ninja-step-1" class="step-content">
                <h3 class="text-lg font-semibold mb-4">Paso 1: Genera tu API Key</h3>
                <p class="text-text-secondary mb-4">Esta clave única te permitirá conectar NinjaTrader con Trader Survivor de forma segura.</p>
                
                <button id="generate-ninja-key-btn" class="btn-primary w-full mb-4">
                    <i class="fas fa-key mr-2"></i>Generar API Key
                </button>
                
                <div id="api-key-container" style="display: none;" class="bg-surface-light border border-border rounded-lg p-4 mb-4">
                    <label class="text-sm text-text-secondary mb-2 block">Tu API Key:</label>
                    <div class="flex items-center gap-2">
                        <input type="text" id="ninja-api-key" readonly class="flex-1 bg-background border border-border rounded px-3 py-2 font-mono text-sm" value="">
                        <button id="copy-ninja-key-btn" class="btn-outline px-4 py-2">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <p class="text-xs text-warning mt-2">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        Guarda esta clave en un lugar seguro. No se mostrará nuevamente.
                    </p>
                </div>
            </div>

            <div id="ninja-step-2" style="display: none;" class="step-content">
                <h3 class="text-lg font-semibold mb-4">Paso 2: Instala en NinjaTrader</h3>
                
                <div class="space-y-4">
                    <div class="bg-surface-light border border-border rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center font-bold flex-shrink-0">1</div>
                            <div>
                                <h4 class="font-semibold mb-1">Descarga el archivo</h4>
                                <p class="text-sm text-text-secondary mb-2">Descarga la estrategia de integración</p>
                                <a href="ninjatrader-integration/TraderSurvivorExporter.cs" download class="btn-outline inline-flex items-center gap-2 px-4 py-2">
                                    <i class="fas fa-download"></i>
                                    Descargar TraderSurvivorExporter.cs
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="bg-surface-light border border-border rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center font-bold flex-shrink-0">2</div>
                            <div>
                                <h4 class="font-semibold mb-1">Importa en NinjaTrader</h4>
                                <p class="text-sm text-text-secondary">Sigue estos pasos en NinjaTrader 8:</p>
                                <ol class="text-sm text-text-secondary mt-2 ml-4 space-y-1" style="list-style: decimal;">
                                    <li>Presiona F3 o ve a Tools → Edit NinjaScript → Strategy</li>
                                    <li>Click derecho → New Strategy</li>
                                    <li>Nombra: "TraderSurvivorExporter"</li>
                                    <li>Copia y pega el contenido del archivo descargado</li>
                                    <li>Presiona F5 para compilar</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <div class="bg-surface-light border border-border rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center font-bold flex-shrink-0">3</div>
                            <div>
                                <h4 class="font-semibold mb-1">Configura la estrategia</h4>
                                <p class="text-sm text-text-secondary">En cualquier gráfico de NinjaTrader:</p>
                                <ol class="text-sm text-text-secondary mt-2 ml-4 space-y-1" style="list-style: decimal;">
                                    <li>Click derecho en el gráfico → Strategies</li>
                                    <li>Selecciona "TraderSurvivorExporter"</li>
                                    <li>Pega tu API Key en el campo "API Key"</li>
                                    <li>Marca "Habilitar Exportación" = True</li>
                                    <li>Click OK</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-6 p-4 bg-primary bg-opacity-10 border border-primary rounded-lg">
                    <div class="flex items-start gap-3">
                        <i class="fas fa-info-circle text-primary mt-1"></i>
                        <div>
                            <h4 class="font-semibold text-primary mb-1">¿Necesitas ayuda?</h4>
                            <p class="text-sm text-text-secondary">Consulta la guía completa en:</p>
                            <a href="ninjatrader-integration/README.md" target="_blank" class="text-primary text-sm underline">
                                Ver documentación completa →
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 flex justify-between">
                <button id="ninja-back-btn" style="display: none;" class="btn-secondary">
                    <i class="fas fa-arrow-left mr-2"></i>Atrás
                </button>
                <div class="flex-1"></div>
                <button id="ninja-next-btn" style="display: none;" class="btn-primary">
                    Siguiente<i class="fas fa-arrow-right ml-2"></i>
                </button>
                <button id="ninja-done-btn" style="display: none;" class="btn-primary">
                    <i class="fas fa-check mr-2"></i>Finalizar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('close-ninja-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('generate-ninja-key-btn').addEventListener('click', async () => {
        const btn = document.getElementById('generate-ninja-key-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...';
        
        const result = await generateNinjaTraderApiKey();
        
        if (result.success) {
            document.getElementById('ninja-api-key').value = result.apiKey;
            document.getElementById('api-key-container').style.display = 'block';
            document.getElementById('ninja-next-btn').style.display = 'block';
            btn.innerHTML = '<i class="fas fa-check mr-2"></i>API Key Generada';
            btn.classList.add('btn-success');
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-key mr-2"></i>Generar API Key';
            alert('Error: ' + result.error);
        }
    });
    
    document.getElementById('copy-ninja-key-btn').addEventListener('click', () => {
        const input = document.getElementById('ninja-api-key');
        input.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copy-ninja-key-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    });
    
    document.getElementById('ninja-next-btn').addEventListener('click', () => {
        document.getElementById('ninja-step-1').style.display = 'none';
        document.getElementById('ninja-step-2').style.display = 'block';
        document.getElementById('ninja-next-btn').style.display = 'none';
        document.getElementById('ninja-back-btn').style.display = 'block';
        document.getElementById('ninja-done-btn').style.display = 'block';
    });
    
    document.getElementById('ninja-back-btn').addEventListener('click', () => {
        document.getElementById('ninja-step-1').style.display = 'block';
        document.getElementById('ninja-step-2').style.display = 'none';
        document.getElementById('ninja-next-btn').style.display = 'block';
        document.getElementById('ninja-back-btn').style.display = 'none';
        document.getElementById('ninja-done-btn').style.display = 'none';
    });
    
    document.getElementById('ninja-done-btn').addEventListener('click', () => {
        modal.remove();
        showToast('¡NinjaTrader configurado!', 'Tus trades se exportarán automáticamente', 'success');
    });
}

// Exportar funciones para uso global
window.NinjaTraderIntegration = {
    generateApiKey: generateNinjaTraderApiKey,
    getCredentials: getNinjaTraderCredentials,
    revokeApiKey: revokeNinjaTraderApiKey,
    showSetupModal: showNinjaTraderSetupModal
};
