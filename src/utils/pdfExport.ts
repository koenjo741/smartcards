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
                italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf',
                bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-MediumItalic.ttf'
            }
        };

        const safeTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const now = new Date();
        const exportTimeText = `Download vom ${now.toLocaleDateString('de-DE')}, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

        // 1. Prepare and Sanitize HTML
        const prepareHtmlForPdf = async (htmlInput: string) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlInput, 'text/html');
            
            // Cleanup Tiptap specific structures
            doc.querySelectorAll('ul[data-type="taskList"]').forEach((el: any) => el.removeAttribute('data-type'));
            doc.querySelectorAll('li[data-type="taskItem"]').forEach((el: any) => {
                el.removeAttribute('data-type');
                const checkbox = el.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.remove();
            });

            // Process Images asynchronously
            const images = Array.from(doc.querySelectorAll('img'));
            for (const img of images) {
                const src = img.getAttribute('src');
                if (src) {
                    try {
                        let finalSrc = src;
                        if (!src.startsWith('data:')) {
                            const fetchUrl = src.startsWith('/') ? window.location.origin + src : src;
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 5000);
                            const response = await fetch(fetchUrl, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                            const blob = await response.blob();
                            finalSrc = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        }
                        
                        img.setAttribute('src', finalSrc);

                        const imgEl = new Image();
                        const loaded = new Promise<void>((resolve) => {
                            imgEl.onload = () => resolve();
                            imgEl.onerror = () => resolve();
                        });
                        imgEl.src = finalSrc;
                        
                        // Prevent infinite hanging if image load fails silently
                        await Promise.race([
                            loaded,
                            new Promise<void>(resolve => setTimeout(resolve, 5000))
                        ]);
                        
                        const MAX_WIDTH = 450;
                        if (imgEl.width > MAX_WIDTH) {
                            img.setAttribute('width', String(MAX_WIDTH));
                        } else if (imgEl.width > 0) {
                            img.setAttribute('width', String(imgEl.width));
                        }
                        img.removeAttribute('height'); // Let pdfmake handle aspect ratio
                    } catch (err) {
                        console.warn('Failed to load image for PDF export:', src, err);
                        img.remove();
                    }
                } else {
                    img.remove();
                }
            }

            // Strip all problematic styles but preserve highlighters
            doc.querySelectorAll('*').forEach((el: any) => {
                const bgColor = el.style.backgroundColor;
                const isHighlight = bgColor && (bgColor.includes('yellow') || bgColor.includes('rgba') || bgColor.includes('rgb'));
                el.removeAttribute('style');
                if (isHighlight || el.tagName === 'MARK') el.style.backgroundColor = 'yellow';
                if (['LABEL', 'INPUT', 'BUTTON', 'SELECT', 'SCRIPT', 'STYLE'].includes(el.tagName)) el.remove();
            });

            // Clean empty tags (only if they genuinely lack layout or text content - beware of structural spaces)
            doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(el => {
                // Check if totally empty of string content AND lacking structural children
                if (!el.textContent && !el.querySelector('img, hr, br, table, span')) el.remove();
            });

            return doc.body.innerHTML;
        };

        // Aggressively replace newlines \n with spaces to prevent html-to-pdfmake from misinterpreting them as hard breaks
        const normalizedHtml = html.replace(/\n+/g, ' ');
        const cleanedHtml = await prepareHtmlForPdf(normalizedHtml);
        const MARGIN_2_5_CM = 70.875;
        const PAGE_WIDTH = 595.28;

        // 2. Convert HTML to pdfMake content
        const content = (htmlToPdfMake as any)(cleanedHtml, {
            window: window,
            tableAutoSize: true,
            ignoreStyles: true, // Prevents html-to-pdfmake from inheriting 'white-space' blocks from global CSS
            removeExtraBlanks: true, // Collapses HTML space nodes accurately
            defaultStyles: {
                p: { marginBottom: 0, lineHeight: 1.0 },
                li: { marginBottom: 0, lineHeight: 1.0 },
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
                            { text: safeTitle, fontSize: 18.5, bold: true, margin: [MARGIN_2_5_CM, 40, MARGIN_2_5_CM, 0] },
                            { text: exportTimeText, fontSize: 11, color: '#999999', margin: [MARGIN_2_5_CM, 1, MARGIN_2_5_CM, 2] },
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
                        { text: `Seite ${currentPage}/${pageCount}`, alignment: 'right', fontSize: 10, margin: [0, 20, MARGIN_2_5_CM, 0] }
                    ]
                };
            },
            content: [
                { text: '', margin: [0, 15, 0, 0] },
                ...(Array.isArray(content) ? content : [content]).filter(Boolean)
            ],
            defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.0, color: '#000000' },
            styles: {
                header: { fontSize: 22, bold: true, marginBottom: 0.5 },
                subheader: { fontSize: 18, bold: true, marginBottom: 0.5 },
                h1: { fontSize: 22, bold: true, marginBottom: 0.5 },
                h2: { fontSize: 18, bold: true, marginBottom: 0.5 },
                h3: { fontSize: 16, bold: true, marginBottom: 0.5 },
                h4: { fontSize: 14, bold: true, marginBottom: 0.5 },
                h5: { fontSize: 13, bold: true, marginBottom: 0.5 },
                h6: { fontSize: 12, bold: true, marginBottom: 0.5 },
                quote: { italic: true },
                small: { fontSize: 10 },
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
