import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports HTML content to a PDF file in A4 portrait format.
 * 
 * @param html The HTML content to export
 * @param title The title for the PDF file (default: 'Card_Content')
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    // Create a temporary container to render the HTML
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px'; // Approx width for A4 content with margins
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
                font-size: 14px;
                line-height: 1.5;
            }
            .ProseMirror p { margin-bottom: 0.75em; }
            .ProseMirror h1 { font-size: 2em; margin-top: 0.67em; margin-bottom: 0.67em; font-weight: bold; }
            .ProseMirror h2 { font-size: 1.5em; margin-top: 0.83em; margin-bottom: 0.83em; font-weight: bold; }
            .ProseMirror h3 { font-size: 1.17em; margin-top: 1em; margin-bottom: 1em; font-weight: bold; }
            
            .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 1rem; }
            .ProseMirror ul { list-style-type: disc !important; }
            .ProseMirror ol { list-style-type: decimal !important; }
            .ProseMirror li { margin-bottom: 0.25em; }
            
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
                padding: 10px 12px;
                text-align: left;
                font-weight: 600;
                border-bottom: 1px solid #334155;
            }
            .ProseMirror td {
                padding: 10px 12px;
                border-bottom: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                color: #334155;
            }
            .ProseMirror td:last-child { border-right: none; }
            .ProseMirror tr:last-child td { border-bottom: none; }
            .ProseMirror tr:nth-child(even) td { background-color: #f8fafc; }
            
            .ProseMirror img { max-width: 100%; height: auto; display: block; margin: 15px 0; border-radius: 4px; }
            
            .pdf-header { 
                margin-bottom: 30px; 
                padding-bottom: 15px; 
                border-bottom: 2px solid #3b82f6;
            }
            .pdf-header h1 { margin: 0; color: #1e293b; font-size: 28px; }
            .pdf-date { font-size: 11px; color: #64748b; margin-top: 5px; }
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
        const imgPromises = Array.from(images).map(img => {
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
        
        // A4 dimensions in pt: 595.28 x 841.89
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate dimensions to fit width
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Calculate total pages
        const totalPages = Math.ceil(imgHeight / pageHeight);

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

        // Add first page
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        addFooter(1);
        heightLeft -= pageHeight;
        let currentPage = 1;

        // Add subsequent pages if content is longer than one page
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            currentPage++;
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            addFooter(currentPage);
            heightLeft -= pageHeight;
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
