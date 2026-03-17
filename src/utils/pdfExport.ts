import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

// Initialize fonts
const pMake = (pdfMake as any).default || pdfMake;
const pFonts = (pdfFonts as any).default || pdfFonts;
if (pFonts.pdfMake?.vfs) pMake.vfs = pFonts.pdfMake.vfs;
else if (pFonts.vfs) pMake.vfs = pFonts.vfs;

/**
 * PDF Export Utility v1.3.26
 * - Corrects internal HR lines (table-less canvas approach for absolute look-alike).
 * - Forces identical 2.0cm left-alignment for text block and footer.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const contentWidth = 481.89; // 210mm - 2*20mm = 170mm = 481.89pt

        // 1. Prepare HTML and extract content
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html');
        
        // Highlighters
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

        // 2. Convert to pdfmake structure AND map HRs to clean lines
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true,
            customTag: (el: any) => {
                // Safeguard against non-element nodes or missing properties
                if (!el || !el.nodeName) return;
                
                if (el.nodeName.toLowerCase() === 'hr') {
                    // Match footer line exactly: canvas line, 0.5pt, color #EAEAEA
                    return {
                        canvas: [
                            {
                                type: 'line',
                                x1: 0, y1: 0,
                                x2: contentWidth, y2: 0,
                                lineWidth: 0.5,
                                lineColor: '#EAEAEA'
                            }
                        ],
                        margin: [0, 12, 0, 12]
                    };
                }
            }
        });

        // 3. Document Definition
        const docDefinition: any = {
            content: [
                { text: safeTitle, fontSize: 13, bold: true, margin: [0, 0, 0, 2], color: '#1e293b' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    fontSize: 8, color: '#64748b', margin: [0, 0, 0, 12] 
                },
                { 
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 1, lineColor: '#3b82f6' }], 
                    margin: [0, 0, 0, 20] 
                },
                // Wrapper stack for stability
                { stack: Array.isArray(pdfContent) ? pdfContent : [pdfContent] }
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // EXACT 2.0cm (56.69pt) LEFT/RIGHT
            styles: {
                mark: { background: '#FFFF00', color: '#000000', lineHeight: 1.0 },
                p: { margin: [0, 0, 0, 5], lineHeight: 1.3 },
                // Final styles for tables
                table: { margin: [0, 5, 0, 10] },
                "html-table": { fontSize: 9 }
            },
            defaultStyle: {
                fontSize: 10,
                lineHeight: 1.3
            },
            footer: (curr: number, total: number) => {
                return {
                    // Margin matches page exactly (56.69pt = 2.0cm)
                    margin: [56.69, 0, 56.69, 20],
                    stack: [
                        {
                            canvas: [
                                { 
                                    type: 'line', 
                                    x1: 0, y1: 0, 
                                    x2: contentWidth, y2: 0, 
                                    lineWidth: 0.5, 
                                    lineColor: '#DCDCDC' 
                                }
                            ],
                            margin: [0, 28, 0, 10]
                        },
                        {
                            columns: [
                                { text: '', width: '*' },
                                { text: `Seite ${curr}/${total}`, fontSize: 8, color: '#999999', alignment: 'right' }
                            ]
                        }
                    ]
                };
            }
        };

        // 4. Download
        pMake.createPdf(docDefinition).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Final Error:', error);
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
            else reject();
        };
        img.onerror = () => reject();
        img.src = url;
    });
}
