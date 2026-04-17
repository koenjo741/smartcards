const htmlToPdfMake = require('html-to-pdfmake');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { window } = new JSDOM('');

const rgbToHex = (colorStr) => {
    if (!colorStr) return colorStr;
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
        return '#' + match.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    return colorStr;
};

const html = `<mark style="background-color: #4ade80; color: #334155">DEDALUS</mark>`;

let pdfContent = htmlToPdfMake(html, {
    window: window,
    ignoreStyles: true,
    customTag: ({ element, ret }) => {
        const bgColor = rgbToHex(element.style.backgroundColor) || rgbToHex(element.getAttribute('data-color'));
        const textColor = rgbToHex(element.style.color);
        
        if (bgColor || textColor) {
            const applyStylesDeep = (node) => {
                if (Array.isArray(node)) {
                    return node.map(applyStylesDeep);
                }
                if (typeof node === 'string') {
                    const styledNode = { text: node };
                    if (bgColor) styledNode.background = bgColor;
                    if (textColor) styledNode.color = textColor;
                    return styledNode;
                }
                if (typeof node === 'object' && node !== null) {
                    const result = { ...node };
                    if (result.text && Array.isArray(result.text)) {
                        result.text = result.text.map(applyStylesDeep);
                        delete result.background;
                    } else {
                        if (bgColor && !result.background) result.background = bgColor;
                        if (textColor && !result.color) result.color = textColor;
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

console.log(JSON.stringify(pdfContent, null, 2));
