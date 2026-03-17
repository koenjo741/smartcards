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
    // 2.5 cm = 2.5 / 2.54 * 72 = 70.86 pt
    const TOP_MARGIN_PT = 70.86;
    const BOTTOM_RESERVE_PT = 50; // Footer area + gap

    // Create a temporary container to render the HTML
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px'; 
    container.style.padding = '40px';
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.fontFamily = 'Inter, sans-serif';

    // Add some basic styling to match the editor look
    container.className = 'ProseMirror prose';
    container.innerHTML = `
        <style>
            .ProseMirror {
                color: #000000 !important;
                font-family: 'Inter', sans-serif;
                font-size: 12pt;
                line-height: 1.4;
            }
            .ProseMirror p { margin-bottom: 0.5em; }
            
            /* Font size overrides */
            .ProseMirror h1 { font-size: 16pt; margin-top: 0; margin-bottom: 0.8em; font-weight: bold; }
            .ProseMirror h2 { font-size: 14pt; margin-top: 1em; margin-bottom: 0.6em; font-weight: bold; }
            .ProseMirror h3 { font-size: 13pt; margin-top: 1em; margin-bottom: 0.5em; font-weight: bold; }
            
            /* Bullet alignment fix */
            .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 1rem; }
            .ProseMirror ul { list-style-type: disc !important; }
            .ProseMirror li { 
                margin-bottom: 0.25em; 
                display: list-item;
                vertical-align: middle;
            }
            
            /* Highlight fix: ensuring it wraps text tightly */
            mark, .ProseMirror [style*="background-color"] {
                display: inline-block;
                line-height: 1;
                padding: 2px 0;
            }

            /* Premium Table Design from index.css */
            .ProseMirror table {
                width: 100% !important;
                border-collapse: separate !important;
                border-spacing: 0;
                margin: 1em 0;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
            }
            .ProseMirror th {
                background-color: #1e293b !important;
                color: #ffffff !important;
                padding: 8px 10px;
                text-align: left;
                font-size: 11pt;
                font-weight: 600;
                border-bottom: 1px solid #334155;
            }
            .ProseMirror td {
                padding: 8px 10px;
                font-size: 11pt;
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
                margin-bottom: 20px; 
                padding-bottom: 10px; 
                border-bottom: 1.5px solid #3b82f6;
            }
            .pdf-header h1 { margin: 0; color: #1e293b; font-size: 16pt; font-weight: bold; }
            .pdf-date { font-size: 9pt; color: #64748b; margin-top: 5px; }
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
                img.onerror = resolve; // Continue even if image fails
            });
        });
        await Promise.all(imgPromises);

        // Render with html2canvas
        const canvas = await html2canvas(container, {
            scale: 2, // Better resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate content area (A4 minus margins)
        const contentWidth = pageWidth - 60; // 30pt side margins
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        
        // Useable area per page
        const usableHeight = pageHeight - TOP_MARGIN_PT - BOTTOM_RESERVE_PT;
        
        let heightLeft = contentHeight;

        // Calculate total pages based on usable height
        const totalPages = Math.ceil(contentHeight / usableHeight);

        // Function to add footer
        const addFooter = (pageNum: number) => {
            // Light gray line separator
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.5);
            pdf.line(30, pageHeight - 35, pageWidth - 30, pageHeight - 35);

            // Pagination text
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            const text = `Seite ${pageNum} / ${totalPages}`;
            const textWidth = pdf.getStringUnitWidth(text) * 10 / pdf.internal.scaleFactor;
            pdf.text(text, pageWidth - textWidth - 30, pageHeight - 20);
        };

        // Page loop
        let currentPage = 1;
        while (heightLeft > 0) {
            if (currentPage > 1) pdf.addPage();
            
            // Add image chunk
            // We slice the source image conceptually by shifting the position
            // Drawing the image starting at TOP_MARGIN_PT
            pdf.addImage(
                imgData, 
                'JPEG', 
                30, 
                TOP_MARGIN_PT - (usableHeight * (currentPage - 1)), 
                contentWidth, 
                contentHeight
            );

            // Draw a white rectangle over the footer area to prevent overflow
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, pageHeight - BOTTOM_RESERVE_PT + 15, pageWidth, BOTTOM_RESERVE_PT, 'F');
            
            // Draw a white rectangle over the top margin for subsequent pages if needed
            if (currentPage > 1) {
                pdf.rect(0, 0, pageWidth, TOP_MARGIN_PT - 5, 'F');
            }

            addFooter(currentPage);
            
            heightLeft -= usableHeight;
            currentPage++;
        }

        // Save the PDF
        pdf.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        throw error;
    } finally {
        // Clean up
        document.body.removeChild(container);
    }
};
