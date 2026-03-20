/**
 * Robust Text-Based PDF Export
 * - Supports text selection and clickable URLs.
 * - Handles multi-page tables and layout.
 * - Precise 2.5cm margins and footer formatting.
 * - Lazy loaded for performance.
 * - Uses CDN-hosted fonts to avoid production bundling issues with vfs_fonts.js.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export'): Promise<void> => {
    try {
        // 0. Lazy load core libraries
        const [pdfMakeModule, htmlToPdfMakeModule] = await Promise.all([
            import('pdfmake/build/pdfmake'),
            import('html-to-pdfmake')
        ]);

        const pdfMake = pdfMakeModule.default || pdfMakeModule;
        const htmlToPdfMake = htmlToPdfMakeModule.default || htmlToPdfMakeModule;

        // 0.1 Configure Fonts (using reliable CDN URLs to avoid vfs_fonts.js bundling issues)
        const fonts = {
            Roboto: {
                normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
                bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
                italic: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf',
                bolditalic: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-MediumItalic.ttf'
            }
        };

        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const now = new Date();
        const exportTimeText = `Download vom ${now.toLocaleDateString('de-DE')}, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

        // 1. Sanitize HTML
        const sanitizeForPdf = (htmlInput: string) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlInput, 'text/html');
            
            // Cleanup Tiptap specific structures
            doc.querySelectorAll('ul[data-type="taskList"]').forEach((el: any) => el.removeAttribute('data-type'));
            doc.querySelectorAll('li[data-type="taskItem"]').forEach((el: any) => {
                el.removeAttribute('data-type');
                const checkbox = el.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.remove();
            });

            // Strip all problematic styles but preserve highlighters
            doc.querySelectorAll('*').forEach((el: any) => {
                const bgColor = el.style.backgroundColor;
                const isHighlight = bgColor && (bgColor.includes('yellow') || bgColor.includes('rgba') || bgColor.includes('rgb'));
                el.removeAttribute('style');
                if (isHighlight || el.tagName === 'MARK') el.style.backgroundColor = 'yellow';
                if (['LABEL', 'INPUT', 'BUTTON', 'SELECT', 'SCRIPT', 'STYLE'].includes(el.tagName)) el.remove();
            });

            // Clean empty tags
            doc.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6').forEach(el => {
                if (!el.textContent?.trim() && !el.querySelector('img, hr, br, table')) el.remove();
            });

            return doc.body.innerHTML;
        };

        const cleanedHtml = sanitizeForPdf(html);
        const MARGIN_2_5_CM = 70.875;
        const PAGE_WIDTH = 595.28;

        // 2. Convert HTML to pdfMake content
        const content = (htmlToPdfMake as any)(cleanedHtml, {
            window: window,
            tableAutoSize: true,
            defaultStyles: {
                p: { marginBottom: 0.8, lineHeight: 1.0 },
                li: { marginBottom: 0.5 },
                a: { color: '#2563eb', decoration: 'underline' },
                mark: { background: 'yellow' }
            },
            customTag: ({ element, ret }: any) => {
                if (element.nodeName === 'HR') {
                    return {
                        canvas: [{ type: 'line', x1: 0, y1: 5, x2: PAGE_WIDTH - (MARGIN_2_5_CM * 2), y2: 5, lineWidth: 0.2, lineColor: '#cccccc' }],
                        margin: [0, 5, 0, 5]
                    };
                }
                return ret;
            }
        });

        // 3. Define Doc Definition
        const docDefinition: any = {
            pageSize: 'A4',
            pageMargins: [MARGIN_2_5_CM, MARGIN_2_5_CM, MARGIN_2_5_CM, MARGIN_2_5_CM],
            header: (currentPage: number) => {
                if (currentPage === 1) {
                    return {
                        stack: [
                            { text: safeTitle, fontSize: 17, bold: true, margin: [MARGIN_2_5_CM, 40, MARGIN_2_5_CM, 0] },
                            { text: exportTimeText, fontSize: 10, color: '#999999', margin: [MARGIN_2_5_CM, 1, MARGIN_2_5_CM, 2] },
                            {
                                canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH - (MARGIN_2_5_CM * 2), y2: 0, lineWidth: 0.5, lineColor: '#3b82f6' }],
                                margin: [MARGIN_2_5_CM, 2, MARGIN_2_5_CM, 0]
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
                        { text: `Seite ${currentPage}/${pageCount}`, alignment: 'right', fontSize: 9, margin: [0, 20, MARGIN_2_5_CM, 0] }
                    ]
                };
            },
            content: [
                { text: '', margin: [0, 15, 0, 0] },
                ...(Array.isArray(content) ? content : [content]).filter(Boolean)
            ],
            defaultStyle: { font: 'Roboto', fontSize: 8.5, lineHeight: 1.1, color: '#000000' },
            styles: {
                header: { fontSize: 20.5, bold: true, marginBottom: 4 },
                subheader: { fontSize: 16.5, bold: true, marginBottom: 2 },
                h1: { fontSize: 20.5, bold: true, marginBottom: 4 },
                h2: { fontSize: 16.5, bold: true, marginBottom: 2 },
                h3: { fontSize: 14.5, bold: true, marginBottom: 1.5 },
                h4: { fontSize: 12.5, bold: true, marginBottom: 1.2 },
                h5: { fontSize: 11.5, bold: true, marginBottom: 0.8 },
                h6: { fontSize: 10.5, bold: true, marginBottom: 0.8 },
                quote: { italic: true },
                small: { fontSize: 9 },
                mark: { background: 'yellow' }
            }
        };

        // 4. Generate PDF using explicit fonts object to bypass vfs_fonts.js issues
        (pdfMake as any).createPdf(docDefinition, null, fonts).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Der Export ist fehlgeschlagen.');
    }
};
