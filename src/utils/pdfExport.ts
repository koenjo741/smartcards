import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports HTML content to a PDF file in A4 portrait format.
 * 
 * @param html The HTML content to export
 * @param title The title for the PDF file (default: 'Card_Content')
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    // A4 dimensions in pt: 595.28 x 841.89
    // 1 pt = 1/72 inch
    // 2.5 cm = 2.5 / 2.54 * 72 = 70.866 pt
    const MARGIN_PT = 70.866;
    
    // Create a temporary container to render the HTML
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    // Match the PDF content width exactly for predictable scaling
    container.style.width = '453.5pt'; // (595.28 - 2 * 70.866)
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.fontFamily = 'Inter, sans-serif';

    // Add some basic styling to match the editor look
    container.className = 'ProseMirror';
    container.innerHTML = `
        <style>
            .ProseMirror {
                color: #000000 !important;
                font-family: 'Inter', sans-serif;
                font-size: 11pt; 
                line-height: 1.5;
                padding: 0;
            }
            .ProseMirror p { margin-bottom: 0.5em; }
            
            .ProseMirror h1 { font-size: 15pt; margin-top: 0; margin-bottom: 0.8em; font-weight: bold; }
            .ProseMirror h2 { font-size: 13pt; margin-top: 1.2em; margin-bottom: 0.6em; font-weight: bold; }
            .ProseMirror h3 { font-size: 12pt; margin-top: 1.2em; margin-bottom: 0.5em; font-weight: bold; }
            
            .ProseMirror ul, .ProseMirror ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
            .ProseMirror ul { list-style-type: disc !important; }
            .ProseMirror li { 
                margin-bottom: 0.3em;
            }
            
            mark, .ProseMirror [style*="background-color"] {
                padding: 1px 0;
                border-radius: 2px;
            }

            .ProseMirror table {
                width: 100% !important;
                border-collapse: separate !important;
                border-spacing: 0;
                margin: 1.5em 0;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
            }
            .ProseMirror th {
                background-color: #1e293b !important;
                color: #ffffff !important;
                padding: 6pt 8pt;
                text-align: left;
                font-size: 10pt;
                font-weight: 600;
                border-bottom: 1px solid #334155;
            }
            .ProseMirror td {
                padding: 6pt 8pt;
                font-size: 10pt;
                border-bottom: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                color: #334155;
            }
            .ProseMirror td:last-child { border-right: none; }
            .ProseMirror tr:last-child td { border-bottom: none; }
            .ProseMirror tr:nth-child(even) td { background-color: #f8fafc; }
            
            .ProseMirror img { max-width: 100%; height: auto; display: block; margin: 15px 0; border-radius: 4px; }
            
            .pdf-header { 
                margin-top: 0;
                margin-bottom: 25pt; 
                padding-bottom: 12pt; 
                border-bottom: 1pt solid #3b82f6;
            }
            .pdf-header h1 { margin: 0; color: #1e293b; font-size: 15pt; font-weight: bold; }
            .pdf-date { font-size: 8.5pt; color: #64748b; margin-top: 4pt; }
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
        // Wait for images to load
        const images = container.getElementsByTagName('img');
        const imgPromises = Array.from(images).map(imgElement => {
            const img = imgElement as HTMLImageElement;
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        await Promise.all(imgPromises);

        // Render with html2canvas - using windowWidth to prevent mobile-style scaling
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800 
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Exact content area
        const contentWidth = pageWidth - (2 * MARGIN_PT);
        const imgCanvasWidth = canvas.width;
        const imgCanvasHeight = canvas.height;
        
        const finalImgHeight = (imgCanvasHeight * contentWidth) / imgCanvasWidth;
        const usableHeight = pageHeight - (2 * MARGIN_PT);
        const totalPages = Math.ceil(finalImgHeight / usableHeight);

        // Function to add footer
        const addFooter = (pageNum: number) => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, pageHeight - MARGIN_PT, pageWidth, MARGIN_PT, 'F');

            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.line(MARGIN_PT, pageHeight - 35, pageWidth - MARGIN_PT, pageHeight - 35);

            pdf.setFontSize(9);
            pdf.setTextColor(120, 120, 120);
            const text = `Seite ${pageNum} / ${totalPages}`;
            const textWidth = (pdf.getStringUnitWidth(text) * 9) / pdf.internal.scaleFactor;
            pdf.text(text, pageWidth - MARGIN_PT - textWidth, pageHeight - 20);
        };

        // Render pages
        for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();
            
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            const sourceTop = i * usableHeight;
            
            pdf.addImage(
                imgData, 
                'JPEG', 
                MARGIN_PT, 
                MARGIN_PT - sourceTop, 
                contentWidth, 
                finalImgHeight
            );

            // Clean up Top Margin
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, MARGIN_PT - 0.5, 'F');

            addFooter(i + 1);
        }

        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`${sanitizedTitle}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Ein Fehler ist beim PDF-Export aufgetreten.');
    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
};
