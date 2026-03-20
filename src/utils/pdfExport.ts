import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

// Robust initialization for all environments
const pm = (pdfMake as any).default || pdfMake;
const pf = (pdfFonts as any).default || pdfFonts;

// Robust vfs assignment for varied module structures (CJS/ESM interop in Vite)
if (pf && pf.pdfMake && pf.pdfMake.vfs) {
    pm.vfs = pf.pdfMake.vfs;
} else if (pf && pf.vfs) {
    pm.vfs = pf.vfs;
} else if (pf) {
    pm.vfs = (pf as any).vfs || pf; 
} else {
    console.error('PDF Export: Could not load vfs_fonts. PDF generation may fail.');
}

// CRITICAL: Explicit Font Mapping for pdfMake 0.2.x+ / 0.3.x
// This prevents 'progressCallback' undefined errors and silent hangs.
pm.fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

/**
 * PDF Export Utility v1.3.30 - Ultimate Stability & Table Fix Pro
 * - Uses a split-and-merge strategy for HR lines to bypass parsing crashes.
 * - Forces perfect 2.0cm left-alignment for text block and footer.
 * - Refined font sizes (Title: 12pt, Body: 10pt).
 * - NEW: Aggressive sanitization of table/column styles to prevent layout engine crashes.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const contentWidth = 481.89; // (210mm - 2*20mm) to pt

        // 0. Aggressive Sanitization of HTML String
        // We strip layout styles that often cause html-to-pdfmake / pdfmake crashes
        let sanitizedHtml = (html || '')
            // Replace width: fit-content with 100% (flexible regex for spacing/casing)
            .replace(/width\s*:\s*fit-content\s*;?/gi, 'width: 100%;')
            // Remove min-width/max-width which can mess up column calculations
            .replace(/(min-width|max-width)\s*:\s*[^;"]+;?/gi, '')
            // Remove display: table/inline-table which is redundant for <table> tags and can confuse parser
            .replace(/display\s*:\s*(table|inline-table|table-row|table-cell)\s*;?/gi, '')
            // Remove box-sizing
            .replace(/box-sizing\s*:\s*[^;"]+;?/gi, '');

        // 1. Pre-process Images and Highlighters (DOM side)
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, 'text/html');
        
        // Highlighters styling
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

        // 2. Strategy: Split HTML by <hr> and convert parts separately
        // This avoids the 'text' property crash often caused by customTag HR mapping.
        let rawHtml = doc.body.innerHTML;
        const hrMarker = '___HR_DIVIDER_STABLE___';
        rawHtml = rawHtml.replace(/<hr\s*\/?>/gi, hrMarker);
        
        const htmlParts = rawHtml.split(hrMarker);
        const resolvedNodes: any[] = [];

        for (let i = 0; i < htmlParts.length; i++) {
            const part = htmlParts[i].trim();
            if (part) {
                const nodes = htmlToPdfmake(part, { tableAutoSize: true });
                if (Array.isArray(nodes)) resolvedNodes.push(...nodes);
                else resolvedNodes.push(nodes);
            }
            
            // Insert the line manually between parts
            if (i < htmlParts.length - 1) {
                resolvedNodes.push({
                    canvas: [
                        {
                            type: 'line',
                            x1: 0, y1: 0,
                            x2: contentWidth, y2: 0,
                            lineWidth: 0.5,
                            lineColor: '#E5E5E5' // 10% lighter than #DCDCDC
                        }
                    ],
                    margin: [0, 15, 0, 15] // Healthy spacing for the internal separators
                });
            }
        }

        // 3. Document Definition
        const docDefinition: any = {
            content: [
                { text: safeTitle, style: 'header' },
                { 
                    text: `Exportiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
                    style: 'subheader'
                },
                // Blue line - precisely 1pt
                { 
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 1, lineColor: '#3b82f6' }], 
                    margin: [0, 0, 0, 15] 
                },
                // The main content nodes
                { stack: resolvedNodes }
            ],
            pageSize: 'A4',
            pageMargins: [56.69, 70.87, 56.69, 70.87], // 2.0cm Side Margins
            styles: {
                header: { 
                    fontSize: 12, 
                    bold: true, 
                    margin: [0, 0, 0, 2], 
                    color: '#1e293b' 
                },
                subheader: { fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
                p: { fontSize: 10, margin: [0, 0, 0, 5], lineHeight: 1.3 },
                mark: { 
                    background: '#FFFF00', 
                    color: '#000000',
                    lineHeight: 1.0 
                }
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
                            margin: [0, 25, 0, 10] // Positions line 25pt from footer bottom
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
        pm.createPdf(docDefinition).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Critical Error:', error);
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
