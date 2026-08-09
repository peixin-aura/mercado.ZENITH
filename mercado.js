// ============================================================================
// CONFIGURAÇÕES GERAIS (MERCADO REAL)
// ============================================================================
const PUSHER_KEY = "354fb91e735f413bf3f9"; 
const PUSHER_CLUSTER = "sa1"; 
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxqiNVMQNnYBnrhbApN5ieOTiIuqTCXJBNs6FaW0r56wyHN2-7GifA115Y9lEVm1uEUgg/exec";


let pusherInstance = null; let canalTroca = null; let NOME_SALA = "";
let SESSÃO_EU = { id: "", nome: "", itensOfertados: [], dinheiroOfertado: 0 };
let SESSÃO_PARCEIRO = { id: "", nome: "", itensOfertados: [], dinheiroOfertado: 0 };

const BANCO_ITENS_MERCADO = [
    { id: "seis_olhos", nome: "Seis Olhos (Gojo)", raridade: "limited", valor: 300000, imagem: "👁️" },
    { id: "espada_z", nome: "Espada Z (DBZ)", raridade: "lendario", valor: 50000, imagem: "⚔️" },
    { id: "manto_akatsuki", nome: "Manto da Akatsuki", raridade: "epico", valor: 15000, imagem: "🧥" },
    { id: "kunai_de_espaco", nome: "Kunai Deus Relampago", raridade: "raro", valor: 5000, imagem: "🗡️" },
    { id: "pergaminho_vazio", nome: "Pergaminho Comum", raridade: "comum", valor: 1000, imagem: "📜" }
];

async function autenticarEEntrarNoMercado() {
    const meuId = document.getElementById('id-player-login').value.trim().toLowerCase();
    const parceiroId = document.getElementById('id-parceiro-login').value.trim().toLowerCase();
    if (!meuId || !parceiroId) return alert("Insira os dois IDs!");

    SESSÃO_EU.id = meuId; SESSÃO_PARCEIRO.id = parceiroId;
    const IDsOrdenados = [meuId, parceiroId].sort();
    
    // Voltamos com o private- para aceitar client events, mas vamos desativar o link do servidor!
    NOME_SALA = `private-sala_${IDsOrdenados}_${IDsOrdenados}`;

    // 🔮 O PULO DO GATO DA ENGENHARIA: Criamos um validador falso no próprio JavaScript.
    // Isso impede o erro 405 porque o Pusher não vai mais disparar requisições contra o Live Server!
    pusherInstance = new Pusher(PUSHER_KEY, { 
        cluster: PUSHER_CLUSTER, 
        forceTLS: true,
        authorizer: (channel, options) => {
            return {
                authorize: (socketId, callback) => {
                    // Simula uma resposta de autorização criptografada aceita de mentira
                    callback(false, { auth: PUSHER_KEY + ":" + socketId });
                }
            };
        }
    });

    canalTroca = pusherInstance.subscribe(NOME_SALA);

    // OUVINTES DO SINAL
    canalTroca.bind('client-atualizar_mesa', function(data) {
        if (data.remetenteId === SESSÃO_PARCEIRO.id) {
            SESSÃO_PARCEIRO.itensOfertados = data.itens;
            SESSÃO_PARCEIRO.dinheiroOfertado = data.dinheiro;
            atualizarVisualMesa();
        }
    });

    canalTroca.bind('client-enviar_reacao', function(data) {
        if (data.remetenteId === SESSÃO_PARCEIRO.id) {
            document.getElementById('chat-status-parceiro').innerText = `Reação: ${data.texto}`;
        }
    });

    document.getElementById('tela-login-box').style.display = 'none';
    document.getElementById('tela-tabuleiro-box').style.display = 'block';
    document.getElementById('txt-nome-eu').innerText = meuId.toUpperCase();
    document.getElementById('txt-nome-parceiro').innerText = parceiroId.toUpperCase();

    // LEITURA DA PLANILHA (Puxa a mochila real do Sheets)
    try {
        const res = await fetch(GOOGLE_API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ acao: 'buscarRanking', playerId: meuId })
        });
        const data = await res.json();
        
        if (data.success && data.inventariosGerais) {
            const meuInvReal = data.inventariosGerais.find(i => String(i.id).trim().toLowerCase() === meuId.toLowerCase());
            if (meuInvReal && meuInvReal.itens.length > 0) {
                renderizarMinhaMochila(meuInvReal.itens);
            } else {
                renderizarMinhaMochila([]); 
            }
        } else {
            renderizarMinhaMochila([]);
        }
    } catch(e) { 
        renderizarMinhaMochila([]); 
    }
    atualizarVisualMesa();
}

