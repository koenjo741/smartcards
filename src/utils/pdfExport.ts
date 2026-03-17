import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

/**
 * PDF Export Utility v1.3.23 - Emergency Stability Patch
 * Reverting to minimal viable structure while maintaining aesthetic goals.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        // 1. Initialize fonts
        const pMake = (pdfMake as any).default || pdfMake;
        const pFonts = (pdfFonts as any).default || pdfFonts;
        pMake.vfs = pFonts.pdfMake?.vfs || pFonts.vfs;

        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const contentWidth = 481.89;

        // 2. Pre-process HTML (Safe HR replacement)
        let processedHtml = (html || '').trim() || '<p>&nbsp;</p>';
        processedHtml = processedHtml.replace(/<hr\s*\/?>/gi, 
            '<div style="border-top: 0.5pt solid #EAEAEA; margin: 10px 0;"></div>'
        );

        // 3. Convert HTML safely
        // We use a clean DOM container
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${processedHtml}</div>`, 'text/html');
        
        // Finalize highlighters (vertical centering)
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            if (el instanceof HTMLElement) {
                el.style.color = '#000000';
                if (!el.style.backgroundColor) el.style.backgroundColor = '#FFFF00';
            }
        });

        // Convert images
        const images = Array.from(doc.getElementsByTagName('img'));
        for (const img of images) {
            try { if (img.src && !img.src.startsWith('data:')) img.src = await getBase64Image(img.src); }
            catch (e) { img.remove(); }
        }

        const pdfContent = htmlToPdfmake(doc.body.innerHTML, { tableAutoSize: true });

        // 4. Document Definition - EXTREMELY SAFE STRUCTURE
        const docDef: any = {
            content: [
                { text: safeTitle, fontSize: 13, bold: true, margin: [0, 0, 0, 2], color: '#1e293b' },
                { text: `Exportiert am ${new Date().toLocaleDateString('de-DE')}`, fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 1, lineColor: '#3b82f6' }], margin: [0, 0, 0, 20] },
                // Wrapping in stack ensures that even if pdfContent is an empty array, it won't crash the top-level content list
                { stack: Array.isArray(pdfContent) ? pdfContent : [pdfContent] }
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87],
            styles: {
                mark: { background: '#FFFF00', color: '#000000', lineHeight: 1.0 }
            },
            footer: (curr: number, total: number) => ({
                margin: [56.69, 0, 56.69, 20],
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: '#DCDCDC' }], margin: [0, 25, 0, 10] },
                    { text: `Seite ${curr}/${total}`, alignment: 'right', fontSize: 8, color: '#999999' }
                ]
            })
        };

        // 5. Download
        pMake.createPdf(docDef).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('PDF Export fehlgeschlagen. Bitte versuche es erneut.');
    }
};

async function getBase64Image(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
            else reject('Canvas error');
        };
        img.onerror = () => reject('Image load error');
        img.src = url;
    });
}
