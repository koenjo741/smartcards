import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

// Set VFS fonts globally for stability
if ((pdfFonts as any).pdfMake?.vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

/**
 * Exports HTML content to a PDF file.
 * Refined structure to prevent layout errors and ensure bündige lines.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').trim();
        
        // 1. Prepare HTML and convert images
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        
        // Cleanup images and set highlighters
        const highlightElements = Array.from(doc.querySelectorAll('mark, [style*="background-color"]'));
        highlightElements.forEach(el => {
            (el as HTMLElement).style.color = '#000000';
            if (!(el as HTMLElement).style.backgroundColor) {
                (el as HTMLElement).style.backgroundColor = '#FFFF00';
            }
        });

        const images = Array.from(doc.getElementsByTagName('img'));
        for (const img of images) {
            try {
                if (img.src && !img.src.startsWith('data:')) {
                    img.src = await getBase64Image(img.src);
                }
                img.style.maxWidth = '100%';
            } catch (err) {
                console.warn('PDF Image conversion failed:', err);
                img.remove(); // Remove failing images to prevent export crash
            }
        }

        // 2. Convert HTML to pdfmake structure
        // We use a more stable way to handle HRs by pre-processing or explicit styling
        const pdfContent = htmlToPdfmake(doc.body.innerHTML, {
            tableAutoSize: true,
            defaultStyles: {
                p: { margin: [0, 0, 0, 8] }
            }
        });

        // 3. Define PDF document
        // We calculate the content width: 210mm (595.28pt) - 2 * 20mm (56.69pt) = 481.9pt
        const contentWidth = 481.89;

        const docDefinition: any = {
            content: [
                { text: safeTitle, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                // Blue header line
                { 
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: contentWidth, y2: 5, lineWidth: 1, lineColor: '#3b82f6' }], 
                    margin: [0, 0, 0, 20] 
                },
                pdfContent
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87],
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
                // Styling for HR tags from html-to-pdfmake
                "html-hr": {
                    margin: [0, 12, 0, 12],
                    color: '#EAEAEA',
                    border: [false, true, false, false], // Use border to simulate 0.5pt line
                    lineWidth: 0.5 
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
                                    x2: contentWidth, y2: 28.35, 
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
                                    alignment: 'right'
                                }
                            ]
                        }
                    ],
                    margin: [56.69, 0, 56.69, 20]
                };
            }
        };

        // 4. Generate and Download
        const pdf = pdfMake.createPdf(docDefinition);
        pdf.download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('PDF Export fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)));
    }
};

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
