import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports HTML content to a PDF file in A4 portrait format.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    // A4 dimensions in PT
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    
    // Margins (2.5cm = 70.866pt, 2cm = 56.692pt)
    const MT = 70.866; 
    const MB = 70.866;
    const MS = 56.692;

    const CONTENT_W = PAGE_W - (2 * MS);
    const USABLE_H = PAGE_H - MT - MB;

    // Fixed pixel width for rendering consistency
    const RENDER_WIDTH_PX = 642;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${RENDER_WIDTH_PX}px`;
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.padding = '0';
    container.style.margin = '0';

    container.className = 'ProseMirror';
    container.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            
            .ProseMirror {
                color: #000000 !important;
                font-family: 'Inter', sans-serif !important;
                font-size: 10pt !important;
                line-height: 1.5 !important;
                padding: 0;
            }
            .ProseMirror p { margin: 0 0 0.5em 0; }
            .ProseMirror h1 { font-size: 14pt !important; margin: 0 0 0.8em 0; font-weight: bold; }
            .ProseMirror h2 { font-size: 12pt !important; margin: 1.2em 0 0.6em 0; font-weight: bold; }
            .ProseMirror h3 { font-size: 11pt !important; margin: 1.2em 0 0.5em 0; font-weight: bold; }
            
            .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0 0 0.75em 0; }
            .ProseMirror li { margin-bottom: 0.3em; }

            /* Highlighter Fix: Using linear-gradient and forcing vertical-align for html2canvas precision */
            mark, .ProseMirror [style*="background-color"] {
                background: linear-gradient(to bottom, #00ffff 0%, #00ffff 100%) !important;
                padding: 0 !important;
                margin: 0 !important;
                display: inline;
                vertical-align: baseline;
            }

            .ProseMirror table {
                width: 100% !important;
                border-collapse: collapse;
                margin: 1em 0;
            }
            .ProseMirror th, .ProseMirror td {
                padding: 6pt 8pt;
                border: 0.5pt solid #e2e8f0;
                font-size: 9pt;
            }
            .ProseMirror th { background-color: #1e293b; color: #ffffff; }
            
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
        <div class="pdf-content">${html}</div>
    `;

    document.body.appendChild(container);

    try {
        await document.fonts.ready;
        const images = Array.from(container.getElementsByTagName('img'));
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        const canvas = await html2canvas(container, {
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: RENDER_WIDTH_PX
        });

        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        const pxToPt = CONTENT_W / canvas.width;
        const fullImgH = canvas.height * pxToPt;
        const totalPages = Math.ceil(fullImgH / USABLE_H);

        const addFooter = (pageNum: number) => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, PAGE_H - MB + 5, PAGE_W, MB, 'F');
            
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.5);
            pdf.line(MS, PAGE_H - 40, PAGE_W - MS, PAGE_H - 40);

            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            const text = `Seite ${pageNum} / ${totalPages}`;
            pdf.text(text, PAGE_W - MS - 40, PAGE_H - 25);
        };

        for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();

            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

            const sourceY = i * USABLE_H;
            
            // Critical fix for clipping: Using PNG and explicit crop behavior
            pdf.addImage(
                canvas.toDataURL('image/png'), 
                'PNG', 
                MS, 
                MT - sourceY, 
                CONTENT_W, 
                fullImgH
            );

            // Clean borders
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, PAGE_W, MT - 0.5, 'F');

            addFooter(i + 1);
        }

        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`${sanitizedTitle}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
    } finally {
        if (container.parentNode) document.body.removeChild(container);
    }
};
