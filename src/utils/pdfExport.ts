import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports HTML content to a PDF file in A4 portrait format.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    // A4 dimensions: 210mm x 297mm
    // In pt (1pt = 1/72 inch): 595.28 x 841.89
    const PAGE_WIDTH_PT = 595.28;
    const PAGE_HEIGHT_PT = 841.89;
    
    // Margins: 2.5cm top/bottom, 2cm sides
    const MARGIN_TOP_PT = 70.866; 
    const MARGIN_BOTTOM_PT = 70.866;
    const MARGIN_SIDE_PT = 56.692;

    const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - (2 * MARGIN_SIDE_PT);
    const USABLE_HEIGHT_PT = PAGE_HEIGHT_PT - MARGIN_TOP_PT - MARGIN_BOTTOM_PT;

    // Create container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${CONTENT_WIDTH_PT}pt`; 
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.padding = '0';
    container.style.margin = '0';

    // Advanced CSS to fix highlights and line clipping
    container.className = 'ProseMirror';
    container.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            
            .ProseMirror {
                color: #000000 !important;
                font-family: 'Inter', sans-serif !important;
                font-size: 10pt !important;
                line-height: 1.5 !important;
                word-wrap: break-word;
            }
            .ProseMirror * { box-sizing: border-box; }
            .ProseMirror p { margin: 0 0 0.5em 0; }
            
            .ProseMirror h1 { font-size: 14pt !important; margin: 0 0 0.8em 0; font-weight: bold; }
            .ProseMirror h2 { font-size: 12pt !important; margin: 1.2em 0 0.6em 0; font-weight: bold; }
            .ProseMirror h3 { font-size: 11pt !important; margin: 1.2em 0 0.5em 0; font-weight: bold; }
            
            .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0 0 0.75em 0; }
            .ProseMirror li { margin-bottom: 0.3em; }

            /* Fix for Highlighter Shifting in html2canvas */
            mark, .ProseMirror [style*="background-color"] {
                background-color: inherit; /* default */
                display: inline-block;
                line-height: 1.1;
                padding: 1px 0;
                margin-top: -1px;
                margin-bottom: -1px;
                border-radius: 1px;
                vertical-align: middle;
            }

            .ProseMirror table {
                width: 100% !important;
                border-collapse: collapse;
                margin: 1em 0;
                table-layout: fixed;
            }
            .ProseMirror th, .ProseMirror td {
                padding: 6pt 8pt;
                border: 0.5pt solid #e2e8f0;
                font-size: 9pt;
            }
            .ProseMirror th {
                background-color: #1e293b;
                color: #ffffff;
                font-weight: bold;
            }
            .ProseMirror tr:nth-child(even) td { background-color: #f8fafc; }
            
            .ProseMirror img { max-width: 100%; height: auto; display: block; margin: 15pt 0; }
            
            .pdf-header { 
                border-bottom: 1pt solid #3b82f6;
                padding-bottom: 10pt;
                margin-bottom: 20pt;
            }
            .pdf-header h1 { margin: 0; font-size: 14pt; color: #1e293b; }
            .pdf-date { font-size: 8pt; color: #64748b; margin-top: 4pt; }
        </style>
        <div class="pdf-header">
            <h1>${title}</h1>
            <div class="pdf-date">Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="pdf-content">
            ${html}
        </div>
    `;

    document.body.appendChild(container);

    try {
        // Wait for fonts and images
        await document.fonts.ready;
        const images = Array.from(container.getElementsByTagName('img'));
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        // Capture with high scale and fixed width
        const canvas = await html2canvas(container, {
            scale: 3, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: container.offsetWidth,
            windowWidth: container.offsetWidth
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // The image in PDF points
        const imgPdfHeight = (canvasHeight * CONTENT_WIDTH_PT) / canvasWidth;
        const totalPages = Math.ceil(imgPdfHeight / USABLE_HEIGHT_PT);

        const addFooter = (pageNum: number) => {
            // White out bottom margin area
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, PAGE_HEIGHT_PT - MARGIN_BOTTOM_PT, PAGE_WIDTH_PT, MARGIN_BOTTOM_PT, 'F');
            
            // Footer separator
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.5);
            pdf.line(MARGIN_SIDE_PT, PAGE_HEIGHT_PT - 40, PAGE_WIDTH_PT - MARGIN_SIDE_PT, PAGE_HEIGHT_PT - 40);

            // Pagination
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            const text = `Seite ${pageNum} / ${totalPages}`;
            const textWidth = pdf.getStringUnitWidth(text) * 8 / pdf.internal.scaleFactor;
            pdf.text(text, PAGE_WIDTH_PT - MARGIN_SIDE_PT - textWidth, PAGE_HEIGHT_PT - 25);
        };

        for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();

            // Clear page
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, PAGE_WIDTH_PT, PAGE_HEIGHT_PT, 'F');

            // Draw content chunk
            const sourceY = i * USABLE_HEIGHT_PT;
            
            // Critical positioning: 
            // We want the part of the image starting at sourceY to appear at MARGIN_TOP_PT.
            // So we draw the whole image at Y = MARGIN_TOP_PT - sourceY.
            pdf.addImage(
                imgData, 
                'JPEG', 
                MARGIN_SIDE_PT, 
                MARGIN_TOP_PT - sourceY, 
                CONTENT_WIDTH_PT, 
                imgPdfHeight
            );

            // Hide overflow at the top (covers parts of previous page that bled in)
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, PAGE_WIDTH_PT, MARGIN_TOP_PT - 0.5, 'F');

            addFooter(i + 1);
        }

        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`${sanitizedTitle}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Ein Fehler ist beim Exportieren aufgetreten.');
    } finally {
        if (container.parentNode) document.body.removeChild(container);
    }
};
