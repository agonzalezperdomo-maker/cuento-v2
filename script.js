// Ruta del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Nombre del PDF en la raíz del repositorio
const PDF_URL = 'cuento.pdf';

// Elementos del DOM
const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRead = document.getElementById('btn-read');
const btnFontInc = document.getElementById('btn-font-increase');
const btnFontDec = document.getElementById('btn-font-decrease');
const pageIndicator = document.getElementById('page-indicator');

let pageFlip = null;
let currentTextPages = []; // Almacena el texto extraído por página para la voz alta
let textScale = 1.0;
const synth = window.speechSynthesis;
let isSpeaking = false;

// Cargar el PDF de forma automática al iniciar la página
document.addEventListener('DOMContentLoaded', () => {
    fetchAndLoadPDF();
});

async function fetchAndLoadPDF() {
    try {
        loading.innerText = 'Cargando cuento.pdf desde el repositorio...';
        const response = await fetch(PDF_URL);
        
        if (!response.ok) {
            throw new Error(`No se pudo encontrar el archivo ${PDF_URL}. Verifica que esté en la raíz del proyecto.`);
        }
        
        const pdfData = await response.arrayBuffer();
        await renderBook(new Uint8Array(pdfData));
    } catch (error) {
        console.error('Error:', error);
        loading.innerText = 'Error al cargar el archivo "cuento.pdf". Asegúrate de que exista en el repositorio.';
    }
}

async function renderBook(pdfData) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';
    currentTextPages = [];

    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const totalPages = pdf.numPages;

        const firstPage = await pdf.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // 1. Renderizar gráficos
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);

            // 2. Extraer el texto para lectura en voz alta
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            currentTextPages.push(pageText);
        }

        bookContainer.style.display = 'block';

        // Inicializar PageFlip
        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch",
            minWidth: 300,
            maxWidth: pageWidth,
            minHeight: 400,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.5,
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);

        // Escuchar cambio de página
        pageFlip.on('flip', (e) => {
            updatePageIndicator();
            stopAudio(); // Detiene la voz al cambiar de página
        });

        updatePageIndicator();
        loading.style.display = 'none';

    } catch (error) {
        console.error('Error al procesar las páginas:', error);
        loading.innerText = 'Error al renderizar el cuento.';
    }
}

// Actualizar el indicador de página
function updatePageIndicator() {
    if (!pageFlip) return;
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pageFlip.getPageCount();
    pageIndicator.innerText = `Página ${current} de ${total}`;
}

// Botones de Navegación
btnPrev.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

btnNext.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

// Agrandar y achicar letra (Escalado del CSS)
btnFontInc.addEventListener('click', () => {
    if (textScale < 1.6) {
        textScale += 0.15;
        document.documentElement.style.setProperty('--text-scale', textScale);
    }
});

btnFontDec.addEventListener('click', () => {
    if (textScale > 0.8) {
        textScale -= 0.15;
        document.documentElement.style.setProperty('--text-scale', textScale);
    }
});

// Lectura en voz alta (Text-To-Speech)
btnRead.addEventListener('click', () => {
    if (!synth) {
        alert('Tu navegador no soporta lectura en voz alta.');
        return;
    }

    if (isSpeaking) {
        stopAudio();
    } else {
        readCurrentPage();
    }
});

function readCurrentPage() {
    const pageIndex = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    const textToRead = currentTextPages[pageIndex];

    if (!textToRead || textToRead.trim() === '') {
        speakText('Esta página no contiene texto para leer.');
        return;
    }

    speakText(textToRead);
}

function speakText(text) {
    synth.cancel(); // Cancelar lecturas previas

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES'; // Configurado en español
    utterance.rate = 0.9; // Velocidad ligeramente pausada para mejor claridad

    utterance.onstart = () => {
        isSpeaking = true;
        btnRead.innerText = '⏹ Detener Lectura';
        btnRead.classList.add('reading');
    };

    utterance.onend = () => {
        stopAudio();
    };

    utterance.onerror = () => {
        stopAudio();
    };

    synth.speak(utterance);
}

function stopAudio() {
    if (synth) synth.cancel();
    isSpeaking = false;
    btnRead.innerText = '🔊 Leer Página';
    btnRead.classList.remove('reading');
}