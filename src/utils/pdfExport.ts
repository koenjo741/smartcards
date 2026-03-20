import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfMake from 'html-to-pdfmake';

// Setup VFS for pdfMake - handle different import structures
(pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs || pdfFonts;

/**
 * Robust Text-Based PDF Export
 * - Supports text selection and clickable URLs.
 * - Handles multi-page tables and layout.
 * - Precise 2.5cm margins and footer formatting.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const now = new Date();
        const exportDate = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const exportTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const subtitleText = `Exportiert am ${exportDate}, ${exportTime}`;

        // 1. Sanitize HTML - Nuclear Sanitation
        // html-to-pdfmake often crashes on complex styles. We strip almost everything
        // while preserving the core structure and highlighters.
        const sanitizeForPdf = (htmlInput: string) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlInput, 'text/html');
            
            // Fix Tiptap-specific Task Lists
            doc.querySelectorAll('ul[data-type="taskList"]').forEach((el: any) => {
                el.removeAttribute('data-type');
            });
            doc.querySelectorAll('li[data-type="taskItem"]').forEach((el: any) => {
                el.removeAttribute('data-type');
                // Remove the checkbox but keep the text
                const checkbox = el.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.remove();
            });

            // Strip ALL style attributes from ALL elements to prevent parser crashes
            // We manually handle highlighters by keeping background-color only if it's a highlight
            doc.querySelectorAll('*').forEach((el: any) => {
                const bgColor = el.style.backgroundColor;
                const isHighlight = bgColor && (bgColor.includes('yellow') || bgColor.includes('rgba') || bgColor.includes('rgb'));
                
                // Clear all styles
                el.removeAttribute('style');
                
                // Re-apply highlight as a simple style that pdfmake likes
                if (isHighlight || el.tagName === 'MARK') {
                    el.style.backgroundColor = 'yellow';
                }

                // Remove problematic tags entirely
                if (['LABEL', 'INPUT', 'BUTTON', 'SELECT', 'SCRIPT', 'STYLE'].includes(el.tagName)) {
                    el.remove();
                }
            });

            // Remove empty paragraphs/spans that can cause 'undefined' errors
            doc.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6').forEach(el => {
                if (!el.textContent?.trim() && !el.querySelector('img, hr, br, table')) {
                    el.remove();
                }
            });

            return doc.body.innerHTML;
        };

        const cleanedHtml = sanitizeForPdf(html);
        
        const MARGIN_2_5_CM = 70.875;
        const PAGE_WIDTH = 595.28; // A4 Width in pt

        // 2. Convert HTML to pdfMake content
        const content = htmlToPdfMake(cleanedHtml, {
            window: window,
            tableAutoSize: true,
            defaultStyles: {
                p: { marginBottom: 3, lineHeight: 1.0 },
                li: { marginBottom: 2 },
                a: { color: '#2563eb', decoration: 'underline' },
                mark: { background: 'yellow' }
            },
            customTag: ({ element, ret }: any) => {
                if (element.nodeName === 'HR') {
                    return {
                        canvas: [
                            {
                                type: 'line',
                                x1: 0, y1: 5,
                                x2: PAGE_WIDTH - (MARGIN_2_5_CM * 2),
                                y2: 5,
                                lineWidth: 0.2,
                                lineColor: '#cccccc'
                            }
                        ],
                        margin: [0, 5, 0, 5]
                    };
                }
                return ret; // CRITICAL: must return original ret if not handled
            }
        });

        // 3. Define Doc Definition based on A4 metrics
        const docDefinition: any = {
            pageSize: 'A4',
            pageMargins: [MARGIN_2_5_CM, MARGIN_2_5_CM, MARGIN_2_5_CM, MARGIN_2_5_CM],
            
            header: (currentPage: number) => {
                if (currentPage === 1) {
                    return {
                        stack: [
                            { text: safeTitle, fontSize: 16, bold: true, margin: [MARGIN_2_5_CM, 40, MARGIN_2_5_CM, 2] },
                            { text: subtitleText, fontSize: 10, margin: [MARGIN_2_5_CM, 0, MARGIN_2_5_CM, 4] },
                            {
                                canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH - (MARGIN_2_5_CM * 2), y2: 0, lineWidth: 0.5, lineColor: '#3b82f6' }],
                                margin: [MARGIN_2_5_CM, 0, MARGIN_2_5_CM, 0]
                            }
                        ]
                    };
                }
                return null;
            },

            footer: (currentPage: number, pageCount: number) => {
                return {
                    stack: [
                        {
                            canvas: [{ type: 'line', x1: 0, y1: 14.17, x2: PAGE_WIDTH - (MARGIN_2_5_CM * 2), y2: 14.17, lineWidth: 0.2, lineColor: '#cccccc' }],
                            margin: [MARGIN_2_5_CM, 0, MARGIN_2_5_CM, 0]
                        },
                        {
                            text: `Seite ${currentPage}/${pageCount}`, 
                            alignment: 'right', 
                            fontSize: 8, 
                            margin: [0, 20, MARGIN_2_5_CM, 0] 
                        }
                    ]
                };
            },

            content: [
                { text: '', margin: [0, 25, 0, 0] },
                ...(Array.isArray(content) ? content : [content]).filter(Boolean)
            ],

            defaultStyle: {
                font: 'Roboto',
                fontSize: 7.5,
                lineHeight: 1.1,
                color: '#000000'
            },
            
            styles: {
                header: { fontSize: 18, bold: true, marginBottom: 10 },
                subheader: { fontSize: 14, bold: true, marginBottom: 5 },
                quote: { italic: true },
                small: { fontSize: 8 },
                mark: { background: 'yellow' }
            }
        };

        // 4. Generate and Save
        pdfMake.createPdf(docDefinition).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('Text-PDF Export Error:', error);
        alert('Der Text-basierte Export ist fehlgeschlagen. Wahrscheinlich enthält die Karte zu komplexe Layout-Elemente.');
    }
};
