const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;
const fs = require('fs');

const docDefinition = {
    content: [
        { text: 'Normal text' },
        { text: 'Highlighted text', background: '#4ade80' },
        { text: [{ text: 'Nested highlighted text' }], background: '#4ade80' },
        { text: 'Highlighted with explicit black text', background: '#4ade80', color: '#000000' }
    ]
};

const pdfDoc = pdfMake.createPdf(docDefinition);
pdfDoc.getBuffer((buffer) => {
    fs.writeFileSync('./test.pdf', buffer);
    console.log('PDF generated successfully');
});
