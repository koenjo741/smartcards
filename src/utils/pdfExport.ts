import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

// Robust initialization for all environments
const pm = (pdfMake as any).default || pdfMake;
const pf = (pdfFonts as any).default || pdfFonts;
if (pf && pf.pdfMake && pf.pdfMake.vfs) pm.vfs = pf.pdfMake.vfs;
else if (pf && pf.vfs) pm.vfs = pf.vfs;

/**
 * PDF Export Utility v1.3.25
 * - Fixes HR visibility and stability.
 * - Ensures perfect 2.0cm left alignment for text and footer.
 * - Refined font sizes (Title: 12pt, Body: 10pt).
 * - Pagination: "Seite X/Y".
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const contentWidth = 481.89; // Precise width for A4 with 2cm margins (595.28 - 2 * 56.69)
        
        // 1. Pre-process HTML
        // Use a table-based separator for HR - this is the MOST stable way in html-to-pdfmake
        let processedHtml = (html || '').trim() || '<p>&nbsp;</p>';
        processedHtml = processedHtml.replace(/<hr\s*\/?>/gi, 
            `<table style="width: 100%; margin-top: 10px; margin-bottom: 10px;">
                <tr style="border-top: 0.5pt solid #EAEAEA;">
                    <td style="height: 0; line-height: 0; padding: 0;">&nbsp;</td>
                </tr>
            </table>`
        );

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${processedHtml}</div>`, 'text/html');
        
        // Highlighters and specific styling
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            if (el instanceof HTMLElement) {
                el.style.color = '#000000';
                if (!el.style.backgroundColor) el.style.backgroundColor = '#FFFF00';
            }
        });

        // Convert images to Base64
        const images = Array.from(doc.getElementsByTagName('img'));
        for (const img of images) {
            try {
                if (img.src && !img.src.startsWith('data:')) {
                    img.src = await getBase64Image(img.src);
                }
                img.style.maxWidth = '100%';
            } catch (err) {
                img.remove();
            }
        }

        // 2. Convert to pdfmake structure
        // We use a clean body.innerHTML and pass it to htmlToPdfmake
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true,
            window: window
        });

        // 3. Document Definition
        const docDefinition: any = {
            content: [
                { text: safeTitle, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                // Blue line - precisely 1pt thick
                { 
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: contentWidth, y2: 5, lineWidth: 1, lineColor: '#3b82f6' }], 
                    margin: [0, 0, 0, 15] 
                },
                // Main content - wrapped in a stack for stability
                { stack: Array.isArray(pdfContent) ? pdfContent : [pdfContent] }
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // 2.0cm Left/Right, 2.5cm Top/Bottom
            styles: {
                header: { 
                    fontSize: 12, // Reduced by 1pt again as requested
                    bold: true, 
                    margin: [0, 0, 0, 4], 
                    color: '#1e293b' 
                },
                subheader: { fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
                p: { fontSize: 10, margin: [0, 0, 0, 5], lineHeight: 1.3 },
                mark: { 
                    background: '#FFFF00', 
                    color: '#000000',
                    lineHeight: 1.0 // Centers color background vertically
                },
                // Ensure converted tables (like our HR replacement) start at margin 0
                "html-table": { margin: [0, 5, 0, 5] }
            },
            defaultStyle: {
                fontSize: 10,
                lineHeight: 1.3,
                color: '#000000'
            },
            footer: (currentPage: number, pageCount: number) => {
                return {
                    stack: [
                        {
                            // Footer line - precisely 2.0cm left-aligned
                            canvas: [
                                { 
                                    type: 'line', 
                                    x1: 0, y1: 0, 
                                    x2: contentWidth, y2: 0, 
                                    lineWidth: 0.5, 
                                    lineColor: '#DCDCDC' 
                                }
                            ],
                            margin: [0, 28, 0, 10] // Positions line exactly where text begins vertically in the footer area
                        },
                        {
                            columns: [
                                { text: '', width: '*' },
                                {
                                    text: `Seite ${currentPage}/${pageCount}`,
                                    fontSize: 8,
                                    color: '#999999',
                                    alignment: 'right'
                                }
                            ]
                        }
                    ],
                    margin: [56.69, 0, 56.69, 20] // 2.0cm Left/Right margin for footer matches page margin
                };
            }
        };

        // 4. Download
        pm.createPdf(docDefinition).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Final Error:', error);
        alert('PDF Export fehlgeschlagen. Bitte prüfe die Konsole.');
    }
};

/**
 * Helper to convert image URL to base64 data URL
 */
function getBase64Image(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } else reject();
        };
        img.onerror = () => reject();
        img.src = url;
    });
}