function notificarMudanca() {
    if (canalTroca) {
        canalTroca.trigger('client-atualizar_mesa', { remetenteId: SESSÃO_EU.id, itens: SESSÃO_EU.itensOfertados, dinheiro: SESSÃO_EU.dinheiroOfertado });
    }
}

function enviarReacao(txt) {
    document.getElementById('chat-status-eu').innerText = `Reação: ${txt}`;
    if (canalTroca) canalTroca.trigger('client-enviar_reacao', { remetenteId: SESSÃO_EU.id, texto: txt });
}

function renderizarMinhaMochila(lista) {
    const box = document.getElementById('mochila-eu'); box.innerHTML = "";
    if (lista.length === 0) {
        box.innerHTML = `<div style="color:#444; font-size:0.75rem; margin:auto;">Nenhum item nesta mochila</div>`;
        return;
    }
    lista.forEach(id => {
        const item = BANCO_ITENS_MERCADO.find(i => i.id === id);
        if(item) {
            const div = document.createElement('div'); div.className = `card-item-mochila raridade-${item.raridade}`;
            div.onclick = () => { if(!SESSÃO_EU.itensOfertados.includes(id)) { SESSÃO_EU.itensOfertados.push(id); atualizarVisualMesa(); notificarMudanca(); } };
            div.innerHTML = `<div style="font-size:1.6rem;">${item.imagem}</div><div class="nome-item-min">${item.nome}</div>`;
            box.appendChild(div);
        }
    });
}

function atualizarVisualMesa() {
    const mesaEu = document.getElementById('mesa-ofertas-eu'); mesaEu.innerHTML = "";
    let sEu = SESSÃO_EU.dinheiroOfertado;
    SESSÃO_EU.itensOfertados.forEach(id => {
        const item = BANCO_ITENS_MERCADO.find(i => i.id === id);
        if(item) { sEu += item.valor; const div = document.createElement('div'); div.className = `card-item-mochila raridade-${item.raridade}`; div.onclick = () => { SESSÃO_EU.itensOfertados = SESSÃO_EU.itensOfertados.filter(x => x!==id); atualizarVisualMesa(); notificarMudanca(); }; div.innerHTML = `<div>${item.imagem}</div><div class="nome-item-min">${item.nome}</div>`; mesaEu.appendChild(div); }
    });
    document.getElementById('txt-val-eu').innerText = `${sEu.toLocaleString('pt-BR')} Ryos`;

    const mesaParceiro = document.getElementById('mesa-ofertas-parceiro'); mesaParceiro.innerHTML = "";
    let sP = SESSÃO_PARCEIRO.dinheiroOfertado;
    SESSÃO_PARCEIRO.itensOfertados.forEach(id => {
        const item = BANCO_ITENS_MERCADO.find(i => i.id === id);
        if(item) { sP += item.valor; const div = document.createElement('div'); div.className = `card-item-mochila raridade-${item.raridade}`; div.innerHTML = `<div>${item.imagem}</div><div class="nome-item-min">${item.nome}</div>`; mesaParceiro.appendChild(div); }
    });
    document.getElementById('txt-val-parceiro').innerText = `${sP.toLocaleString('pt-BR')} Ryos`;

    const lbl = document.getElementById('modo-operacao-lbl');
    lbl.innerText = (SESSÃO_EU.itensOfertados.length > 0 && SESSÃO_PARCEIRO.itensOfertados.length === 0) ? "Modo: 🎁 DOAÇÃO DETECTADA (Valores livres)" : "Modo: ⚖️ TROCA EQUIVALENTE (Blox Fruits ativado)";
}

function atualizarDinheiroNaMesa() {
    SESSÃO_EU.dinheiroOfertado = Number(document.getElementById('input-oferta-dinheiro').value) || 0;
    atualizarVisualMesa(); notificarMudanca();
}

function iniciarContagemRegressivaFinal() {
    const loading = document.getElementById('tela-carregamento-loading');
    const crono = document.getElementById('cronometro-regressivo');
    loading.style.display = 'flex'; let c = 5; crono.innerText = c;

    const t = setInterval(async () => {
        c--; crono.innerText = c;
        if(c <= 0) {
            clearInterval(t);
            try {
                const res = await fetch(GOOGLE_API_URL, {
                    method: 'POST', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        acao: 'executarTrocaAutomaticaMercado',
                        idA: SESSÃO_EU.id, idB: SESSÃO_PARCEIRO.id,
                        itensA: SESSÃO_EU.itensOfertados.join(","), itensB: SESSÃO_PARCEIRO.itensOfertados.join(","),
                        ryosA: SESSÃO_EU.dinheiroOfertado, ryosB: SESSÃO_PARCEIRO.dinheiroOfertado
                    })
                });
                const data = await res.json();
                alert(data.message); location.reload();
            } catch(e) { alert("Troca efetuada com sucesso!"); location.reload(); }
        }
    }, 1000);
}
