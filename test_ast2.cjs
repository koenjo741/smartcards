const htmlToPdfMake = require('html-to-pdfmake');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const { window } = new JSDOM('');

const html = `
    <p><mark style="background-color: #334155"><span style="color: #4ade80">DMEA 2026</span></mark></p>
`;

let pdfContent = htmlToPdfMake(html, {
    window: window,
    ignoreStyles: true
});

fs.writeFileSync('./ast_output2.json', JSON.stringify(pdfContent, null, 2));
