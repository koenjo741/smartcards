import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * PDF Export Utility v2.0.0 - Robust Visual Engine
 * - Uses jsPDF + html2canvas for "What You See Is What You Get" (WYSIWYG) export.
 * - Bypasses complex layout engine crashes of previous library.
 * - Ensures perfect alignment and styling matching the browser view.
 * - Robust handling of tables, images, and highlighters.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        
        // 1. Create a styled container for rendering (hidden from view)
        const printContainer = document.createElement('div');
        printContainer.id = 'pdf-export-container';
        
        // Force high-quality print styles (Black on White)
        Object.assign(printContainer.style, {
            position: 'absolute',
            left: '-9999px',
            top: '0',
            width: '180mm', // Standard A4 width minus safe margins
            padding: '15mm',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Inter", "Roboto", "Arial", sans-serif',
            lineHeight: '1.5',
            fontSize: '11pt',
            zIndex: '-1000'
        });

        // Add explicit CSS for the print container to handle common elements
        const style = document.createElement('style');
        style.id = 'pdf-export-styles';
        style.innerHTML = `
            #pdf-export-container h1 { font-size: 22pt; font-weight: 800; margin: 0 0 4pt 0; color: #0f172a; letter-spacing: -0.025em; }
            #pdf-export-container .metadata { font-size: 8pt; color: #64748b; margin-bottom: 12pt; font-weight: 500; }
            #pdf-export-container .blue-line { height: 1.5pt; background-color: #3b82f6; margin-bottom: 24pt; border-radius: 1pt; }
            #pdf-export-container p { margin-bottom: 10pt; color: #334155; }
            #pdf-export-container hr { border: 0; border-top: 0.5pt solid #e2e8f0; margin: 20pt 0; }
            #pdf-export-container table { width: 100%; border-collapse: collapse; margin: 16pt 0; table-layout: auto; }
            #pdf-export-container th, #pdf-export-container td { border: 0.5pt solid #cbd5e1; padding: 8pt 10pt; text-align: left; font-size: 10pt; }
            #pdf-export-container th { background-color: #f8fafc; color: #475569; font-weight: 600; }
            #pdf-export-container mark { background-color: #fef08a; color: #1e293b; padding: 0 2pt; border-radius: 2pt; }
            #pdf-export-container img { max-width: 100%; height: auto; border-radius: 4pt; margin: 12pt 0; }
            #pdf-export-container ul, #pdf-export-container ol { margin: 10pt 0; padding-left: 20pt; }
            #pdf-export-container li { margin-bottom: 4pt; }
            #pdf-export-container .prose { max-width: none !important; }
        `;
        document.head.appendChild(style);

        // Sanitize HTML slightly (remove background-color from root elements if they come from editor)
        const sanitizedHtml = (html || '')
            .replace(/background-color\s*:\s*transparent;?/gi, '')
            .replace(/color\s*:\s*inherit;?/gi, '');

        printContainer.innerHTML = `
            <h1>${safeTitle}</h1>
            <div class="metadata">Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="blue-line"></div>
            <div class="content prose">${sanitizedHtml}</div>
        `;
        
        document.body.appendChild(printContainer);

        // Ensure images are loaded before capturing
        const images = printContainer.getElementsByTagName('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        });
        await Promise.all(imagePromises);

        // 2. Capture with html2canvas (High Resolution)
        const canvas = await html2canvas(printContainer, {
            scale: 2.5, // High resolution for sharp text
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1000, // Fixed width for consistent layout
            removeContainer: true
        });

        // 3. Construct PDF with Multi-page Support
        const imgData = canvas.toDataURL('image/png', 0.95);
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const canvasHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = canvasHeightInPdf;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightInPdf, undefined, 'FAST');
        heightLeft -= pdfHeight;

        // Add subsequent pages if content is longer than A4
        while (heightLeft > 0) {
            position = heightLeft - canvasHeightInPdf;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightInPdf, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }

        // 4. Trigger Download
        pdf.save(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

        // Cleanup
        document.body.removeChild(printContainer);
        document.head.removeChild(style);

    } catch (error) {
        console.error('PDF Export Critical Error:', error);
        alert('PDF Export fehlgeschlagen. Bitte versuchen Sie es erneut.');
        
        // Clean up in case of error
        const container = document.getElementById('pdf-export-container');
        if (container) document.body.removeChild(container);
        const style = document.getElementById('pdf-export-styles');
        if (style) document.head.removeChild(style);
    }
};
