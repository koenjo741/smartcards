const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;
const fs = require('fs');

const docDefinition = {
    content: [
        { text: 'Paragraph with inline ', background: 'white' },
        { text: [
            'This is ',
            { text: 'highlighted', background: '#4ade80' },
            ' text.'
        ] }
    ]
};

const pdfDoc = pdfMake.createPdf(docDefinition);
pdfDoc.getBuffer((buffer) => {
    fs.writeFileSync('./test2.pdf', buffer);
    console.log('PDF generated successfully');
});
