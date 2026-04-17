const htmlToPdfMake = require('html-to-pdfmake');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const { window } = new JSDOM('');

const rgbToHex = (colorStr) => {
    if (!colorStr) return colorStr;
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
        return '#' + match.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    return colorStr;
};

const html = `
    <p><mark style="background-color: #4ade80">DEDALUS</mark></p>
    <p>27.01.2026: <mark style="background-color: #4ade80">[OK]</mark></p>
`;

const dynamicStyles = {};

let pdfContent = htmlToPdfMake(html, {
    window: window,
    ignoreStyles: true,
    customTag: ({ element, ret }) => {
        const bgColor = rgbToHex(element.style.backgroundColor) || rgbToHex(element.getAttribute('data-color'));
        const textColor = rgbToHex(element.style.color);
        
        if (bgColor || textColor) {
            const styleKey = `dyn_${bgColor?.replace('#', '') || 'bg'}_${textColor?.replace('#', '') || 'fg'}`;
            dynamicStyles[styleKey] = {};
            if (bgColor) dynamicStyles[styleKey].background = bgColor;
            if (textColor) dynamicStyles[styleKey].color = textColor;
            
            const applyStylesDeep = (node) => {
                if (Array.isArray(node)) {
                    return node.map(applyStylesDeep);
                }
                if (typeof node === 'string') {
                    return { text: node, style: [styleKey] };
                }
                if (typeof node === 'object' && node !== null) {
                    const result = { ...node };
                    if (result.text && Array.isArray(result.text)) {
                        result.text = result.text.map(applyStylesDeep);
                    } else {
                        result.style = result.style ? (Array.isArray(result.style) ? [...result.style, styleKey] : [result.style, styleKey]) : [styleKey];
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

const sanitizePdfmakeTree = (node) => {
    if (!node) return node;

    if (Array.isArray(node)) {
        return node.map(sanitizePdfmakeTree);
    }

    if (node && typeof node === 'object') {
        const newNode = { ...node };

        if (newNode.text && Array.isArray(newNode.text)) {
            const flattenArray = (arr) => {
                let flat = [];
                for (let i = 0; i < arr.length; i++) {
                    if (Array.isArray(arr[i])) {
                        flat = flat.concat(flattenArray(arr[i]));
                    } else {
                        flat.push(arr[i]);
                    }
                }
                return flat;
            };

            newNode.text = flattenArray(newNode.text).map((inlineItem) => {
                const cleanItem = sanitizePdfmakeTree(inlineItem);
                if (cleanItem && typeof cleanItem === 'object') {
                    delete cleanItem.margin;
                    delete cleanItem.display;
                }
                return cleanItem;
            });
            
            if (newNode.text.length === 1) {
                newNode.text.push('\u200B');
            }
        }
        return newNode;
    }
    return node;
};

// Group inline elements like in original code
const groupInlineElements = (nodes) => {
    const result = [];
    let currentInlineGroup = [];

    for (const item of nodes) {
        const isBlock = item && typeof item === 'object' && !Array.isArray(item) && (
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

const processed = groupInlineElements(pdfContent).map(sanitizePdfmakeTree);
fs.writeFileSync('./ast_output.json', JSON.stringify({ processed, dynamicStyles }, null, 2));
