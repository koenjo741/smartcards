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
                        
                        const MAX_WIDTH = 225; // 50% of original 450 to shrink images by 50%
                        const targetWidth = imgEl.width > 0 ? Math.min(imgEl.width * 0.5, MAX_WIDTH) : MAX_WIDTH;
                        img.setAttribute('width', String(targetWidth));
                        img.removeAttribute('height'); // Let pdfmake handle aspect ratio
                    } catch (err) {
                        console.warn('Failed to load image for PDF export:', src, err);
                        img.remove();
                    }
                } else {
                    img.remove();
                }
            }

            // Strip all problematic styles but preserve highlighters, text colors, alignment, and indentation
            const styleProcessor = (el: HTMLElement, inheritedColor: string | null = null) => {
                const bgColor = el.style.backgroundColor || el.getAttribute('data-color');
                const textColor = el.style.color || inheritedColor;
                const isHighlight = !!bgColor;

                // Capture layout properties from inline styles before stripping
                const marginLeft = el.style.marginLeft;
                let indentVal = '';
                if (marginLeft) {
                    const match = marginLeft.match(/(\d+)/);
                    if (match) indentVal = match[1];
                }
                const textAlign = el.style.textAlign;

                el.removeAttribute('style');
                if (isHighlight) {
                    el.style.backgroundColor = bgColor;
                } else if (el.tagName === 'MARK') {
                    el.style.backgroundColor = '#4ade80';
                }
                if (textColor) el.style.color = textColor;

                // Store captured layout properties as custom attributes
                if (indentVal) el.setAttribute('data-pdf-indent', indentVal);
                if (textAlign) el.setAttribute('data-pdf-align', textAlign);

                Array.from(el.children).forEach(child => styleProcessor(child as HTMLElement, textColor));
                if (['LABEL', 'INPUT', 'BUTTON', 'SELECT', 'SCRIPT', 'STYLE'].includes(el.tagName)) el.remove();
            };
            styleProcessor(doc.body);

            // Clean empty tags
            doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(el => {
                if (!el.textContent && !el.querySelector('img, hr, br, table, span')) el.remove();
            });

            return doc.body.innerHTML;
        };

        const PAGE_WIDTH = orientation === 'landscape' ? 841.89 : 595.28;
        const PAGE_MARGIN_LR = 40; // Increased margins
        const PAGE_MARGIN_TOP = 60; // Extra top margin for header space
        const PAGE_MARGIN_BOTTOM = 50; // Extra bottom margin for footer space


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
                const pdfAlign = element.getAttribute('data-pdf-align');
                const pdfIndent = element.getAttribute('data-pdf-indent');
                
                if (bgColor || textColor || pdfAlign || pdfIndent) {
                    const applyStylesDeep = (node: any): any => {
                        if (Array.isArray(node)) {
                            return node.map(applyStylesDeep);
                        }
                        if (typeof node === 'string') {
                            const leafNode: any = { text: node };
                            if (bgColor) leafNode.background = bgColor;
                            if (textColor) leafNode.color = textColor;
                            if (pdfAlign) leafNode.alignment = pdfAlign;
                            return leafNode;
                        }
                        if (typeof node === 'object' && node !== null) {
                            const result = { ...node };
                            
                            // Apply alignment
                            if (pdfAlign && !result.alignment) {
                                result.alignment = pdfAlign;
                            }
                            
                            // Apply indentation (margin-left)
                            if (pdfIndent) {
                                const indentPts = parseFloat(pdfIndent) * 0.75; // Convert px to pt approx
                                if (result.margin && Array.isArray(result.margin)) {
                                    result.margin = [result.margin[0] + indentPts, result.margin[1], result.margin[2], result.margin[3]];
                                } else {
                                    // Sensible default margins to append indentation to
                                    let defaultMargin = [0, 1, 0, 2];
                                    if (element.nodeName === 'LI') defaultMargin = [0, 0, 0, 1];
                                    else if (element.nodeName === 'H1') defaultMargin = [0, 0, 0, 8];
                                    else if (element.nodeName === 'H2') defaultMargin = [0, 8, 0, 4];
                                    
                                    result.margin = [defaultMargin[0] + indentPts, defaultMargin[1], defaultMargin[2], defaultMargin[3]];
                                }
                            }
                            
                            if (result.text && Array.isArray(result.text)) {
                                result.text = result.text.map(applyStylesDeep);
                            } else {
                                // Preserve existing inner styles by only setting if missing
                                if (bgColor && !result.background) result.background = bgColor;
                                if (textColor) result.color = textColor; // Explicit text color wins
                            }
                            return result;
                        }
                        return node;
                    };
                    
                    return applyStylesDeep(ret);
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

        const hasPageBreakIndicator = (n: any): boolean => {
            if (!n) return false;
            if (typeof n === 'string') return n.includes('§§§');
            if (Array.isArray(n)) return n.some(hasPageBreakIndicator);
            if (typeof n === 'object') {
                if (typeof n.text === 'string') return n.text.includes('§§§');
                if (Array.isArray(n.text)) return n.text.some(hasPageBreakIndicator);
                if (Array.isArray(n.stack)) return n.stack.some(hasPageBreakIndicator);
                if (Array.isArray(n.ul)) return n.ul.some(hasPageBreakIndicator);
                if (Array.isArray(n.ol)) return n.ol.some(hasPageBreakIndicator);
            }
            return false;
        };

        const stripPageBreakIndicator = (n: any): any => {
            if (!n) return n;
            if (typeof n === 'string') return n.replace(/§§§/g, '');
            if (Array.isArray(n)) return n.map(stripPageBreakIndicator);
            if (typeof n === 'object') {
                const result = { ...n };
                if (typeof result.text === 'string') {
                    result.text = result.text.replace(/§§§/g, '');
                } else if (Array.isArray(result.text)) {
                    result.text = result.text.map(stripPageBreakIndicator);
                }
                if (Array.isArray(result.stack)) {
                    result.stack = result.stack.map(stripPageBreakIndicator);
                }
                if (Array.isArray(result.ul)) {
                    result.ul = result.ul.map(stripPageBreakIndicator);
                }
                if (Array.isArray(result.ol)) {
                    result.ol = result.ol.map(stripPageBreakIndicator);
                }
                return result;
            }
            return n;
        };

        // Deep scrubber to ensure inline elements inside text arrays NEVER have block properties like margin or display
        const sanitizePdfmakeTree = (node: any): any => {
            if (Array.isArray(node)) {
                return node.map(sanitizePdfmakeTree);
            }
            if (node && typeof node === 'object') {
                const newNode = { ...node };

                // Insert page break if this block contains §§§
                if (hasPageBreakIndicator(newNode)) {
                    newNode.pageBreak = 'before';
                    newNode.margin = [0, 0, 0, 0];
                    if (typeof newNode.text === 'string') {
                        newNode.text = newNode.text.replace(/§§§/g, '');
                    } else if (Array.isArray(newNode.text)) {
                        newNode.text = newNode.text.map(stripPageBreakIndicator);
                    } else if (Array.isArray(newNode.stack)) {
                        newNode.stack = newNode.stack.map(stripPageBreakIndicator);
                    } else if (Array.isArray(newNode.ul)) {
                        newNode.ul = newNode.ul.map(stripPageBreakIndicator);
                    } else if (Array.isArray(newNode.ol)) {
                        newNode.ol = newNode.ol.map(stripPageBreakIndicator);
                    }
                }

                // Add margin under images to prevent text from sticking to them
                if (newNode.image || newNode.svg) {
                    newNode.margin = [0, 5, 0, 12];
                }

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
                    
                    // WORKAROUND FOR PDFMAKE INLINE BACKGROUND BUG:
                    // If a highlighted text element touches the boundaries of the paragraph (first or last item),
                    // pdfmake sometimes calculates the bounding box incorrectly and draws a solid block over the text.
                    // By wrapping the array in invisible zero-width spaces, we force it to render purely inline,
                    // which perfectly mimics the working behavior seen when highlights are surrounded by normal text.
                    newNode.text = ['\u200B', ...newNode.text, '\u200B'];
                }
                if (newNode.stack) {
                    newNode.stack = groupInlineElements(newNode.stack).map(sanitizePdfmakeTree);
                }
                if (newNode.table) {
                    newNode.fontSize = 9;
                    if (newNode.table.body) {
                        newNode.table.body = sanitizePdfmakeTree(newNode.table.body);
                        
                        // Style cells, normalize empty ones, and apply zebra striping
                        for (let rowIndex = 0; rowIndex < newNode.table.body.length; rowIndex++) {
                            const row = newNode.table.body[rowIndex];
                            if (Array.isArray(row)) {
                                newNode.table.body[rowIndex] = row.map((cell: any) => {
                                    let styledCell: any;
                                    if (!cell) {
                                        styledCell = { text: '\u200B' };
                                    } else if (typeof cell === 'object') {
                                        styledCell = { ...cell };
                                        if (styledCell.text === undefined || styledCell.text === null || styledCell.text === '' || (Array.isArray(styledCell.text) && styledCell.text.length === 0)) {
                                            styledCell.text = '\u200B';
                                        }
                                    } else {
                                        styledCell = { text: String(cell).trim() === '' ? '\u200B' : cell };
                                    }

                                    if (rowIndex === 0) {
                                        // Header Row Styling (Slate 800)
                                        styledCell.fillColor = '#1e293b';
                                        styledCell.color = '#ffffff';
                                        styledCell.bold = true;
                                        styledCell.fontSize = 11;
                                    } else {
                                        // Zebra striping for body rows: every 2nd row is light gray (Slate 50)
                                        if (rowIndex % 2 === 0) {
                                            styledCell.fillColor = '#f8fafc';
                                        }
                                    }
                                    return styledCell;
                                });
                            }
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
            pageMargins: [PAGE_MARGIN_LR, PAGE_MARGIN_TOP, PAGE_MARGIN_LR, PAGE_MARGIN_BOTTOM],
            defaultStyle: {
                font: 'Roboto',
                fontSize: 9,
                color: '#334155',
                lineHeight: 1.1
            },
            styles: {
                h1: { fontSize: 15, bold: true, color: '#000000', margin: [0, 0, 0, 8] },
                h2: { fontSize: 13, bold: true, color: '#000000', margin: [0, 8, 0, 4] },
                p: { margin: [0, 1, 0, 2], lineHeight: 0.9 },
                tableHeader: { fontSize: 11, bold: true, color: '#ffffff', fillColor: '#1e293b', margin: [0, 2, 0, 2] },
                tableCell: { margin: [0, 1, 0, 1], color: '#334155' },
                link: { color: '#2563eb', decoration: 'underline' }
            },
            header: () => {
                return {
                    stack: [
                        { text: safeTitle, fontSize: 13, bold: true },
                        {
                            canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH - (PAGE_MARGIN_LR * 2), y2: 0, lineWidth: 0.2, lineColor: '#2B7FFF' }],
                            margin: [0, 4, 0, 0]
                        }
                    ],
                    margin: [PAGE_MARGIN_LR, 20, PAGE_MARGIN_LR, 0]
                };
            },
            footer: (currentPage: number, pageCount: number) => {
                return {
                    stack: [
                        {
                            canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH - (PAGE_MARGIN_LR * 2), y2: 0, lineWidth: 0.2, lineColor: '#cccccc' }],
                            margin: [PAGE_MARGIN_LR, 10, PAGE_MARGIN_LR, 0]
                        },
                        {
                            columns: [
                                { text: exportTimeText, alignment: 'left' },
                                { text: `Seite ${currentPage} / ${pageCount}`, alignment: 'right' }
                            ],
                            fontSize: 8,
                            color: '#64748b',
                            margin: [PAGE_MARGIN_LR, 4, PAGE_MARGIN_LR, 0]
                        }
                    ]
                };
            },
            content: [
                ...(Array.isArray(normalizedPdfContent) ? normalizedPdfContent : [normalizedPdfContent]).filter(Boolean)
            ]
        };

        // 4. Generate PDF using explicit fonts object to bypass vfs_fonts.js issues
        (pdfMake as any).createPdf(docDefinition, null, fonts).download(`${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Der Export ist fehlgeschlagen.');
    }
};
