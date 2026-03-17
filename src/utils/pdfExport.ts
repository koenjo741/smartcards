import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

/**
 * Exports HTML content to a PDF file in A4 portrait format using pdfmake.
 * This ensures selectable text, correct page breaks, and exact layout.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        // Initialize pdfMake VFS (virtual file system) for fonts
        const pMake = (pdfMake as any).default || pdfMake;
        const pFonts = (pdfFonts as any).default || pdfFonts;
        pMake.vfs = pFonts.pdfMake?.vfs || pFonts.vfs;

        // 1. Prepare HTML and convert images
        const parser = new DOMParser();
        // Wrap with a div to ensure root styles are applied
        const doc = parser.parseFromString(`<div style="font-family: Helvetica, Arial, sans-serif; font-size: 10pt;">${html}</div>`, 'text/html');
        
        // Ensure all highlighters have black text for readability
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            (el as HTMLElement).style.color = '#000000';
            // Extract hex color if possible, or fallback to yellow
            const bg = (el as HTMLElement).style.backgroundColor;
            if (bg && bg.includes('rgb')) {
                // Keep it as is, html-to-pdfmake handles rgb
            } else if (!bg) {
                (el as HTMLElement).style.backgroundColor = '#FFFF00';
            }
        });

        const images = Array.from(doc.getElementsByTagName('img'));
        for (const img of images) {
            try {
                const dataUrl = await getBase64Image(img.src);
                img.src = dataUrl;
                img.style.maxWidth = '100%';
            } catch (err) {
                console.warn('PDF Image Load Error:', err);
            }
        }

        // 2. Convert HTML to pdfmake structure
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true
        });

        // 3. Define the document structure
        const docDefinition: any = {
            content: [
                { text: title, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 481.9, y2: 5, lineWidth: 1, lineColor: '#3b82f6' }], margin: [0, 0, 0, 20] },
                pdfContent
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // 2cm side, 2.5cm top/bottom in pt
            styles: {
                header: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 0, 0, 5],
                    color: '#1e293b'
                },
                subheader: {
                    fontSize: 8,
                    color: '#64748b',
                    margin: [0, 0, 0, 10]
                },
                h1: { fontSize: 14, bold: true, margin: [0, 10, 0, 10], color: '#1e293b' },
                h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], color: '#1e293b' },
                h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 4], color: '#1e293b' },
                p: { fontSize: 10, margin: [0, 0, 0, 5], lineHeight: 1.4 },
                mark: { background: '#FFFF00', color: '#000000' },
                table: { margin: [0, 10, 0, 10] },
                "html-table": { fontSize: 9 },
                "html-th": { bold: true, fillColor: '#1e293b', color: 'white', alignment: 'left' }
            },
            defaultStyle: {
                fontSize: 10,
                lineHeight: 1.4,
                color: '#000000'
            },
            footer: (currentPage: number, pageCount: number) => {
                return {
                    stack: [
                        {
                            canvas: [
                                {
                                    type: 'line',
                                    x1: 56.69, y1: 0,
                                    x2: 538.58, y2: 0, 
                                    lineWidth: 0.5,
                                    lineColor: '#DCDCDC'
                                }
                            ],
                            margin: [0, 0, 0, 10]
                        },
                        {
                            columns: [
                                { text: '', width: '*' },
                                {
                                    text: `Seite ${currentPage} / ${pageCount}`,
                                    fontSize: 8,
                                    color: '#999999',
                                    alignment: 'right',
                                    margin: [0, 0, 56.69, 0]
                                }
                            ]
                        }
                    ],
                    margin: [0, 0, 0, 20]
                };
            }
        };

        // 4. Create and Download
        pMake.createPdf(docDefinition).download(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Ein Fehler ist beim PDF-Export aufgetreten.');
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
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('No context');
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(`Load error for ${url}`);
        img.src = url;
    });
}
