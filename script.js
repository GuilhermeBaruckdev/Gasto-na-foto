const CHAVE_GASTOS = 'gasto-na-foto-comprovantes';
const inputFoto = document.querySelector('#foto');
const lista = document.querySelector('#lista');
const totalGasto = document.querySelector('#total-gasto');
const status = document.querySelector('#status');
const rascunho = document.querySelector('#rascunho');
const itensRascunho = document.querySelector('#itens-rascunho');
const totalConfirmado = document.querySelector('#total-confirmado');
const modalAjuda = document.querySelector('#modal-ajuda');

let total = 0;
let dadosPendentes = null;

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarParaEdicao(valor) {
  return valor.toFixed(2).replace('.', ',');
}

function definirStatus(mensagem, erro = false) {
  status.textContent = mensagem;
  status.classList.toggle('erro', erro);
}

function converterValorBrasileiro(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return Number.NaN;

  const texto = valor.replace(/R\$|\s/g, '');
  return Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
}

function extrairJson(resposta) {
  const texto = typeof resposta === 'string' ? resposta : resposta?.message?.content || String(resposta);
  const encontrado = texto.match(/\{[\s\S]*\}/);
  if (!encontrado) throw new Error('A IA não retornou dados no formato esperado.');
  return JSON.parse(encontrado[0]);
}

function normalizarDados({ itens = [], total: valorTotal } = {}) {
  const valor = converterValorBrasileiro(valorTotal);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Não foi possível identificar um valor válido. Confira o comprovante e tente outra foto.');
  }

  return {
    itens: Array.isArray(itens) ? itens.map(String) : [],
    total: valor
  };
}

function criarCartao({ itens, total: valor }) {
  const cartao = document.createElement('article');
  cartao.className = 'comprovante';

  const itensTexto = document.createElement('p');
  itensTexto.className = 'itens';
  itensTexto.textContent = itens.length ? itens.join('\n') : 'Itens não identificados';

  const rodape = document.createElement('p');
  rodape.className = 'total-nota';
  const rotulo = document.createElement('span');
  rotulo.textContent = 'Total do comprovante';
  const valorTexto = document.createElement('strong');
  valorTexto.textContent = formatarMoeda(valor);
  rodape.append(rotulo, valorTexto);
  cartao.append(itensTexto, rodape);
  return cartao;
}

function atualizarTotal() {
  totalGasto.textContent = formatarMoeda(total);
}

function lerGastosSalvos() {
  try {
    const gastos = JSON.parse(localStorage.getItem(CHAVE_GASTOS)) || [];
    return Array.isArray(gastos) ? gastos.map(normalizarDados) : [];
  } catch {
    return [];
  }
}

function salvarGastos(gastos) {
  localStorage.setItem(CHAVE_GASTOS, JSON.stringify(gastos));
}

function carregarGastos() {
  const gastos = lerGastosSalvos();
  gastos.forEach((gasto) => {
    lista.prepend(criarCartao(gasto));
    total += gasto.total;
  });
  atualizarTotal();
}

function mostrarRascunho(dados) {
  dadosPendentes = normalizarDados(dados);
  itensRascunho.textContent = dadosPendentes.itens.length
    ? dadosPendentes.itens.join('\n')
    : 'Itens não identificados';
  totalConfirmado.value = formatarParaEdicao(dadosPendentes.total);
  rascunho.hidden = false;
  totalConfirmado.focus();
}

function fecharRascunho() {
  dadosPendentes = null;
  rascunho.hidden = true;
  totalConfirmado.value = '';
}

async function analisarComprovante(arquivo) {
  if (!arquivo.type.startsWith('image/')) throw new Error('Selecione uma imagem de comprovante.');
  if (!window.puter?.ai) throw new Error('O serviço de IA não está disponível no momento.');

  const instrucao = `Você é um leitor cuidadoso de comprovantes brasileiros. Responda SOMENTE com JSON válido, sem markdown, neste formato: {"itens":["nome do item - R$ 0,00"],"total":"259,00"}.
Para o campo total, copie EXATAMENTE o valor ao lado de "TOTAL A PAGAR", "VALOR A PAGAR", "VALOR FINAL", "TOTAL", "TOTAL DA COMPRA" ou "VALOR PAGO". Não calcule nem some itens. Nunca use subtotal, quantidade, pedido, troco, parcelas, limite, juros ou outro produto. Se o total final não estiver legível, use null.`;
  return extrairJson(await window.puter.ai.chat(instrucao, arquivo));
}

inputFoto.addEventListener('change', async ({ target }) => {
  const arquivo = target.files?.[0];
  if (!arquivo) return;

  definirStatus('Lendo seu comprovante…');
  inputFoto.disabled = true;
  try {
    mostrarRascunho(await analisarComprovante(arquivo));
    definirStatus('Confira o valor e clique em “Salvar gasto”.');
  } catch (erro) {
    console.error(erro);
    definirStatus(erro.message || 'Não foi possível analisar a imagem. Tente outra foto.', true);
  } finally {
    inputFoto.disabled = false;
    inputFoto.value = '';
  }
});

document.querySelector('#salvar-gasto').addEventListener('click', () => {
  if (!dadosPendentes) return;

  const valorEditado = converterValorBrasileiro(totalConfirmado.value);
  if (!Number.isFinite(valorEditado) || valorEditado < 0) {
    definirStatus('Digite um valor válido, por exemplo: 259,00.', true);
    totalConfirmado.focus();
    return;
  }

  const gasto = { ...dadosPendentes, total: valorEditado };
  const gastos = lerGastosSalvos();
  gastos.push(gasto);
  salvarGastos(gastos);
  lista.prepend(criarCartao(gasto));
  total += gasto.total;
  atualizarTotal();
  fecharRascunho();
  definirStatus('Gasto salvo neste navegador.');
});

document.querySelector('#cancelar-rascunho').addEventListener('click', () => {
  fecharRascunho();
  definirStatus('Registro cancelado.');
});

document.querySelector('#abrir-ajuda').addEventListener('click', () => modalAjuda.showModal());
document.querySelector('#fechar-ajuda').addEventListener('click', () => modalAjuda.close());
document.querySelector('#entendi').addEventListener('click', () => modalAjuda.close());

carregarGastos ;
 


  