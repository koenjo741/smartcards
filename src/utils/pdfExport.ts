/**
 * Robust Text-Based PDF Export
 * - Supports text selection and clickable URLs.
 * - Handles multi-page tables and layout.
 * - Precise 2.5cm margins and footer formatting.
 * - Lazy loaded for performance.
 * - Uses CDN-hosted fonts to avoid production bundling issues with vfs_fonts.js.
 */
export const exportCardToPdf = async (html: string, title: string = 'Card_Export', orientation: 'portrait' | 'landscape' = 'portrait'): Promise<void> => {
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

        const rawTitle = (title || 'Export').toString().trim() || 'Unbenannt';
        const safeTitle = rawTitle
            .replace(/✅/g, '[OK]')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
        const now = new Date();
        const exportTimeText = `Download vom ${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

        const rgbToHex = (colorStr: string): string => {
            if (!colorStr) return colorStr;
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (match) {
                return '#' + match.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            }
            return colorStr;
        };

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

            // Strip all problematic styles but preserve highlighters and text colors
            doc.querySelectorAll('*').forEach((el: any) => {
                const bgColor = el.style.backgroundColor || el.getAttribute('data-color');
                const textColor = el.style.color;
                
                const isHighlight = !!bgColor;
                
                el.removeAttribute('style');
                
                if (isHighlight) {
                    el.style.backgroundColor = bgColor;
                } else if (el.tagName === 'MARK') {
                    el.style.backgroundColor = '#4ade80';
                }
                
                if (textColor) {
                    el.style.color = textColor;
                }
                
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
        // and replace unsupported Unicode arrows with ASCII equivalents to ensure correct PDF rendering
        const normalizedHtml = html
            .replace(/\n+/g, ' ')
            .replace(/→/g, '->')
            .replace(/←/g, '<-')
            .replace(/&rarr;/ig, '->')
            .replace(/&larr;/ig, '<-')
            .replace(/✅/g, '[OK]')
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero width spaces
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // strip remaining complex emojis
        const cleanedHtml = await prepareHtmlForPdf(normalizedHtml);
        const PAGE_MARGIN_TB = 56.7; // 2.0 cm
        const PAGE_MARGIN_LR = 42.5; // 1.5 cm
        const PAGE_WIDTH = orientation === 'landscape' ? 841.89 : 595.28;
        
        const dynamicStyles: any = {};

        // 2. Convert HTML to pdfMake content
        let pdfContent = (htmlToPdfMake as any)(cleanedHtml, {
            window: window,
            tableAutoSize: true,
            ignoreStyles: true, // Prevents html-to-pdfmake from inheriting 'white-space' blocks from global CSS
            removeExtraBlanks: true, // Collapses HTML space nodes accurately
            defaultStyles: {
                p: { margin: [0, 1, 0, 2], lineHeight: 0.9 },
                div: { margin: [0, 1, 0, 2], lineHeight: 0.9 },
                li: { margin: [0, 0, 0, 1], lineHeight: 0.9 },
                a: { color: '#2563eb', decoration: 'underline' }
            },
            customTag: ({ element, ret }: any) => {
                if (element.nodeName === 'HR') {
                    return {
                        canvas: [{ type: 'line', x1: 0, y1: 5, x2: PAGE_WIDTH - (PAGE_MARGIN_LR * 2), y2: 5, lineWidth: 0.2, lineColor: '#cccccc' }],
                        margin: [0, 5, 0, 5]
                    };
                }
                
                const bgColor = rgbToHex(element.style.backgroundColor) || rgbToHex(element.getAttribute('data-color'));
                const textColor = rgbToHex(element.style.color);
                
                if (bgColor || textColor) {
                    const styleKey = `dyn_${bgColor?.replace('#', '') || 'bg'}_${textColor?.replace('#', '') || 'fg'}`;
                    dynamicStyles[styleKey] = {};
                    if (bgColor) dynamicStyles[styleKey].background = bgColor;
                    if (textColor) dynamicStyles[styleKey].color = textColor;
                    
                    if (Array.isArray(ret)) {
                        return { text: ret, style: [styleKey] };
                    } else if (typeof ret === 'object' && ret !== null) {
                        ret.style = ret.style ? (Array.isArray(ret.style) ? [...ret.style, styleKey] : [ret.style, styleKey]) : [styleKey];
                        return ret;
                    } else if (typeof ret === 'string') {
                        return { text: ret, style: [styleKey] };
                    }
                }
                
                return ret;
            }
        });

        // Ensure pdfContent is a flat array
        if (!Array.isArray(pdfContent)) {
            pdfContent = [pdfContent];
        }

        // Groups scattered inline elements into valid paragraph blocks
        const groupInlineElements = (nodes: any[]): any[] => {
            const result: any[] = [];
            let currentInlineGroup: any[] = [];

            for (const item of nodes) {
                const isBlock = item && typeof item === 'object' && (
                    item.margin || item.stack || item.table || item.ul || item.ol || 
                    item.canvas || item.image || item.pageBreak || item.columns || item.svg
                );

                if (!isBlock) {
                    currentInlineGroup.push(item);
                } else {
                    if (currentInlineGroup.length > 0) {
                        result.push({ text: currentInlineGroup });
                        currentInlineGroup = [];
                    }
                    result.push(item);
                }
            }
            if (currentInlineGroup.length > 0) {
                result.push({ text: currentInlineGroup });
            }
            return result;
        };

        // Deep scrubber to ensure inline elements inside text arrays NEVER have block properties like margin or display
        const sanitizePdfmakeTree = (node: any): any => {
            if (Array.isArray(node)) {
                return node.map(sanitizePdfmakeTree);
            }
            if (node && typeof node === 'object') {
                const newNode = { ...node };

                // Compress vertical margins for standard blocks to make text more compact
                if (newNode.margin && Array.isArray(newNode.margin) && !newNode.canvas && !newNode.table && !newNode.pageBreak) {
                    const isHeader = newNode.style && (
                        newNode.style === 'h1' || newNode.style === 'h2' || newNode.style === 'h3' ||
                        newNode.style === 'h4' || newNode.style === 'h5' || newNode.style === 'h6' ||
                        (Array.isArray(newNode.style) && newNode.style.some((s: string) => s.startsWith('h')))
                    );
                    
                    if (!isHeader) {
                        const textContent = Array.isArray(newNode.text) 
                            ? newNode.text.map((t: any) => typeof t === 'string' ? t : (t?.text || '')).join('')
                            : (typeof newNode.text === 'string' ? newNode.text : '');
                        
                        const isBlankLine = !newNode.image && !newNode.svg && textContent.trim() === '';
                        
                        if (isBlankLine) {
                            // give it some height to act like an empty line
                            newNode.margin = [newNode.margin[0] || 0, 5, newNode.margin[2] || 0, 5];
                        } else {
                            // Preserve left margin for indentation (lists), but squish top and bottom
                            newNode.margin = [newNode.margin[0] || 0, 1, newNode.margin[2] || 0, 2];
                        }
                    }
                }

                if (newNode.text && Array.isArray(newNode.text)) {
                    const flattenArray = (arr: any[]): any[] => {
                        let flat: any[] = [];
                        for (let i = 0; i < arr.length; i++) {
                            if (Array.isArray(arr[i])) {
                                flat = flat.concat(flattenArray(arr[i]));
                            } else {
                                flat.push(arr[i]);
                            }
                        }
                        return flat;
                    };

                    newNode.text = flattenArray(newNode.text).map((inlineItem: any) => {
                        const cleanItem = sanitizePdfmakeTree(inlineItem);
                        if (cleanItem && typeof cleanItem === 'object') {
                            // strictly force inline flow by removing any box-model margins or display types
                            delete cleanItem.margin;
                            delete cleanItem.display;
                        }
                        return cleanItem;
                    });
                }
                if (newNode.stack) {
                    newNode.stack = groupInlineElements(newNode.stack).map(sanitizePdfmakeTree);
                }
                if (newNode.table) {
                    newNode.fontSize = 9;
                    if (newNode.table.body) {
                        newNode.table.body = sanitizePdfmakeTree(newNode.table.body);
                        
                        // Apply styling to table header row (row index 0)
                        if (newNode.table.body.length > 0 && Array.isArray(newNode.table.body[0])) {
                            newNode.table.body[0] = newNode.table.body[0].map((cell: any) => {
                                if (!cell) return cell;
                                const styledCell = typeof cell === 'object' ? { ...cell } : { text: cell };
                                styledCell.fillColor = '#1e293b'; // Slate 800
                                styledCell.color = '#ffffff';     // White
                                styledCell.bold = true;
                                styledCell.fontSize = 11;
                                return styledCell;
                            });
                        }
                    }
                    
                    newNode.layout = {
                        hLineWidth: function () { return 1; },
                        vLineWidth: function () { return 1; },
                        hLineColor: function () { return '#e2e8f0'; }, // Slate 200 light border
                        vLineColor: function () { return '#e2e8f0'; },
                        paddingLeft: function() { return 4; },
                        paddingRight: function() { return 4; },
                        paddingTop: function() { return 3; },
                        paddingBottom: function() { return 3; }
                    };
                }
                if (newNode.ul) newNode.ul = sanitizePdfmakeTree(newNode.ul);
                if (newNode.ol) newNode.ol = sanitizePdfmakeTree(newNode.ol);
                return newNode;
            }
            return node;
        };

        const normalizedPdfContent = groupInlineElements(pdfContent).map(sanitizePdfmakeTree);

        // 3. Define Doc Definition
        const docDefinition: any = {
            pageSize: 'A4',
            pageOrientation: orientation,
            pageMargins: [PAGE_MARGIN_LR, 42.5, PAGE_MARGIN_LR, PAGE_MARGIN_TB],
            footer: (currentPage: number, pageCount: number) => {
                return {
                    stack: [
                        {
                            canvas: [{ type: 'line', x1: 0, y1: 14.17, x2: PAGE_WIDTH - (PAGE_MARGIN_LR * 2), y2: 14.17, lineWidth: 0.2, lineColor: '#cccccc' }],
                            margin: [PAGE_MARGIN_LR, 0, PAGE_MARGIN_LR, 0]
                        },
                        { text: `Seite ${currentPage}/${pageCount}`, alignment: 'right', fontSize: 10, margin: [0, 20, PAGE_MARGIN_LR, 0] }
                    ]
                };
            },
            content: [
                {
                    stack: [
                        { text: safeTitle, fontSize: 18.5, bold: true, margin: [0, 0, 0, 0] },
                        { text: exportTimeText, fontSize: 11, color: '#CAD5E2', margin: [0, 4, 0, 4] },
                        {
                            canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH - (PAGE_MARGIN_LR * 2), y2: 0, lineWidth: 0.2, lineColor: '#2B7FFF' }],
                            margin: [0, 0, 0, 15]
                        }
                    ]
                },
                ...(Array.isArray(normalizedPdfContent) ? normalizedPdfContent : [normalizedPdfContent]).filter(Boolean)
            ],
            defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 0.9, color: '#000000' },
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
                ...dynamicStyles
            }
        };

        // 4. Generate PDF using explicit fonts object to bypass vfs_fonts.js issues
        (pdfMake as any).createPdf(docDefinition, null, fonts).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Der Export ist fehlgeschlagen.');
    }
};
