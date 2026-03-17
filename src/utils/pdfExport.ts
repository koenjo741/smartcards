import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

/**
 * Exports HTML content to a PDF file in A4 portrait format using pdfmake.
 * Refined for exact alignment, title sizing, and line styling.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        // Initialize VFS (fonts)
        if ((pdfFonts as any).pdfMake?.vfs) {
            (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
        } else if ((pdfFonts as any).vfs) {
            (pdfMake as any).vfs = (pdfFonts as any).vfs;
        }

        // 1. Prepare HTML and convert images
        const parser = new DOMParser();
        // Use a wrapper with specific line-height to help with highlighter centering
        const doc = parser.parseFromString(`<div style="line-height: 1.2;">${html}</div>`, 'text/html');
        
        // Finalize highlighters and HRs
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            (el as HTMLElement).style.color = '#000000';
            const bg = (el as HTMLElement).style.backgroundColor;
            if (!bg || bg === '') {
                (el as HTMLElement).style.backgroundColor = '#FFFF00';
            }
        });

        // Convert images to Base64
        const images = Array.from(doc.getElementsByTagName('img'));
        for (const img of images) {
            try {
                if (img.src && !img.src.startsWith('data:')) {
                    const dataUrl = await getBase64Image(img.src);
                    img.src = dataUrl;
                }
                img.style.maxWidth = '100%';
            } catch (err) {
                console.warn('PDF Image conversion failed:', err);
            }
        }

        // 2. Convert HTML to pdfmake structure
        // We handle HR tags specially to match footer aesthetics
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true,
            imagesByReference: false
        });

        // 3. Define PDF document
        const docDefinition: any = {
            content: [
                { text: title, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                // Blue line after header
                { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 481.9, y2: 5, lineWidth: 1, lineColor: '#3b82f6' }], margin: [0, 0, 0, 20] },
                pdfContent
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // 2cm left/right, 2.5cm top/bottom
            styles: {
                header: { 
                    fontSize: 13, // Reduced by 1pt (from 14)
                    bold: true, 
                    margin: [0, 0, 0, 5], 
                    color: '#1e293b' 
                },
                subheader: { fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
                h1: { fontSize: 13, bold: true, margin: [0, 10, 0, 10], color: '#1e293b' }, // Match title
                h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], color: '#1e293b' },
                h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 4], color: '#1e293b' },
                p: { fontSize: 10, margin: [0, 0, 0, 5], lineHeight: 1.35 },
                // Highlighter fine-tuning: slightly lower line-height for the marker itself
                mark: { 
                    background: '#FFFF00', 
                    color: '#000000',
                    lineHeight: 1.05 
                },
                // Style for <hr> converted by html-to-pdfmake
                "html-hr": {
                    margin: [0, 12, 0, 12],
                    color: '#DCDCDC' // Match footer line color
                },
                table: { margin: [0, 10, 0, 10] },
                "html-table": { fontSize: 9 },
                "html-th": { bold: true, fillColor: '#1e293b', color: 'white', alignment: 'left' }
            },
            defaultStyle: {
                fontSize: 10,
                lineHeight: 1.35, // Reduced slightly to help with centering and fit
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

        // 4. Generate and Download
        pdfMake.createPdf(docDefinition).download(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('PDF Export fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)));
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
            if (!ctx) return reject('No canvas context');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(`Loading error: ${url}`);
        img.src = url;
    });
}
