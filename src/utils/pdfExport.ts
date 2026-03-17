import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

/**
 * Exports HTML content to a PDF file in A4 portrait format using pdfmake.
 * Safety-first version to prevent "toLowerCase" errors and handle HR elements correctly.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        // Initialize VFS (fonts)
        const pMake = (pdfMake as any).default || pdfMake;
        const pFonts = (pdfFonts as any).default || pdfFonts;
        
        if (pFonts.pdfMake?.vfs) {
            pMake.vfs = pFonts.pdfMake.vfs;
        } else if (pFonts.vfs) {
            pMake.vfs = pFonts.vfs;
        }

        // 1. Prepare HTML and convert images
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        
        // Finalize highlighters
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.color = '#000000';
            const bg = htmlEl.style.backgroundColor;
            if (!bg || bg === '') {
                htmlEl.style.backgroundColor = '#FFFF00';
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

        // 2. Convert HTML to pdfmake structure with safely guarded customTag
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true,
            customTag: (element: any) => {
                // Safeguard against non-element nodes or missing properties
                if (!element || typeof element.nodeName !== 'string') return;
                
                const nodeName = element.nodeName.toLowerCase();
                if (nodeName === 'hr') {
                    return {
                        canvas: [
                            {
                                type: 'line',
                                x1: 0, y1: 0,
                                x2: 481.89, // Precise content width for A4 (210mm - 2x2.0cm)
                                lineWidth: 0.5,
                                lineColor: '#EAEAEA'
                            }
                        ],
                        margin: [0, 12, 0, 12]
                    };
                }
            }
        });

        // 3. Define PDF document
        const docDefinition: any = {
            content: [
                { text: title, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 481.89, y2: 5, lineWidth: 1, lineColor: '#3b82f6' }], margin: [0, 0, 0, 20] },
                pdfContent
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // 2cm Left/Right, 2.5cm Top/Bottom
            styles: {
                header: { fontSize: 13, bold: true, margin: [0, 0, 0, 5], color: '#1e293b' },
                subheader: { fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
                h1: { fontSize: 13, bold: true, margin: [0, 10, 0, 10], color: '#1e293b' },
                h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], color: '#1e293b' },
                h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 4], color: '#1e293b' },
                p: { fontSize: 10, margin: [0, 0, 0, 5], lineHeight: 1.3 },
                mark: { 
                    background: '#FFFF00', 
                    color: '#000000',
                    lineHeight: 1.05 
                },
                table: { margin: [0, 10, 0, 10] },
                "html-table": { fontSize: 9 },
                "html-th": { bold: true, fillColor: '#1e293b', color: 'white', alignment: 'left' }
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
                            canvas: [
                                { 
                                    type: 'line', 
                                    x1: 0, y1: 28.35, 
                                    x2: 481.89, y2: 28.35, 
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
                                    text: `Seite ${currentPage}/${pageCount}`,
                                    fontSize: 8,
                                    color: '#999999',
                                    alignment: 'right',
                                    margin: [0, 0, 0, 0]
                                }
                            ]
                        }
                    ],
                    margin: [56.69, 0, 56.69, 20]
                };
            }
        };

        // 4. Generate and Download
        const safeTitle = (title || 'Export').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pMake.createPdf(docDefinition).download(`${safeTitle}.pdf`);

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
